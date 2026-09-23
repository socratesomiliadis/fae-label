namespace Faethon;

public static class ReferenceReports
{
    public sealed record Definition(string Key,string Report,string Title);
    public static readonly Definition[] Definitions=[
        new("list-shelf-life","LISTA_DIARKEIA_ZOHS_PROIONTON","Κατάλογος · διάρκεια ζωής προϊόντων"),
        new("list-instructions","LISTA_ODHGIES_XRHSHS","Κατάλογος · οδηγίες χρήσης"),
        new("list-abbreviations","LISTA_SYNTOMOGRAFIES","Κατάλογος · συντομογραφίες"),
        new("list-categories","LISTA_KATHGORION","Κατάλογος · κατηγορίες"),
        new("list-recipes","LISTA_SYNTAGON","Κατάλογος · συστάσεις"),
        new("list-families","LISTA_OIKOGENEIES","Κατάλογος · οικογένειες")];

    public static (string[] Headings,string[][] Rows) Resolve(string report,List<Record> records,DateOnly date,Dictionary<string,long> versions)
    {
        var result=new List<string[]>();
        Record[] Rows(string kind){var rows=records.Where(r=>r.Kind==kind).OrderBy(r=>r.Key,StringComparer.Ordinal).ToArray();foreach(var row in rows)versions[$"{row.Kind}:{row.Key}"]=row.Version;return rows;}
        if(report=="LISTA_DIARKEIA_ZOHS_PROIONTON")
        {
            foreach(var row in Rows("product")){var p=row.As<Product>();result.Add([row.Key,p.Names.GetValueOrDefault("el",""),p.ShelfLife.ToString(),date.AddDays(p.ShelfLife).ToString("dd/MM/yyyy")]);}
            return (["CODE","Προϊόν","Ημέρες","Λήξη από "+date.ToString("dd/MM/yyyy")],result.ToArray());
        }
        if(report=="LISTA_SYNTAGON")
        {
            foreach(var row in Rows("recipe")){var r=row.As<Recipe>();result.Add([r.Code,r.Name,r.Family,r.Category]);}
            return (["Κωδικός","Περιγραφή σύστασης","Οικογένεια","Κατηγορία"],result.ToArray());
        }
        var group=report switch{"LISTA_ODHGIES_XRHSHS"=>"instructions","LISTA_SYNTOMOGRAFIES"=>"abbreviation","LISTA_KATHGORION"=>"category","LISTA_OIKOGENEIES"=>"family",_=>""};
        if(group.Length==0)return ([],[]);
        foreach(var row in Rows("reference").Where(r=>r.As<ReferenceData>().Group==group))
        {
            var value=row.As<ReferenceData>();var code=row.Key.Split(':',2).Last();
            result.Add([code,value.Texts.GetValueOrDefault("el",value.Name==code?"":value.Name),value.Texts.GetValueOrDefault("en","")]);
        }
        return (["Κωδικός","Ελληνικά","English"],result.ToArray());
    }
}
