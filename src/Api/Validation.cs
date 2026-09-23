using System.Text.Json;
namespace Faethon;
public static class Validation
{
    public static readonly HashSet<string> Kinds=["product","recipe","brand","reference","language","template","printer","customer","certificate-customer","vehicle","draft","certificate"];
    public static string Check(string kind,JsonElement data)
    {
        if(!Kinds.Contains(kind))throw new InvalidOperationException("Μη έγκυρος τύπος εγγραφής.");
        string raw=data.GetRawText();if(raw.Length>1_000_000)throw new InvalidOperationException("Υπερβολικά μεγάλη εγγραφή.");
        switch(kind)
        {
            case "product":var p=Json.Read<Product>(raw);
                if(!Rules.ErpPattern().IsMatch(p.ErpCode)||p.ShelfLife is <0 or >9999||string.IsNullOrWhiteSpace(p.Names.GetValueOrDefault("el")))throw new InvalidOperationException("Ελέγξτε κωδικό ERP, ημέρες λήξης και ελληνική περιγραφή.");
                if(string.IsNullOrWhiteSpace(p.Barcode)||string.IsNullOrWhiteSpace(p.CartonBarcode)||string.IsNullOrWhiteSpace(p.RecipeCode)||p.Brands.Length==0)throw new InvalidOperationException("Συμπληρώστε barcode προϊόντος και κιβωτίου, σύσταση και επωνυμία.");
                if(p.SmallLabelWeight is not ("product" or "carton"))throw new InvalidOperationException("Επιλέξτε βάρος προϊόντος ή κιβωτίου.");
                string[] fields=["Συντομογραφία","Συσκευασία Προϊόντος","Κατάσταση Συσκ.","Τμήμα Παραγωγής","Οδηγίες Χρήσης","Κωδ. Intrastat","ΕΛΟΓΑΚ"];
                var missing=fields.Where(f=>string.IsNullOrWhiteSpace(p.Fields.GetValueOrDefault(f))).ToArray();
                if(missing.Length>0)throw new InvalidOperationException("Συμπληρώστε: "+string.Join(", ",missing));
                if(p.Fields.TryGetValue("Κωδ. Intrastat",out var intrastat)&&intrastat.Length>0&&!System.Text.RegularExpressions.Regex.IsMatch(intrastat,"^[0-9]{5,10}$"))throw new InvalidOperationException("Ο Intrastat πρέπει να έχει 5–10 ψηφία.");
                break;
            case "recipe":var r=Json.Read<Recipe>(raw);if(string.IsNullOrWhiteSpace(r.Code)||string.IsNullOrWhiteSpace(r.Name))throw new InvalidOperationException("Απαιτείται κωδικός και περιγραφή σύστασης.");break;
            case "draft":Rules.ValidateProduction(Json.Read<Production>(raw));break;
            case "printer":var pr=Json.Read<Printer>(raw);if(pr.Dpi is <100 or >1200||pr.DotsPerMm is <3 or >48||pr.WidthMm is <20 or >420||pr.HeightMm is <20 or >420||pr.PrintableWidthMm>pr.WidthMm+4||pr.OffsetX<0||pr.OffsetY<0||pr.Rotation is not (0 or 90 or 180 or 270)||pr.Transport is not ("zpl" or "windows"))throw new InvalidOperationException("Μη έγκυρη ρύθμιση εκτυπωτή.");break;
            case "template":var t=Json.Read<Template>(raw);if(t.WidthMm is <20 or >420||t.HeightMm is <20 or >420||t.FontSize is <4 or >24)throw new InvalidOperationException("Μη έγκυρες διαστάσεις προτύπου.");if(t.Validated&&string.IsNullOrWhiteSpace(t.ValidationNote))throw new InvalidOperationException("Καταγράψτε τη δοκιμή επικύρωσης.");break;
            case "language":var l=Json.Read<Language>(raw);string[] required=["ingredients","allergens","nutrition","origin","instructions","production","freeze","expiry","weight","carton","pieces","pallet","condition","frozen","fresh","packaging","animal","slaughterhouse","supplier","sample","certificate"];if(l.Complete&&required.Any(k=>string.IsNullOrWhiteSpace(l.Headings.GetValueOrDefault(k))))throw new InvalidOperationException("Συμπληρώστε όλες τις επικεφαλίδες γλώσσας.");break;
        }
        return raw;
    }
}
