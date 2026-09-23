using System.IO.Compression;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;

namespace Faethon;
public sealed record ImportRow(string Kind, string Key, string Data, int Row);
public sealed record ImportIssue(string Severity, string Kind, int Row, string Key, string Message);
public sealed record ImportReview(Guid Id, int Products, int Recipes, ImportIssue[] Issues, bool Committed);
public static class WorkbookReader
{
    private static readonly XNamespace Ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    public static List<Dictionary<string, Cell>> Read(Stream stream)
    {
        using var zip = new ZipArchive(stream, ZipArchiveMode.Read, true);
        if (zip.Entries.Sum(e => e.Length) > 100_000_000) throw new InvalidOperationException("Το αρχείο είναι υπερβολικά μεγάλο.");
        XDocument? Load(string path) { var entry=zip.GetEntry(path); if(entry is null)return null; using var s=entry.Open();return XDocument.Load(s); }
        Cell Text(XElement e) => new(string.Concat(e.Descendants(Ns+"t").Select(t=>t.Value)), e.Elements(Ns+"r").Select(r=>new TextRun(string.Concat(r.Descendants(Ns+"t").Select(t=>t.Value)),r.Element(Ns+"rPr")?.Element(Ns+"b") is not null,r.Element(Ns+"rPr")?.Element(Ns+"i") is not null)).ToArray());
        var shared=Load("xl/sharedStrings.xml")?.Descendants(Ns+"si").Select(Text).ToArray() ?? [];
        var sheet=Load("xl/worksheets/sheet1.xml") ?? throw new InvalidOperationException("Δεν βρέθηκε φύλλο εργασίας.");
        return sheet.Descendants(Ns+"row").Select(row=>row.Elements(Ns+"c").ToDictionary(c=>new string(((string?)c.Attribute("r")??"").TakeWhile(char.IsLetter).ToArray()),c=>{
            var type=(string?)c.Attribute("t");var v=c.Element(Ns+"v")?.Value??"";
            if(type=="s")return shared[int.Parse(v)];
            if(type=="inlineStr")return Text(c);
            return new Cell(v,[]);
        })).ToList();
    }
    public sealed record Cell(string Value, TextRun[] Runs);
    public static readonly string[] Languages=["el","en","de","bg","ro","fr","it","es","pl","nl","pt","cs","sv","hu","hr","sq"];
    public static List<ImportRow> Parse(Stream stream, string kind)
    {
        var rows=Read(stream); if(rows.Count<2)throw new InvalidOperationException("Το αρχείο δεν περιέχει δεδομένα.");
        string V(Dictionary<string,Cell> row,string c)=>row.GetValueOrDefault(c)?.Value.Trim()??"";
        if(kind=="product" && V(rows[0],"A")!="CODE" || kind=="recipe" && V(rows[0],"A")!="Κωδ.Συνταγής")throw new InvalidOperationException("Μη αναγνωρισμένη δομή εισαγωγής.");
        var result=new List<ImportRow>();
        for(var i=1;i<rows.Count;i++)
        {
            var row=rows[i];var key=V(row,"A");if(key.Length==0)throw new InvalidOperationException($"Λείπει ταυτότητα στη γραμμή {i+1}.");
            if(kind=="product")
            {
                string[] columns=["K","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","AA"];
                var p=new Product {SourceId=key,ErpCode=V(row,"B"),SecondaryCode=V(row,"C"),Barcode=V(row,"D"),CartonBarcode=V(row,"E"),Brands=V(row,"F").Split(';',StringSplitOptions.TrimEntries|StringSplitOptions.RemoveEmptyEntries),Active=V(row,"G")=="1",Daily=V(row,"H")=="1",DailyOrder=i,RecipeCode=V(row,"AB"),ShelfLife=int.TryParse(V(row,"AF"),out var days)?days:0,Frozen=V(row,"AL")=="ΚΤΨ",Names=Languages.Zip(columns).ToDictionary(x=>x.First,x=>V(row,x.Second)),Fields=new[]{"I","J","L","AC","AH","AI","AJ","AL","AM","AN","AO","AP","AQ","AR","AS","AT","AU","AV"}.ToDictionary(c=>V(rows[0],c),c=>V(row,c)),LegacyProduction=new[]{"AD","AE","AG","AK"}.ToDictionary(c=>V(rows[0],c),c=>V(row,c))};
                result.Add(new(kind,key,Json.Write(p),i+1));
            }
            else if(kind=="recipe")
            {
                string[] cols=["E","Y","AB","AE","AH","AK","AN","AQ","AT","AW","AZ","BC","BF","BI","BL","BO"];
                string Column(int n){var s="";while(n>0){n--;s=(char)('A'+n%26)+s;n/=26;}return s;}
                int Number(string c)=>c.Aggregate(0,(n,ch)=>n*26+ch-'A'+1);
                var r=new Recipe {Code=key,Name=V(row,"D"),Category=V(row,"B"),Family=V(row,"C"),OriginKey=V(row,"H"),SpecificationAsset="",Nutrition=Enumerable.Range(9,16).Select(Column).ToDictionary(c=>V(rows[0],c),c=>V(row,c)),Translations=Languages.Zip(cols).ToDictionary(x=>x.First,x=>new RecipeText(V(row,x.Second),V(row,Column(Number(x.Second)+1)),V(row,Column(Number(x.Second)+2)),row.GetValueOrDefault(x.Second)?.Runs))};
                result.Add(new(kind,key,Json.Write(r),i+1));
            }
            else throw new InvalidOperationException("Επιλέξτε προϊόντα ή συστάσεις.");
        }
        return result;
    }
}
public sealed class ImportService(AppDb db)
{
    public async Task<ImportReview> Stage(List<ImportRow> rows,string actor)
    {
        var issues=new List<ImportIssue>();
        foreach(var group in rows.GroupBy(r=>(r.Kind,r.Key)).Where(g=>g.Count()>1))issues.Add(new("error",group.Key.Kind,group.First().Row,group.Key.Key,"Διπλή ταυτότητα πηγής."));
        var records=await db.Records.Where(r=>!r.Archived).ToListAsync();
        var recipes=records.Where(r=>r.Kind=="recipe").Select(r=>r.Key).Concat(rows.Where(r=>r.Kind=="recipe").Select(r=>r.Key)).ToHashSet();
        foreach(var row in rows.Where(r=>r.Kind=="product"))
        {
            var p=Json.Read<Product>(row.Data);
            void Issue(string m)=>issues.Add(new("warning",row.Kind,row.Row,row.Key,m));
            if(!Rules.ErpPattern().IsMatch(p.ErpCode))issues.Add(new("error",row.Kind,row.Row,row.Key,"Μη έγκυρος κωδικός ERP."));
            if(!recipes.Contains(p.RecipeCode))Issue($"Λείπει σύσταση {p.RecipeCode}.");
            foreach(var l in p.Names.Where(n=>string.IsNullOrWhiteSpace(n.Value)))Issue($"Λείπει περιγραφή {l.Key}.");
            foreach(var b in p.Brands)if(!records.Any(r=>r.Kind=="brand"&&r.Key==b&&r.As<ReferenceData>().Complete))Issue($"Ανεπίλυτη επωνυμία {b}.");
        }
        foreach(var row in rows.Where(r=>r.Kind=="recipe")){var r=Json.Read<Recipe>(row.Data);if(!records.Any(x=>x.Kind=="reference"&&x.Key=="origin:"+r.OriginKey&&x.As<ReferenceData>().Complete))issues.Add(new("warning",row.Kind,row.Row,row.Key,$"Ανεπίλυτη προέλευση {r.OriginKey}."));}
        var batch=new ImportBatch{Actor=actor,Payload=Json.Write(rows),Issues=Json.Write(issues)};db.Imports.Add(batch);await db.SaveChangesAsync();
        return new(batch.Id,rows.Count(r=>r.Kind=="product"),rows.Count(r=>r.Kind=="recipe"),issues.ToArray(),false);
    }
    public async Task Commit(Guid id,string actor)
    {
        await using var tx=await db.Database.BeginTransactionAsync();
        var batch=await db.Imports.SingleAsync(b=>b.Id==id);
        if(batch.Committed)return;
        if(Json.Read<ImportIssue[]>(batch.Issues).Any(i=>i.Severity=="error"))throw new InvalidOperationException("Διορθώστε τα σφάλματα πριν από την εισαγωγή.");
        foreach(var row in Json.Read<ImportRow[]>(batch.Payload))
        {
            var existing=await db.Records.SingleOrDefaultAsync(r=>r.Kind==row.Kind&&r.Key==row.Key);
            if(existing is null)db.Records.Add(new(){Kind=row.Kind,Key=row.Key,Data=row.Data});
            else {existing.Data=row.Kind=="product"?Json.Write(Json.Read<Product>(row.Data) with{Butcher=existing.As<Product>().Butcher,SmallLabelWeight=existing.As<Product>().SmallLabelWeight}):row.Data;existing.Version++;existing.UpdatedAt=DateTimeOffset.UtcNow;}
        }
        batch.Committed=true;batch.Version++;
        db.Audits.Add(new(){Actor=actor,Action="import.commit",RecordId=id,Detail=batch.Payload});
        await db.SaveChangesAsync();await LegacyLabelSeed.ApplyRecipeEmphasis(db);await db.SaveChangesAsync();await tx.CommitAsync();
    }
}
