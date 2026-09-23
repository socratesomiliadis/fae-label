using SkiaSharp;

namespace Faethon;

public static class LabelFonts
{
    // Return an owned typeface, matching SKTypeface.FromFamilyName's caller contract.
    public static SKTypeface Resolve(string family, bool bold) => Resolve(family, bold ? 700 : 400, false);

    public static SKTypeface Resolve(string family, int weight, bool italic)
    {
        var face = SKTypeface.FromFamilyName(family, new SKFontStyle(weight, 5, italic ? SKFontStyleSlant.Italic : SKFontStyleSlant.Upright));
        if (!family.Equals("Calibri", StringComparison.OrdinalIgnoreCase) ||
            (face is not null && face.FamilyName.Equals("Calibri", StringComparison.OrdinalIgnoreCase) && (!italic || face.FontSlant != SKFontStyleSlant.Upright)))
            return face ?? throw new InvalidOperationException($"Font unavailable: {family}");
        face?.Dispose();
        var name = weight >= 700 ? (italic ? "BoldItalic" : "Bold") : (italic ? "Italic" : "Regular");
        using var stream = typeof(LabelFonts).Assembly.GetManifestResourceStream($"Faethon.Api.Fonts.Carlito-{name}.ttf")
            ?? throw new InvalidOperationException("Missing embedded Carlito font.");
        return SKTypeface.FromStream(stream) ?? throw new InvalidOperationException("Cannot load embedded Carlito font.");
    }
}
