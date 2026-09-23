using SkiaSharp;

namespace Faethon;

public static class LabelFonts
{
    // Return an owned typeface, matching SKTypeface.FromFamilyName's caller contract.
    public static SKTypeface Resolve(string family, bool bold)
    {
        var face = SKTypeface.FromFamilyName(family, bold ? SKFontStyle.Bold : SKFontStyle.Normal);
        if (!family.Equals("Calibri", StringComparison.OrdinalIgnoreCase) ||
            (face is not null && face.FamilyName.Equals("Calibri", StringComparison.OrdinalIgnoreCase)))
            return face ?? throw new InvalidOperationException($"Font unavailable: {family}");
        face?.Dispose();
        var name = bold ? "Bold" : "Regular";
        using var stream = typeof(LabelFonts).Assembly.GetManifestResourceStream($"Faethon.Api.Fonts.Carlito-{name}.ttf")
            ?? throw new InvalidOperationException("Missing embedded Carlito font.");
        return SKTypeface.FromStream(stream) ?? throw new InvalidOperationException("Cannot load embedded Carlito font.");
    }
}
