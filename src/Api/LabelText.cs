using System.Net;
using System.Globalization;
using System.Text.RegularExpressions;
using SkiaSharp;
using SkiaSharp.HarfBuzz;

namespace Faethon;

// Shape, measure and draw at the same enlarged logical size. Scaling only the
// canvas avoids the subpixel rounding that cut glyphs off at millimetre sizes.
public static class LabelText
{
    public sealed record Run(string Text, int Weight, bool Italic, bool Underline);
    public static string FormatValue(string text, LayoutNode node)
    {
        if(node.Format=="Fixed"&&decimal.TryParse(text,NumberStyles.Number,CultureInfo.InvariantCulture,out var number))
            return number.ToString("F"+(node.DecimalPlaces==255?2:Math.Clamp(node.DecimalPlaces,0,10)),CultureInfo.GetCultureInfo("el-GR"));
        return text;
    }
    public static Run[] Parse(string text, LayoutNode node)
    {
        int weight = node.FontWeight > 0 ? node.FontWeight : node.Bold ? 700 : 400;
        var root = new Run("", weight, node.Italic, node.Underline);
        var style = root;
        var stack = new Stack<(string Tag, Run Style)>();
        var runs = new List<Run>();
        void Add(string value) { if (value.Length > 0) runs.Add(style with { Text = value }); }
        if (!node.Rich) return [root with { Text = WebUtility.HtmlDecode(text).Replace("\r", "") }];
        foreach (var part in Regex.Split(text, "(<[^>]*>)"))
        {
            if (!part.StartsWith('<') || !part.EndsWith('>')) { Add(WebUtility.HtmlDecode(part).Replace("\r", "")); continue; }
            var match = Regex.Match(part, @"^<\s*(/?)\s*([\w]+)");
            if (!match.Success) { Add(part); continue; }
            string tag = match.Groups[2].Value.ToLowerInvariant();
            bool close = match.Groups[1].Value.Length > 0;
            if (tag == "br") { Add("\n"); continue; }
            if (tag is "p" or "div" or "li")
            {
                if (runs.Count > 0 && !runs[^1].Text.EndsWith('\n')) Add("\n");
            }
            if (close)
            {
                if (stack.Any(s => s.Tag == tag))
                    while (stack.Count > 0) { var previous = stack.Pop(); style = previous.Style; if (previous.Tag == tag) break; }
                continue;
            }
            stack.Push((tag, style));
            if (tag is "b" or "strong" || Regex.IsMatch(part, @"font-weight\s*:\s*(bold|[7-9]00)", RegexOptions.IgnoreCase)) style = style with { Weight = 700 };
            if (tag is "i" or "em" || Regex.IsMatch(part, @"font-style\s*:\s*italic", RegexOptions.IgnoreCase)) style = style with { Italic = true };
            if (tag == "u" || Regex.IsMatch(part, @"text-decoration\s*:\s*underline", RegexOptions.IgnoreCase)) style = style with { Underline = true };
        }
        while (runs.Count > 0 && runs[^1].Text == "\n") runs.RemoveAt(runs.Count - 1);
        return runs.ToArray();
    }

    private sealed class Face : IDisposable
    {
        public SKTypeface Typeface { get; }
        public SKFont Font { get; }
        public SKShaper Shaper { get; }
        public Face(string family, Run run, float size)
        {
            Typeface = LabelFonts.Resolve(family, run.Weight, run.Italic);
            Font = new(Typeface, size) { Subpixel = true, LinearMetrics = true, Hinting = SKFontHinting.None };
            Shaper = new(Typeface);
        }
        public float Width(string text) => Shaper.Shape(text, Font).Width;
        public void Dispose() { Shaper.Dispose(); Font.Dispose(); Typeface.Dispose(); }
    }
    private sealed record Piece(Run Run, string Text, float Width);
    private sealed record Line(List<Piece> Pieces, bool ParagraphEnd);

    public static float Draw(SKCanvas? canvas, string text, LayoutNode node, SKPaint paint, List<string> issues, float? availableHeight = null, bool singleLine = false)
    {
        if (string.IsNullOrEmpty(text)) return node.CanShrink ? 0 : node.Height;
        var runs = Parse(FormatValue(text,node), node);
        var faces = new Dictionary<(int, bool), Face>();
        float size = node.FontSize * 25.4f / 72 * 100;
        Face Get(Run r)
        {
            var key = (r.Weight, r.Italic);
            if (!faces.TryGetValue(key, out var face)) faces[key] = face = new(node.Font, r, size);
            return face;
        }
        try
        {
            float width = node.Width * 100;
            var lines = new List<Line>(); var pieces = new List<Piece>(); float used = 0;
            void Flush(bool paragraphEnd)
            {
                while (pieces.Count > 0 && string.IsNullOrWhiteSpace(pieces[^1].Text)) pieces.RemoveAt(pieces.Count - 1);
                lines.Add(new(pieces, paragraphEnd)); pieces = []; used = 0;
            }
            foreach (var run in runs)
            foreach (var token in Regex.Matches(run.Text, @"\n|[^\S\n]+|[^\s]+", RegexOptions.None).Select(m => m.Value))
            {
                if (token == "\n") { Flush(true); continue; }
                var w = Get(run).Width(token);
                if (!singleLine && used + w > width + .1f && pieces.Count > 0 && !string.IsNullOrWhiteSpace(token)) Flush(false);
                if (pieces.Count == 0 && string.IsNullOrWhiteSpace(token)) continue;
                // Long identifiers are retained. Overflow is reported below instead of dropping the whole line.
                pieces.Add(new(run, token, w)); used += w;
            }
            if (pieces.Count > 0) Flush(true);
            if (lines.Count == 0) return node.CanShrink ? 0 : node.Height;
            float ascent = faces.Values.Max(f => -f.Font.Metrics.Ascent);
            float descent = faces.Values.Max(f => f.Font.Metrics.Descent);
            float leading = Math.Max(size * 1.05f, ascent + descent);
            // Font metrics provide one stable baseline; actual ink bounds determine
            // whether the final descender fits, without reserving unused line spacing.
            float lastBottom = 0;
            foreach (var piece in lines[^1].Pieces)
            {
                Get(piece.Run).Font.MeasureText(piece.Text, out var bounds);
                lastBottom = Math.Max(lastBottom, bounds.Bottom);
            }
            float height = ascent + (lines.Count - 1) * leading + lastBottom;
            float limit = (node.CanGrow ? Math.Max(node.Height, availableHeight ?? node.Height) : node.Height) * 100;
            float widest = lines.Max(l => l.Pieces.Sum(p => p.Width));
            // Small metric differences may need a modest fit. Never silently shrink
            // genuinely overfull ingredients to unreadable type.
            float fit = Math.Min(1, Math.Min(limit / Math.Max(height, 1), width / Math.Max(widest, 1)));
            bool overflow = fit < (singleLine ? .7f : .85f);
            float scale = overflow ? 1 : fit;
            if (overflow) issues.Add("Υπερχείλιση κειμένου στο πεδίο " + node.Name + ".");
            float actualHeight = height * scale / 100;
            if(canvas is null)return node.CanShrink ? actualHeight : Math.Max(node.Height, actualHeight);
            canvas.Save();
            canvas.ClipRect(new(node.X, node.Y, node.X + node.Width, node.Y + limit / 100));
            canvas.Translate(node.X, node.Y);
            canvas.Scale(scale / 100);
            float lineWidth = width / scale;
            for (int i = 0; i < lines.Count; i++)
            {
                var line = lines[i]; float measured = line.Pieces.Sum(p => p.Width);
                float x = node.Align == 2 ? (lineWidth - measured) / 2 : node.Align == 3 ? lineWidth - measured : 0;
                int gaps = line.Pieces.Count(p => string.IsNullOrWhiteSpace(p.Text));
                float extra = node.Align == 4 && !line.ParagraphEnd && gaps > 0 ? Math.Max(0, lineWidth - measured) / gaps : 0;
                float baseline = ascent + i * leading;
                foreach (var piece in line.Pieces)
                {
                    var face = Get(piece.Run);
                    canvas.DrawShapedText(face.Shaper, piece.Text, x, baseline, SKTextAlign.Left, face.Font, paint);
                    if (piece.Run.Underline)
                    {
                        using var rule = new SKPaint { Color = paint.Color, StrokeWidth = Math.Max(size / 18, 1), IsAntialias = true };
                        canvas.DrawLine(x, baseline + descent * .5f, x + piece.Width, baseline + descent * .5f, rule);
                    }
                    x += piece.Width + (string.IsNullOrWhiteSpace(piece.Text) ? extra : 0);
                }
            }
            canvas.Restore();
            return node.CanShrink ? actualHeight : Math.Max(node.Height, actualHeight);
        }
        finally { foreach (var face in faces.Values) face.Dispose(); }
    }
}
