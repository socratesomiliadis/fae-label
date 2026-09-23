using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using SkiaSharp;
using SkiaSharp.HarfBuzz;
using ZXing;
namespace Faethon;

public sealed record Rendered(byte[] Pdf, byte[] Png, string[] Issues,int PageCount=1);
public sealed class Rendering(AssetStore assets)
{
    public static bool ValidBarcode(string value,string format="code39")
    {
        if(format=="code39")return Regex.IsMatch(value,"^[0-9A-Z .$/+%-]+$");
        if(!Regex.IsMatch(value,"^[0-9]{13}$"))return false;
        return (10-Enumerable.Range(0,12).Sum(i=>(value[i]-'0')*(i%2==0?1:3))%10)%10==value[12]-'0';
    }
    public Rendered Render(Snapshot s)
    {
        var issues=new List<string>();
        var t=s.Template;
        if(t.WidthMm is < 20 or > 420||t.HeightMm is < 20 or > 420||t.FontSize is < 4 or > 24)throw new InvalidOperationException("Μη έγκυρες διαστάσεις ή μέγεθος γραμματοσειράς.");
        using var pdf=new MemoryStream();
        var pages=Pages(s);
        using(var document=SKDocument.CreatePdf(pdf)){foreach(var page in pages){var canvas=document.BeginPage(t.WidthMm*72/25.4f,t.HeightMm*72/25.4f);canvas.Scale(72/25.4f);Draw(canvas,page,issues);document.EndPage();}document.Close();}
        using var bitmap=new SKBitmap((int)Math.Ceiling(t.WidthMm*4),(int)Math.Ceiling(t.HeightMm*4));
        using(var canvas=new SKCanvas(bitmap)){canvas.Scale(4);Draw(canvas,pages[0],[]);}
        using var image=SKImage.FromBitmap(bitmap);using var png=image.Encode(SKEncodedImageFormat.Png,100);
        return new(pdf.ToArray(),png.ToArray(),issues.Distinct().ToArray(),pages.Length);
    }
    private void Draw(SKCanvas c,Snapshot s,List<string> issues)
    {
        if(s.Certificate is not null){CertificateLayouts.Draw(c,s,assets,issues);return;}
        if(s.Template.Family=="butcher"&&s.Template.Profile=="a4"&&s.Production.Mode!="blank"&&SharedLayout.LegacyLayouts.ContainsKey(s.Template.GeometryKey))
        {
            c.Clear(SKColors.White);
            for(var i=0;i<4;i++){c.Save();c.Translate(5,i*72+2);SharedLayout.Draw(c,s,assets,issues,clear:false);c.Restore();}return;
        }
        if((SharedLayout.LegacyLayouts.ContainsKey(s.Template.GeometryKey)||!(s.Production.Mode=="blank"&&s.Template.Family is "butcher" or "sample"))&&s.Template.GeometryKey.Length>0&&SharedLayout.Draw(c,s,assets,issues))return;
        c.Clear(SKColors.White);var t=s.Template;float w=t.WidthMm,h=t.HeightMm,m=2;
        using var face=SKTypeface.FromFamilyName("Arial");using var boldFace=SKTypeface.FromFamilyName("Arial",SKFontStyle.Bold);
        using var paint=new SKPaint{Color=SKColors.Black,IsAntialias=true};
        using var rule=new SKPaint{Color=SKColors.Black,IsAntialias=false,Style=SKPaintStyle.Stroke,StrokeWidth=.16f};
        string Clean(string value)=>System.Net.WebUtility.HtmlDecode(Regex.Replace(value,"<[^>]+>",""));
        float Text(string text,float x,float y,float width,float height,float size,bool bold=false)
        {
            using var font=new SKFont(bold?boldFace:face,size*25.4f/72);using var shaper=new SKShaper(font.Typeface);float line=font.Size*1.15f;
            var baseline=y+font.Size;var clean=Clean(text);var words=Regex.Split(clean,"(\\s+)");var current="";
            void Flush(){if(baseline>y+height+.01f){issues.Add("Το κείμενο υπερβαίνει το διαθέσιμο πλαίσιο. Απαιτείται προσαρμογή προτύπου.");return;}c.DrawShapedText(shaper,current.TrimEnd(),x,baseline,SKTextAlign.Left,font,paint);baseline+=line;current="";}
            foreach(var word in words){if(word.Contains('\n')){current+=word.Replace("\n","");Flush();continue;}if(font.MeasureText(current+word)>width&&current.Length>0)Flush();if(font.MeasureText(word)>width)issues.Add("Μη διασπώμενο κείμενο υπερβαίνει το πλαίσιο.");current+=word;}
            if(current.Length>0)Flush();return baseline-y;
        }
        void Box(float x,float y,float width,float height)=>c.DrawRect(x,y,width,height,rule);
        void Asset(string hash,float x,float y,float width,float height)
        {
            if(string.IsNullOrEmpty(hash))return;
            try{using var img=SKBitmap.Decode(assets.Read(hash));if(img is null){issues.Add("Μη έγκυρη εικόνα.");return;}float scale=Math.Min(width/img.Width,height/img.Height);c.DrawBitmap(img,new SKRect(x,y,x+img.Width*scale,y+img.Height*scale));}
            catch(IOException){issues.Add("Λείπει εικόνα προτύπου.");}
        }
        void Barcode(string value,float x,float y,float width,float height,bool qr=false)
        {
            if(value.Length==0)return;
            try{var matrix=new MultiFormatWriter().encode(value,qr?BarcodeFormat.QR_CODE:s.Template.BarcodeFormat=="ean13"?BarcodeFormat.EAN_13:BarcodeFormat.CODE_39,0,0);using var black=new SKPaint{Color=SKColors.Black,IsAntialias=false};float module=Math.Min(width/matrix.Width,qr?height/matrix.Height:width/matrix.Width);for(var by=0;by<matrix.Height;by++)for(var bx=0;bx<matrix.Width;bx++)if(matrix[bx,by])c.DrawRect(x+bx*module,y+by*(qr?module:height/matrix.Height),module,qr?module:height/matrix.Height,black);}catch(ArgumentException){issues.Add("Μη έγκυρα δεδομένα barcode/QR.");}
        }
        var p=s.Production;var langs=p.Languages;
        string H(string key,string? lang=null)=>s.Languages.GetValueOrDefault(lang??langs[0])?.Headings.GetValueOrDefault(key)??$"[{key}]";
        string Both(string key)=>string.Join(" / ",langs.Select(l=>H(key,l)));
        string Date(DateOnly? d)=>d?.ToString("d/M/yyyy",CultureInfo.InvariantCulture)??"";
        string Num(decimal? n)=>n?.ToString("0.###",CultureInfo.InvariantCulture)??"";
        if(t.Family=="reference-list")
        {
            Text(t.Name,8,8,w-16,10,14,true);
            if(s.ReferenceHeadings.Length==0){issues.Add("Επιλέξτε συγκεκριμένο κατάλογο αναφοράς.");return;}
            int count=s.ReferenceHeadings.Length;float[] widths=count==4?[25,100,28,w-169]:[25,85,w-126];
            float x=8;for(int col=0;col<count;col++){Text(s.ReferenceHeadings[col],x+1,23,widths[col]-2,13,8,true);x+=widths[col];}
            float y=38;
            foreach(var row in s.ReferenceRows){x=8;for(int col=0;col<count;col++){Box(x,y,widths[col],12);Text(row[col],x+1,y+1,widths[col]-2,10,8);x+=widths[col];}y+=12;}
            if(s.ReferenceRows.Length==0)Text("Δεν υπάρχουν εγγραφές.",8,40,w-16,10,10);
            Text($"{s.DocumentPage} / {s.DocumentPages}",8,h-10,w-16,6,9);return;
        }
        if(t.Family=="butcher"&&t.Profile=="a4")
        {
            for(int index=0;index<8;index++)
            {
                float x=5+index%2*100,y=5+index/2*71;
                Box(x,y,98,69);Asset(s.Brand?.LogoAsset??"",x+3,y+3,30,14);
                var title=p.FreeText.Length>0?p.FreeText:p.Mode=="blank"?"":s.Product?.Names.GetValueOrDefault(langs[0])??"";
                Text(title,x+3,y+23,92,22,12,true);
                Text("€/kg",x+73,y+4,22,8,12,true);
                Text(H("origin")+": "+(p.Mode=="blank"?"":s.Origins.GetValueOrDefault(langs[0])??""),x+3,y+49,92,10,8);
                Text(H("animal")+": "+p.AnimalCode,x+3,y+60,92,7,8);
            }
            return;
        }
        if(t.Family=="sample"&&p.Mode=="blank")
        {
            Asset(s.Brand?.LogoAsset??"",m,m,25,15);
            Text(Both("sample"),m,20,w-2*m,12,16,true);
            Text(p.FreeText,m,35,w-2*m,h-37,12);return;
        }
        if(t.Family is "custom" or "production" or "address" or "reference-list" || t.Family=="butcher"&&p.Mode=="blank")
        {
            Asset(s.Brand?.LogoAsset??"",m,m,25,15);
            var text=t.Family=="address"?$"{s.Customer?.Name}\n{s.Customer?.Address}\n{s.Customer?.City} {s.Customer?.Country}\n{s.Customer?.Vat}":p.FreeText;
            Text(text,m,20,w-2*m,h-22,Math.Max(9,t.FontSize));return;
        }
        float headerHeight=h*.17f;
        Asset(s.Brand?.LogoAsset??"",m,m,w*.2f,headerHeight-3);
        Text(s.Brand?.Name??"[ΕΠΩΝΥΜΙΑ]",w*.24f,m,w*.48f,6,t.FontSize+2,true);
        Text(string.Join("\n",langs.Select(l=>s.Brand?.Texts.GetValueOrDefault(l)??$"[{l}]")),w*.24f,m+5,w*.48f,headerHeight-7,t.FontSize-1);
        for(var i=0;i<t.ApprovalAssets.Length;i++)Asset(t.ApprovalAssets[i],w*.77f+i%2*10,m+i/2*8,10,8);
        Text(string.Join(" / ",langs.Select(l=>s.Product?.Names.GetValueOrDefault(l)??$"[{l}]")),m,headerHeight,w-2*m,10,t.FontSize+2,true);
        if(t.Family=="sample")Text(Both("sample"),m,headerHeight-5,w-2*m,5,t.FontSize+1,true);
        float top=headerHeight+10,bottom=h*.76f,bodyWidth=(w-2*m)/langs.Length;
        foreach(var (lang,index) in langs.Select((l,i)=>(l,i)))
        {
            float x=m+index*bodyWidth;var rt=s.Recipe?.Translations.GetValueOrDefault(lang);Box(x,top,bodyWidth,bottom-top);
            Text(H("ingredients",lang),x+1,top,bodyWidth-2,4,t.FontSize,true);
            var ingredients=rt?.Ingredients??"";
            Text(ingredients,x+1,top+4,bodyWidth-2,(bottom-top)*.38f,t.FontSize,rt?.Runs?.Any(r=>r.Bold)==true);
            float y=top+(bottom-top)*.46f;
            Text(rt?.Allergens??"",x+1,y,bodyWidth-2,7,t.FontSize,true);y+=8;
            Text(s.Origins.GetValueOrDefault(lang)??"",x+1,y,bodyWidth-2,6,t.FontSize,true);y+=7;
            Text(rt?.Nutrition??"",x+1,y,bodyWidth-2,(bottom-top)*.22f,t.FontSize-1);y=bottom-10;
            Text(s.Instructions.GetValueOrDefault(lang)??"",x+1,y,bodyWidth-2,9,t.FontSize-1);
        }
        float footer=bottom+1;
        Barcode(t.QrPayload,m,footer,10,10,true);
        float left=t.QrPayload.Length>0?m+12:m;
        var lines=new List<string>{$"{Both("production")}: {Date(p.ProductionDate)}"};
        if(s.Product?.Frozen==true)lines.Add($"{Both("freeze")}: {Date(p.FreezeDate)}");
        lines.Add($"{Both("expiry")}: {Date(p.Expiry)}");lines.Add($"{Both(p.Mode=="carton"?"carton":"weight")}: {Num(p.Mode=="carton"?p.CartonWeight:p.Weight)} kg");
        if(p.Mode=="carton")lines.Add($"{Both("pieces")}: {p.Pieces}");
        if(t.Family=="pallet")lines.Add($"{Both("pallet")}: {Num(p.PalletWeight)} kg");
        Text(string.Join("\n",lines),left,footer,w*.55f-left,h-footer-1,t.FontSize,true);
        float bx=w*.65f;var barcode=p.Mode=="carton"?s.Product?.CartonBarcode:s.Product?.Barcode;
        Text(s.Product?.ErpCode??"",bx,footer,w-bx-m,4,t.FontSize+1,true);
        Barcode(barcode??"",bx,footer+4,w-bx-m,7);
        Text(barcode??"",bx,footer+11,w-bx-m,3,t.FontSize-1);
        Text($"LOT: {s.Lot}",bx-8,footer+15,w-bx+8-m,5,t.FontSize,true);
        if(p.AnimalCode.Length>0)Text($"{p.AnimalCode} / {p.Slaughterhouse}",m,h-5,w*.55f,4,t.FontSize);
    }
    public byte[] Raster(Snapshot s,Printer printer)
    {
        if(Pages(s).Length>1)throw new InvalidOperationException("Το έγγραφο έχει πολλές σελίδες. Εκτυπώστε όλες τις σελίδες από το PDF.");
        var t=s.Template;var scale=printer.DotsPerMm;int width=(int)Math.Round(t.WidthMm*scale),height=(int)Math.Round(t.HeightMm*scale);
        using var bitmap=new SKBitmap(width,height);using(var canvas=new SKCanvas(bitmap)){canvas.Scale(scale);Draw(canvas,s,[]);}
        if(printer.Transport=="windows")
        {
            bool landscape=printer.Rotation is 90 or 270;
            float pageW=landscape?printer.HeightMm:printer.WidthMm,pageH=landscape?printer.WidthMm:printer.HeightMm;
            if(t.WidthMm+printer.OffsetX/scale>pageW+.1||t.HeightMm+printer.OffsetY/scale>pageH+.1)throw new InvalidOperationException("Η ετικέτα δεν χωρά στη ρύθμιση χαρτιού του εκτυπωτή.");
            float headWidth=landscape?t.HeightMm+printer.OffsetY/scale:t.WidthMm+printer.OffsetX/scale;
            if(headWidth>printer.PrintableWidthMm+.1)throw new InvalidOperationException("Το περιεχόμενο υπερβαίνει το εκτυπώσιμο πλάτος χωρίς κλιμάκωση.");
            using var img=SKImage.FromBitmap(bitmap);using var encoded=img.Encode(SKEncodedImageFormat.Png,100);return encoded.ToArray();
        }
        bool rotate=printer.Rotation is 90 or 270;
        using var output=new SKBitmap(rotate?height:width,rotate?width:height);
        using(var canvas=new SKCanvas(output)){canvas.Clear(SKColors.White);switch(printer.Rotation){case 90:canvas.Translate(height,0);canvas.RotateDegrees(90);break;case 180:canvas.Translate(width,height);canvas.RotateDegrees(180);break;case 270:canvas.Translate(0,width);canvas.RotateDegrees(270);break;}canvas.DrawBitmap(bitmap,0,0);}
        if(output.Width+printer.OffsetX>printer.PrintableWidthMm*scale+.5||output.Width+printer.OffsetX>printer.WidthMm*scale+.5||output.Height+printer.OffsetY>printer.HeightMm*scale+.5)throw new InvalidOperationException("Το περιεχόμενο δεν χωρά στο εκτυπώσιμο μέγεθος χωρίς κλιμάκωση.");
        int stride=(output.Width+7)/8;var packed=new byte[stride*output.Height];
        for(var y=0;y<output.Height;y++)for(var x=0;x<output.Width;x++){var color=output.GetPixel(x,y);if((color.Red*299+color.Green*587+color.Blue*114)/1000<128)packed[y*stride+x/8]|=(byte)(0x80>>(x%8));}
        return Encoding.ASCII.GetBytes($"^XA^PW{(int)Math.Round(printer.PrintableWidthMm*scale)}^LL{(int)Math.Round(printer.HeightMm*scale)}^FO{printer.OffsetX},{printer.OffsetY}^GFA,{packed.Length},{packed.Length},{stride},{Convert.ToHexString(packed)}^FS^PQ1^XZ");
    }
    private static Snapshot[] Pages(Snapshot s)
    {
        if(s.Certificate is not null)return CertificateLayouts.Pages(s);
        int capacity=s.Certificate is not null?Math.Max(1,(int)((s.Template.HeightMm-110)/19)):Math.Max(1,(int)((s.Template.HeightMm-55)/12));
        int rows=s.Certificate?.Lines.Length??s.ReferenceRows.Length;
        int count=Math.Max(1,(rows+capacity-1)/capacity);
        return Enumerable.Range(0,count).Select(i=>s with{DocumentPage=i+1,DocumentPages=count,ReferenceRows=s.ReferenceRows.Skip(i*capacity).Take(capacity).ToArray(),Certificate=s.Certificate is {} c?c with{Lines=c.Lines.Skip(i*capacity).Take(capacity).ToArray()}:null}).ToArray();
    }
}
