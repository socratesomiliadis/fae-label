namespace Faethon;

// The same recovered catalog drives the output choices in the web workspace.
public static class LabelCompatibility
{
    private static readonly string[] Builtins = ["thermal-large", "thermal-small", "pallet-a4", "sample-small", "sample-blank", "custom-small", "custom-large", "address-small", "production-small", "butcher-small", "butcher-a4"];
    public static bool Supports(Template t, Production p, ReferenceData? brand)
    {
        if (t.Family.StartsWith("certificate") || t.Family == "reference-list") return true;
        var independent = t.Family is "custom" or "address" or "production" or "sample" or "butcher";
        var brandName = !string.IsNullOrEmpty(brand?.LegacyBrand) ? brand.LegacyBrand : p.BrandKey == "1" ? "FAETHON" : brand?.Name ?? p.BrandKey;
        var newBrand = t.Family is "thermal" or "pallet" && !SharedLayout.Catalog.Any(r => r.Brand.Equals(brandName, StringComparison.OrdinalIgnoreCase));
        if (t.LegacyReport.Length > 0 || !newBrand && (Builtins.Contains(t.GeometryKey) || SharedLayout.Catalog.Any(r => r.Report == t.GeometryKey)))
        {
            return SharedLayout.Catalog.Any(r =>
                (t.LegacyReport.Length > 0 ? r.Report == t.LegacyReport : r.Logo && (r.Profile == t.Profile || t.Family == "butcher")) &&
                r.Family == t.Family && (independent || r.Brand.Equals(brandName, StringComparison.OrdinalIgnoreCase)) &&
                r.Mode == (t.Family == "thermal" && t.Profile == "small" ? "product" : p.Mode) &&
                // Small carton weight uses the product layout; it is not a second report mode.
                (t.Family != "thermal" || t.Profile != "small" || p.Mode is "product" or "carton") &&
                (t.Family != "sample" || t.LegacyReport.Length > 0 || r.Mode == (t.GeometryKey == "sample-blank" ? "blank" : "product")) &&
                r.Languages.SequenceEqual(p.Languages));
        }
        if (t.Family is "pallet" || t.Family == "thermal" && t.Profile == "large")
            return (p.Mode == "product" || t.Family == "thermal" && p.Mode == "carton") && p.Languages.SequenceEqual(new[] { "el", "en" });
        return p.Languages.Length == 1 && (p.Mode == "product" && t.Family != "production" || p.Mode == "blank" && t.Family is "production" or "butcher");
    }
}
