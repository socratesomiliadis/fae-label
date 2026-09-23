using Microsoft.EntityFrameworkCore;
namespace Faethon;
public sealed record Snapshot
{
    public Template Template { get; init; } = new();
    public long TemplateVersion { get; init; }
    public Dictionary<string,long> Versions { get; init; } = [];
    public Production Production { get; init; } = new();
    public Product? Product { get; init; }
    public Recipe? Recipe { get; init; }
    public ReferenceData? Brand { get; init; }
    public ReferenceData? Customer { get; init; }
    public Dictionary<string,Language> Languages { get; init; } = [];
    public Dictionary<string,string> Origins { get; init; } = [];
    public Dictionary<string,string> Instructions { get; init; } = [];
    public Dictionary<string,string> Packaging { get; init; } = [];
    public Dictionary<string,string> Categories { get; init; } = [];
    public string Lot { get; init; } = "";
    public string[] Issues { get; init; } = [];
    public Certificate? Certificate { get; init; }
    public Dictionary<Guid,Product> CertificateProducts { get; init; } = [];
}
public sealed class Resolver(AppDb db)
{
    public async Task<Snapshot> Resolve(Production p)
    {
        Rules.ValidateProduction(p);
        var rows=await db.Records.Where(r=>!r.Archived).AsNoTracking().ToListAsync();
        var versions=new Dictionary<string,long>();
        Record? Find(string kind,string key){var r=rows.SingleOrDefault(r=>r.Kind==kind&&r.Key==key);if(r!=null)versions[$"{kind}:{key}"]=r.Version;return r;}
        var tr=Find("template",p.TemplateKey)??throw new InvalidOperationException("Δεν βρέθηκε πρότυπο.");var template=tr.As<Template>();
        var issues=new List<string>();
        if(!template.Validated)issues.Add("Το πρότυπο δεν έχει επικυρωθεί σε εκτυπωτή.");
        if(template.Profile=="small"&&p.Languages.Length!=1)issues.Add("Η μικρή ετικέτα απαιτεί μία γλώσσα.");
        var langs=new Dictionary<string,Language>();
        foreach(var l in p.Languages){var lr=Find("language",l);if(lr is null||!lr.As<Language>().Complete){issues.Add($"Δεν έχουν συμπληρωθεί οι επικεφαλίδες {l}.");}if(lr!=null)langs[l]=lr.As<Language>();}
        var pr=rows.SingleOrDefault(r=>r.Id==p.ProductId&&r.Kind=="product");var product=pr?.As<Product>();if(pr!=null)versions[$"product:{pr.Key}"]=pr.Version;
        var recipe=product is null?null:Find("recipe",product.RecipeCode)?.As<Recipe>();
        var brand=Find("brand",p.BrandKey)?.As<ReferenceData>();
        var origin=recipe is null?null:Find("reference","origin:"+recipe.OriginKey)?.As<ReferenceData>();
        var instruction=product is null?null:Find("reference","instructions:"+product.Fields.GetValueOrDefault("Οδηγίες Χρήσης","1"))?.As<ReferenceData>();
        var packaging=product is null?null:Find("reference","packaging:"+product.Fields.GetValueOrDefault("Συσκευασία Προϊόντος",""))?.As<ReferenceData>();
        var category=recipe is null?null:Find("reference","category:"+recipe.Category)?.As<ReferenceData>();
        var customer=rows.SingleOrDefault(r=>r.Id==p.CustomerId&&r.Kind=="customer")?.As<ReferenceData>();
        bool needsProduct=template.Family is "thermal" or "pallet" || template.Family is "sample" or "butcher" && p.Mode!="blank";
        if(needsProduct&&product is null)issues.Add("Επιλέξτε προϊόν.");
        var origins=new Dictionary<string,string>();var instructions=new Dictionary<string,string>();
        if(needsProduct&&product!=null)
        {
            if(!product.Active)issues.Add("Το προϊόν δεν είναι ενεργό.");
            if(recipe is null)issues.Add($"Λείπει η σύσταση {product.RecipeCode}.");
            if(!product.Brands.Contains(p.BrandKey))issues.Add("Η επωνυμία δεν έχει συνδεθεί με το προϊόν.");
            if(brand is null||!brand.Complete)issues.Add("Συμπληρώστε τα στοιχεία επωνυμίας.");
            if(!string.IsNullOrEmpty(brand?.LayoutProfile)&&brand.LayoutProfile!=template.Profile)issues.Add("Επιλέξτε το ειδικό προφίλ της επωνυμίας.");
            foreach(var l in p.Languages)
            {
                if(string.IsNullOrWhiteSpace(product.Names.GetValueOrDefault(l)))issues.Add($"Λείπει περιγραφή προϊόντος {l}.");
                if(recipe is null||!recipe.Translations.TryGetValue(l,out var rt)||string.IsNullOrWhiteSpace(rt.Ingredients))issues.Add($"Λείπει σύσταση {l}.");
                if(brand?.Texts.TryGetValue(l,out var contact)!=true||string.IsNullOrWhiteSpace(contact))issues.Add($"Λείπουν στοιχεία επωνυμίας {l}.");
                origins[l]=brand?.Origins.GetValueOrDefault(l)??origin?.Texts.GetValueOrDefault(l)??"";
                instructions[l]=instruction?.Texts.GetValueOrDefault(l)??"";
                if(string.IsNullOrWhiteSpace(origins[l]))issues.Add($"Λείπει προέλευση {l}.");
                if(string.IsNullOrWhiteSpace(instructions[l]))issues.Add($"Λείπουν οδηγίες χρήσης {l}.");
                if(string.IsNullOrWhiteSpace(packaging?.Texts.GetValueOrDefault(l)))issues.Add($"Λείπει μετάφραση συσκευασίας {l}.");
                if(string.IsNullOrWhiteSpace(category?.Texts.GetValueOrDefault(l)))issues.Add($"Λείπει μετάφραση κατηγορίας {l}.");
            }
            if(recipe?.Family is "20" or "25" or "26" or "27" && (string.IsNullOrWhiteSpace(p.AnimalCode)||string.IsNullOrWhiteSpace(p.Slaughterhouse)))issues.Add("Συμπληρώστε κωδικό ζώου και σφαγείο.");
            if(p.Mode=="carton" && (p.CartonWeight is null || p.Pieces is null))issues.Add("Συμπληρώστε βάρος κιβωτίου και τεμάχια.");
            if(p.Mode!="carton"&&p.Weight is null)issues.Add("Συμπληρώστε βάρος προϊόντος.");
            var barcode=p.Mode=="carton"?product.CartonBarcode:product.Barcode;
            if(!Rendering.ValidBarcode(barcode,template.BarcodeFormat))issues.Add("Μη έγκυρο barcode για την επιλεγμένη συμβολογία.");
        }
        if(template.Family=="address"&&customer is null)issues.Add("Επιλέξτε πελάτη.");
        if(template.Family is "custom" or "production" && string.IsNullOrWhiteSpace(p.FreeText))issues.Add("Συμπληρώστε κείμενο.");
        string lot="";if(product!=null&&recipe!=null){try{lot=Rules.Lot(p.ProductionDate,recipe.Family,product.ErpCode,product.Frozen);}catch(InvalidOperationException e){issues.Add(e.Message);}}
        return new(){Template=template,TemplateVersion=tr.Version,Versions=versions,Production=p,Product=product,Recipe=recipe,Brand=brand,Customer=customer,Languages=langs,Origins=origins,Instructions=instructions,Packaging=packaging?.Texts??[],Categories=category?.Texts??[],Lot=lot,Issues=issues.Distinct().ToArray()};
    }
    public async Task<Snapshot> ResolveCertificate(Certificate c)
    {
        if(c.Lines.Length==0||c.Lines.Length>30)throw new InvalidOperationException("Προσθέστε 1–30 γραμμές πιστοποιητικού.");
        var s=await Resolve(new Production{TemplateKey=c.TemplateKey,Languages=c.Languages});var issues=s.Issues.ToList();
        var customer=await db.Records.SingleOrDefaultAsync(r=>r.Kind=="certificate-customer"&&r.Id==c.CustomerId&&!r.Archived);
        if(customer is null)issues.Add("Λείπει πελάτης πιστοποιητικού.");
        if(string.IsNullOrWhiteSpace(c.Vehicle))issues.Add("Λείπει όχημα.");
        var products=new Dictionary<Guid,Product>();
        foreach(var line in c.Lines){var row=await db.Records.SingleOrDefaultAsync(r=>r.Kind=="product"&&r.Id==line.ProductId&&!r.Archived);if(row is null){issues.Add("Λείπει προϊόν πιστοποιητικού.");continue;}var product=row.As<Product>();products[row.Id]=product;foreach(var l in c.Languages)if(string.IsNullOrWhiteSpace(product.Names.GetValueOrDefault(l)))issues.Add($"Λείπει περιγραφή {product.ErpCode} {l}.");if(line.Weight<=0||line.ExpiryDate<line.ProductionDate||string.IsNullOrWhiteSpace(line.Lot))issues.Add("Ελέγξτε βάρος, LOT και ημερομηνίες πιστοποιητικού.");}
        return s with{Certificate=c,Customer=customer?.As<ReferenceData>(),CertificateProducts=products,Issues=issues.Distinct().ToArray()};
    }
}
