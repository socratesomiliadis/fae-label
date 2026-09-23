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
    public Dictionary<string,string> Conditions { get; init; } = [];
    public string Lot { get; init; } = "";
    public string[] Issues { get; init; } = [];
    public Certificate? Certificate { get; init; }
    public Dictionary<Guid,Product> CertificateProducts { get; init; } = [];
    public Dictionary<Guid,Recipe> CertificateRecipes { get; init; } = [];
    public int CertificateLineOffset { get; init; }
    public int CertificatePart { get; init; }
    public string[][] ReferenceRows { get; init; } = [];
    public string[] ReferenceHeadings { get; init; } = [];
    public int DocumentPage { get; init; } = 1;
    public int DocumentPages { get; init; } = 1;
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
        var brand=Find("brand",p.BrandKey)?.As<ReferenceData>();
        var source=LegacyTemplates.Select(template,p,brand);
        if(source!=null)
        {
            if(!template.Family.StartsWith("certificate")&&!source.Languages.SequenceEqual(p.Languages))issues.Add("Οι γλώσσες δεν αντιστοιχούν στο επιλεγμένο πρότυπο.");
            if(template.Validated&&template.LegacyReport.Length==0&&SharedLayout.Layouts.GetValueOrDefault(template.GeometryKey)?.Source!=source.Report)
                issues.Add("Η παραλλαγή του προτύπου δεν έχει επικυρωθεί σε εκτυπωτή.");
            template=template with{GeometryKey=source.Report};
        }
        else if(template.Family=="thermal"&&template.Profile=="large"&&!p.Languages.SequenceEqual(new[]{"el","en"}))issues.Add("Δεν υπάρχει πρότυπο για αυτή την επωνυμία και τις γλώσσες (το βασικό απαιτεί ελληνικά και αγγλικά).");
        var langs=new Dictionary<string,Language>();
        foreach(var l in p.Languages){var lr=Find("language",l);if(lr is null||source is null&&!lr.As<Language>().Complete){issues.Add($"Δεν έχουν συμπληρωθεί οι επικεφαλίδες {l}.");}if(lr!=null)langs[l]=lr.As<Language>();}
        var pr=rows.SingleOrDefault(r=>r.Id==p.ProductId&&r.Kind=="product");var product=pr?.As<Product>();if(pr!=null)versions[$"product:{pr.Key}"]=pr.Version;
        var recipe=product is null?null:Find("recipe",product.RecipeCode)?.As<Recipe>();
        var origin=recipe is null?null:Find("reference","origin:"+recipe.OriginKey)?.As<ReferenceData>();
        var instruction=product is null?null:Find("reference","instructions:"+product.Fields.GetValueOrDefault("Οδηγίες Χρήσης","1"))?.As<ReferenceData>();
        var packaging=product is null?null:Find("reference","packaging:"+product.Fields.GetValueOrDefault("Συσκευασία Προϊόντος",""))?.As<ReferenceData>();
        var category=recipe is null?null:Find("reference","category:"+recipe.Category)?.As<ReferenceData>();
        var condition=product is null?null:Find("reference","condition:"+product.Fields.GetValueOrDefault("Κατάσταση Προϊόντος",product.Frozen?"ΚΤΨ":"ΝΩΠΟ"))?.As<ReferenceData>();
        var customer=rows.SingleOrDefault(r=>r.Id==p.CustomerId&&r.Kind=="customer")?.As<ReferenceData>();
        bool needsProduct=template.Family is "thermal" or "pallet" || template.Family is "sample" or "butcher" && p.Mode!="blank";
        if(template.Profile=="small"&&product?.SmallLabelWeight=="carton"&&template.Family=="thermal")p=p with{Mode="carton"};
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
                origins[l]=!string.IsNullOrWhiteSpace(brand?.Origins.GetValueOrDefault(l))?brand.Origins[l]:origin?.Texts.GetValueOrDefault(l)??"";
                instructions[l]=instruction?.Texts.GetValueOrDefault(l)??"";
                if(string.IsNullOrWhiteSpace(origins[l]))issues.Add($"Λείπει προέλευση {l}.");
                if(string.IsNullOrWhiteSpace(instructions[l]))issues.Add($"Λείπουν οδηγίες χρήσης {l}.");
                if(string.IsNullOrWhiteSpace(packaging?.Texts.GetValueOrDefault(l)))issues.Add($"Λείπει μετάφραση συσκευασίας {l}.");
                if(string.IsNullOrWhiteSpace(category?.Texts.GetValueOrDefault(l)))issues.Add($"Λείπει μετάφραση κατηγορίας {l}.");
                if(condition is not null&&product.Fields.GetValueOrDefault("Κατάσταση Προϊόντος","") is not ("" or "ΝΩΠΟ" or "ΚΤΨ")&&string.IsNullOrWhiteSpace(condition.Texts.GetValueOrDefault(l)))issues.Add($"Λείπει μετάφραση κατάστασης {l}.");
            }
            if(recipe?.Family is "20" or "25" or "26" or "27" && (string.IsNullOrWhiteSpace(p.AnimalCode)||string.IsNullOrWhiteSpace(p.Slaughterhouse)))issues.Add("Συμπληρώστε κωδικό ζώου και σφαγείο.");
            if(template.Family!="butcher"&&p.Mode=="carton" && (p.CartonWeight is null || template.Profile!="small"&&p.Pieces is null))issues.Add("Συμπληρώστε βάρος κιβωτίου και τεμάχια.");
            if(template.Family!="butcher"&&p.Mode!="carton"&&p.Weight is null)issues.Add("Συμπληρώστε βάρος προϊόντος.");
            var barcode=p.Mode=="carton"?product.CartonBarcode:product.Barcode;
            if(!Rendering.ValidBarcode(barcode,template.BarcodeFormat))issues.Add("Μη έγκυρο barcode για την επιλεγμένη συμβολογία.");
        }
        if(template.Family=="address"&&customer is null)issues.Add("Επιλέξτε πελάτη.");
        if(template.Family is "custom" or "production" && string.IsNullOrWhiteSpace(p.FreeText))issues.Add("Συμπληρώστε κείμενο.");
        string lot="";if(product!=null&&recipe!=null){try{lot=Rules.Lot(p.ProductionDate,recipe.Family,product.ErpCode,product.Frozen);}catch(InvalidOperationException e){issues.Add(e.Message);}}
        var reference=ReferenceReports.Resolve(template.LegacyReport,rows,p.ProductionDate,versions);
        if(template.Family=="reference-list"&&reference.Headings.Length==0)issues.Add("Επιλέξτε συγκεκριμένο κατάλογο αναφοράς.");
        return new(){Template=template,TemplateVersion=tr.Version,Versions=versions,Production=p,Product=product,Recipe=recipe,Brand=brand,Customer=customer,Languages=langs,Origins=origins,Instructions=instructions,Packaging=packaging?.Texts??[],Categories=category?.Texts??[],Conditions=condition?.Texts??[],Lot=lot,Issues=issues.Distinct().ToArray(),ReferenceRows=reference.Rows,ReferenceHeadings=reference.Headings};
    }
    public async Task<Snapshot> ResolveCertificate(Certificate c)
    {
        if(c.Lines.Length==0||c.Lines.Length>30)throw new InvalidOperationException("Προσθέστε 1–30 γραμμές πιστοποιητικού.");
        var s=await Resolve(new Production{TemplateKey=c.TemplateKey,Languages=c.Languages});var issues=s.Issues.ToList();
        var customer=await db.Records.SingleOrDefaultAsync(r=>r.Kind=="certificate-customer"&&r.Id==c.CustomerId&&!r.Archived);
        if(customer is null)issues.Add("Λείπει πελάτης πιστοποιητικού.");
        else s.Versions[$"certificate-customer:{customer.Key}"]=customer.Version;
        if(string.IsNullOrWhiteSpace(c.Vehicle))issues.Add("Λείπει όχημα.");
        var products=new Dictionary<Guid,Product>();
        foreach(var line in c.Lines){var row=await db.Records.SingleOrDefaultAsync(r=>r.Kind=="product"&&r.Id==line.ProductId&&!r.Archived);if(row is null){issues.Add("Λείπει προϊόν πιστοποιητικού.");continue;}var product=row.As<Product>();products[row.Id]=product;s.Versions[$"product:{row.Key}"]=row.Version;foreach(var l in c.Languages)if(string.IsNullOrWhiteSpace(product.Names.GetValueOrDefault(l)))issues.Add($"Λείπει περιγραφή {product.ErpCode} {l}.");if(line.Weight<=0||line.Cartons<0||line.ExpiryDate<line.ProductionDate||line.FreezeDate<line.ProductionDate||line.FreezeDate>line.ExpiryDate||string.IsNullOrWhiteSpace(line.Lot))issues.Add("Ελέγξτε βάρος, κιβώτια, LOT και ημερομηνίες πιστοποιητικού.");}
        var recipes=new Dictionary<Guid,Recipe>();
        foreach(var (id,product) in products)
        {
            var recipe=await db.Records.SingleOrDefaultAsync(r=>r.Kind=="recipe"&&r.Key==product.RecipeCode&&!r.Archived);
            if(recipe!=null){recipes[id]=recipe.As<Recipe>();s.Versions[$"recipe:{recipe.Key}"]=recipe.Version;}
        }
        var source=CertificateLayouts.Source(c.TemplateKey);
        if(source is null)throw new InvalidOperationException("Μη έγκυρο πρότυπο πιστοποιητικού.");
        if(c.TemplateKey=="certificate-bg"&&!c.Languages.SequenceEqual(new[]{"bg"})||c.TemplateKey=="certificate-conformance"&&!c.Languages.Contains("en"))issues.Add("Οι γλώσσες δεν αντιστοιχούν στο πιστοποιητικό (BG / EN).");
        return s with{Template=s.Template with{GeometryKey=source},Certificate=c,Customer=customer?.As<ReferenceData>(),CertificateProducts=products,CertificateRecipes=recipes,Issues=issues.Distinct().ToArray()};
    }
}
