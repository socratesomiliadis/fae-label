namespace Faethon;

public sealed record LegacyReport(string Report,string Family,string Profile,string Brand,string Mode,string[] Languages,bool Logo);

public static class LegacyTemplates
{
    public static LegacyReport? Select(Template template,Production production,ReferenceData? brand)
    {
        if(template.LegacyReport.Length>0)
            return SharedLayout.Catalog.SingleOrDefault(r=>r.Report==template.LegacyReport);
        // Custom geometry is authoritative. Only built-in families opt into source variants.
        if(!SharedLayout.Layouts.ContainsKey(template.GeometryKey)&&template.GeometryKey is not ("sample-blank" or "butcher-a4"))return null;
        if(template.Family.StartsWith("certificate"))return SharedLayout.Catalog.SingleOrDefault(r=>r.Report==CertificateLayouts.Source(template.Family));
        var brandName=brand?.LegacyBrand;
        if(string.IsNullOrEmpty(brandName))brandName=production.BrandKey=="1"?"FAETHON":brand?.Name??production.BrandKey;
        var family=template.Family;
        var mode=family=="thermal"&&template.Profile=="small"?"product":production.Mode;
        if(family=="production")mode="blank";
        return SharedLayout.Catalog.FirstOrDefault(r=>r.Family==family&&(r.Profile==template.Profile||family=="butcher")&&r.Mode==mode&&r.Logo&&r.Languages.SequenceEqual(production.Languages)&&(r.Brand.Equals(brandName,StringComparison.OrdinalIgnoreCase)||family is "custom" or "address" or "production" or "sample" or "butcher"));
    }
}
