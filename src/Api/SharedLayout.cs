using System.Globalization;
using System.Reflection;
using System.Text.RegularExpressions;
using SkiaSharp;
using SkiaSharp.HarfBuzz;
using ZXing;
namespace Faethon;

public sealed record Geometry(string Source,float WidthMm,float HeightMm,LayoutNode[] Nodes);
public sealed record LayoutNode(string Type,string Name,float X,float Y,float Width,float Height,string Font,float FontSize,bool Bold,bool Italic,int Align,string Binding,int Slot,string CaptionKey,string Image,string ImageName,bool Visible,long? Background,long Foreground,bool Border,bool Rich,string Caption="",string Section="",string Condition="");
public static class SharedLayout
{
    public static readonly Dictionary<string,Geometry> Layouts=Load<Dictionary<string,Geometry>>("layouts.json");
    public static readonly Dictionary<string,Dictionary<string,string>> Captions=Load<Dictionary<string,Dictionary<string,string>>>("captions.json");
    public static readonly Dictionary<string,Geometry> LegacyLayouts=Load<Dictionary<string,Geometry>>("legacy-layouts.json");
    public static readonly LegacyReport[] Catalog=Load<LegacyReport[]>("legacy-catalog.json");
    private static readonly Dictionary<string,string> SourceLanguages=new(){{"GR","el"},{"EN","en"},{"GE","de"},{"BG","bg"},{"RO","ro"},{"FR","fr"},{"IT","it"},{"ES","es"},{"PL","pl"},{"HL","nl"},{"PO","pt"},{"CH","cs"},{"SW","sv"},{"HU","hu"},{"CR","hr"},{"AL","sq"}};
    private static T Load<T>(string name){var assembly=Assembly.GetExecutingAssembly();using var stream=assembly.GetManifestResourceStream("Faethon.Api.Templates."+name)??throw new InvalidOperationException("Missing embedded layout "+name);using var reader=new StreamReader(stream);return Json.Read<T>(reader.ReadToEnd());}
    public static bool Draw(SKCanvas canvas,Snapshot s,AssetStore assets,List<string> issues,bool clear=true)
    {
        if(s.Template.Family=="reference-list")return false;
        string key=s.Template.GeometryKey;
        if(s.Production.Mode=="carton"&&Layouts.ContainsKey(key+":carton"))key+=":carton";
        bool exact=LegacyLayouts.TryGetValue(key,out var layout);
        if(!exact&&!Layouts.TryGetValue(key,out layout))return false;
        if(s.Certificate is not null)return false; // Certificate flow uses the paginated document renderer.
        if(clear)canvas.Clear(SKColors.White);
        var p=s.Production;bool beef=s.Recipe?.Family is "20" or "25" or "26" or "27";
        string L(LayoutNode n)=>p.Languages[Math.Min(n.Slot,p.Languages.Length-1)];
        foreach(var n in layout!.Nodes)
        {
            if(s.Template.Family=="butcher"&&s.Template.Profile=="small"&&n.X>=100)continue;
            if(n.Condition=="beef"&&!beef||n.Condition=="frozen"&&s.Product?.Frozen!=true)continue;
            if(!n.Visible||n.Width==0&&n.Type!="Line")continue;
            string lang=L(n);string raw=n.Binding;var suffix=Regex.Match(raw,"_(GR|EN|GE|BG|RO|FR|IT|ES|PL|HL|PO|CH|SW|HU|CR|AL)$");
            if(exact&&suffix.Success)lang=SourceLanguages[suffix.Groups[1].Value];
            string b=Regex.Replace(raw.Replace("_{lang}",""),"_(GR|EN|GE|BG|RO|FR|IT|ES|PL|HL|PO|CH|SW|HU|CR|AL)$","").ToUpperInvariant();
            if((b.Contains("KOD_ZWOY")||b.Contains("SFAGEIO"))&&!beef)continue;
            if(b.Contains("HMER_KATAPSIXHS")&&s.Product?.Frozen!=true)continue;
            string caption=n.Caption.Length>0?n.Caption:n.CaptionKey.Length>0?s.Languages.GetValueOrDefault(lang)?.Headings.GetValueOrDefault(n.CaptionKey)??Captions.GetValueOrDefault(lang)?.GetValueOrDefault(n.CaptionKey)??"":"";
            if(s.Template.Family=="custom"&&n.Name=="Ετικέτα37"&&!string.IsNullOrWhiteSpace(s.Brand?.Name))caption=s.Brand.Name;
            if(n.CaptionKey.Length>0&&caption.Length==0){issues.Add($"Λείπει μετάφραση επικεφαλίδας {lang}: {n.CaptionKey}");continue;}
            if(!beef&&(caption.Contains("Κωδ.Ζώου")||caption.Contains("Αρ.Εγκρ")||caption.Contains("Animal Code")||caption.Contains("Slaughterhouse")))continue;
            if(s.Product?.Frozen!=true&&(caption.Contains("Κατάψυξης")||caption.Contains("Freeze Date")))continue;
            if(n.Y+n.Height>s.Template.HeightMm+.5||n.X+n.Width>s.Template.WidthMm+.5){issues.Add("Η γεωμετρία του προτύπου υπερβαίνει τη σελίδα.");}
            using var paint=new SKPaint{Color=Color(n.Foreground),IsAntialias=true};
            if(n.Background.HasValue){using var bg=new SKPaint{Color=Color(n.Background.Value)};canvas.DrawRect(n.X,n.Y,n.Width,n.Height,bg);}
            if(n.Type=="Line"){using var line=new SKPaint{Color=SKColors.Black,StrokeWidth=.12f};canvas.DrawLine(n.X,n.Y,n.X+n.Width,n.Y+n.Height,line);continue;}
            if(n.Type is "Rectangle" or "OptionGroup"||n.Border){using var border=new SKPaint{Color=SKColors.Black,Style=SKPaintStyle.Stroke,StrokeWidth=.12f};canvas.DrawRect(n.X,n.Y,n.Width,n.Height,border);if(n.Type is "Rectangle" or "OptionGroup")continue;}
            if(n.Type=="Image")
            {
                if(!exact&&p.BrandKey!="1"&&n.ImageName.Contains("QR",StringComparison.OrdinalIgnoreCase))continue;
                if(!exact&&p.BrandKey!="1"&&string.IsNullOrEmpty(s.Brand?.LogoAsset)&&(n.ImageName.Contains("LOGO",StringComparison.OrdinalIgnoreCase)||n.ImageName.Contains("FAETHON",StringComparison.OrdinalIgnoreCase))){issues.Add("Δεν υπάρχει αντιστοίχιση λογοτύπου για την επωνυμία.");continue;}
                var hash=n.Image;
                if(n.ImageName.Contains("LOGO",StringComparison.OrdinalIgnoreCase)&&!string.IsNullOrEmpty(s.Brand?.LogoAsset))hash=s.Brand.LogoAsset;
                if(hash.Length==0){issues.Add("Λείπει εικόνα: "+n.ImageName);continue;}
                try{using var image=SKBitmap.Decode(assets.Read(hash));if(image!=null){float scale=Math.Min(n.Width/image.Width,n.Height/image.Height);float width=image.Width*scale,height=image.Height*scale;canvas.DrawBitmap(image,new SKRect(n.X+(n.Width-width)/2,n.Y+(n.Height-height)/2,n.X+(n.Width+width)/2,n.Y+(n.Height+height)/2));}}
                catch(IOException){issues.Add("Λείπει αρχείο εικόνας: "+n.ImageName);}continue;
            }
            if(n.Type is not ("TextBox" or "Label"))continue;
            string text=caption.Length>0?caption:Resolve(b,lang,s,issues);
            if(b.Contains("BARCODE"))
            {
                if(text.Length==0)continue;
                try{var barcode=new MultiFormatWriter().encode(text,s.Template.BarcodeFormat=="ean13"?BarcodeFormat.EAN_13:BarcodeFormat.CODE_39,0,0);float unit=n.Width/barcode.Width;using var bars=new SKPaint{Color=SKColors.Black,IsAntialias=false};for(int x=0;x<barcode.Width;x++)if(barcode[x,0])canvas.DrawRect(n.X+x*unit,n.Y,unit,n.Height*.75f,bars);Text(canvas,text,n with{Y=n.Y+n.Height*.76f,Height=n.Height*.24f,Font="Calibri",FontSize=4.5f,Align=2},paint,issues);}
                catch(ArgumentException){issues.Add("Μη έγκυρο barcode.");}continue;
            }
            Text(canvas,text,n,paint,issues);
        }
        if(exact&&s.Template.Family=="sample"&&p.Mode=="blank"&&!string.IsNullOrWhiteSpace(p.FreeText))
        {
            var label=layout.Nodes.FirstOrDefault(n=>n.Name=="Ετικέτα38");
            if(label!=null){using var paint=new SKPaint{Color=SKColors.Black,IsAntialias=true};Text(canvas,p.FreeText,label with{Name="Sample customer",X=20,Y=label.Y+label.Height+2,Width=75,Height=25,FontSize=11},paint,issues);}
        }
        return true;
    }
    public static void DrawDocumentNodes(SKCanvas canvas,IEnumerable<LayoutNode> nodes,AssetStore assets,List<string> issues)
    {
        foreach(var n in nodes.Where(n=>n.Visible))
        {
            using var paint=new SKPaint{Color=Color(n.Foreground),IsAntialias=true};
            if(n.Background is {} color){using var bg=new SKPaint{Color=Color(color)};canvas.DrawRect(n.X,n.Y,n.Width,n.Height,bg);}
            using var rule=new SKPaint{Color=SKColors.Black,Style=SKPaintStyle.Stroke,StrokeWidth=.15f};
            if(n.Type=="Line"){canvas.DrawLine(n.X,n.Y,n.X+n.Width,n.Y+n.Height,rule);continue;}
            if(n.Type=="Rectangle"||n.Border)canvas.DrawRect(n.X,n.Y,n.Width,n.Height,rule);
            if(n.Type=="Image")
            {
                try{using var image=SKBitmap.Decode(assets.Read(n.Image));if(image is null){issues.Add("Μη έγκυρη εικόνα: "+n.ImageName);continue;}float scale=Math.Min(n.Width/image.Width,n.Height/image.Height);float w=image.Width*scale,h=image.Height*scale;canvas.DrawBitmap(image,new SKRect(n.X+(n.Width-w)/2,n.Y+(n.Height-h)/2,n.X+(n.Width+w)/2,n.Y+(n.Height+h)/2));}
                catch(IOException){issues.Add("Λείπει αρχείο εικόνας: "+n.ImageName);}continue;
            }
            if(n.Type is "Label" or "TextBox")Text(canvas,n.Caption,n,paint,issues);
        }
    }
    private static SKColor Color(long value)=>value<0?SKColors.Black:new((byte)(value&255),(byte)((value>>8)&255),(byte)((value>>16)&255));
    private static string Resolve(string b,string lang,Snapshot s,List<string> issues)
    {
        var p=s.Production;var product=s.Product;var recipe=s.Recipe;
        string Date(DateOnly? d)=>d?.ToString("d/M/yyyy",CultureInfo.InvariantCulture)??"";
        string Num(decimal? d)=>d?.ToString("0.###",CultureInfo.InvariantCulture)??"";
        var rt=recipe?.Translations.GetValueOrDefault(lang);
        string Required(string value,string label){if(string.IsNullOrWhiteSpace(value))issues.Add("Συμπληρώστε το ειδικό πεδίο ετικέτας: "+label);return value;}
        var value=b switch
        {
            "EPONYMIES.EPONYMIA"=>s.Brand?.Name??"",
            "EPONYMIES.STOIXEIA"=>s.Brand?.Texts.GetValueOrDefault(lang)??"",
            "EPONYMIES.SXOLIO1"=>s.Brand?.Manufacturer.GetValueOrDefault(lang)??"",
            "PROIONTA.PROION"=>s.Template.Family=="butcher"&&!string.IsNullOrWhiteSpace(p.FreeText)?p.FreeText:product?.Names.GetValueOrDefault(lang)??"",
            "SYNTAGES.SYSTATIKA" or "SYSTATIKA"=>rt?.Ingredients??"",
            "SYNTAGES.ALLERGIOGONA"=>rt?.Allergens??"",
            "SYNTAGES.DIATHREPTIKH" or "DIATROFIKH"=>rt?.Nutrition??"",
            "EKTROFES.EKTROFH"=>s.Origins.GetValueOrDefault(lang)??"",
            "ODHGIES_XRHSHS.OD_XRHSHS" or "ODHGIES"=>s.Instructions.GetValueOrDefault(lang)??"",
            "PROIONTA.KOD_PROIONTOS"=>product?.ErpCode??"",
            "PROIONTA.CODE_IONIC"=>Required(p.CustomerProductCode,"κωδικός προϊόντος πελάτη (IONIC)"),
            "PROIONTA.ORIGIN_IONIC"=>Required(p.CustomerOrigin,"προέλευση πελάτη (IONIC)"),
            "HMER_SYSKEYASIAS"=>Required(Date(p.PackagingDate),"ημερομηνία συσκευασίας"),
            "SXOLIO"=>Required(p.LabelComment,"σχόλιο επωνυμίας / "+lang),
            "PROIONTA.KOD_ZWOY" or "CODE_ZOOY"=>p.AnimalCode,
            "PROIONTA.SFAGEIO"=>p.Slaughterhouse,
            "PROIONTA.HMER_PARAGOGHS"=>Date(p.ProductionDate),
            "PROIONTA.HMER_KATAPSIXHS"=>Date(p.FreezeDate),
            "ANALOSH" or "PROIONTA.ANALOSH_EOS"=>Date(p.Expiry),
            "LOT"=>s.Lot,
            "PROIONTA.BAROS"=>Num(s.Template.Profile=="small"&&p.Mode=="carton"?p.CartonWeight:p.Weight),
            "PROIONTA.BAROS_KIBOTIOY"=>Num(p.CartonWeight),
            "PROIONTA.TEM_KIB" or "PROIONTA.TEMAXIA_KIBOTIOY" or "PROIONTA.TEM_ANA_KIBOTIO"=>p.Pieces?.ToString()??"",
            "PROIONTA.BARCODE"=>p.Mode=="carton"?product?.CartonBarcode??"":product?.Barcode??"",
            "PROIONTA.BARCODE_KIBOTIOY"=>product?.CartonBarcode??"",
            "SYNTAGES.OIKOGENEIA"=>recipe?.Family??"",
            "PROIONTA.NOPO_KTPS" or "NOPO_KTPS.KATASTASH" or "NOPO_KTPS.KATASTASH_EN"=>s.Conditions.GetValueOrDefault(lang)??s.Languages.GetValueOrDefault(lang)?.Headings.GetValueOrDefault(product?.Frozen==true?"frozen":"fresh")??"",
            "SYSKEYASIES.SYSKEYASIA"=>s.Packaging.GetValueOrDefault(lang)??"",
            "KATHGORIES.PERIGRAFH_KATHGORIAS"=>s.Categories.GetValueOrDefault(lang)??"",
            "PROIONTA.PROMHTHEYTES"=>p.Supplier,
            "CUSTOM_LABEL.KEIMENO" or "KEIMENO" or "CUSTOM_TEXT" or "PERIGRAFH_ETIKETAS"=>p.FreeText,
            "PERIGRAFH"=>p.Mode=="blank"?"":p.FreeText.Length>0?p.FreeText:product?.Names.GetValueOrDefault(lang)??"",
            "DIAKR_TITLOS"=>s.Customer?.TradeName??"",
            "TK"=>s.Customer?.PostalCode??"",
            "THL1"=>s.Customer?.Phone??"",
            "PELATES.EPONYMIA" or "EPONYMIA"=>s.Customer?.Name??"",
            "PELATES.DIEYTHINSH" or "DIEYTHINSH" or "DIEYTHINSI"=>s.Customer?.Address??"",
            "PELATES.POLH" or "POLH"=>s.Customer?.City??"",
            "PELATES.XORA" or "XORA"=>s.Customer?.Country??"",
            "PELATES.AFM" or "AFM"=>s.Customer?.Vat??"",
            ""=>"",
            _=>null
        };
        if(value!=null)return value;
        var nutrient=b.Replace("SYNTAGES.","");var columns=new Dictionary<string,string>{{"ENERGEIA","Ενέργεια"},{"LIPARA","Λιπαρά"},{"KORESMENA","Κορεσμένα"},{"YDATANTHRAKES","Υδατάνθρακες"},{"SAKXARA","Σάκχαρα"},{"INES","Εδώδιμες Ίνες"},{"PROTEINES","Πρωτεϊνες"},{"ALATI","Αλάτι"}};
        foreach(var pair in columns)if(nutrient.StartsWith(pair.Key+"_")){var suffix=nutrient.EndsWith("PPA")?" %ΠΠΑ":" ανά 100gr";return recipe?.Nutrition.GetValueOrDefault(pair.Value+suffix)??"";}
        issues.Add("Απαιτείται αντιστοίχιση πεδίου προτύπου: "+b);return "";
    }
    private static void Text(SKCanvas canvas,string text,LayoutNode n,SKPaint paint,List<string> issues)
    {
        if(string.IsNullOrEmpty(text))return;
        using var typeface=SKTypeface.FromFamilyName(n.Font,n.Bold?SKFontStyle.Bold:SKFontStyle.Normal);
        // Coordinates are millimetres. Pixel hinting rounds these tiny logical sizes
        // before the canvas scale, making perfectly fitting source captions disappear.
        using var font=new SKFont(typeface,n.FontSize*25.4f/72){Subpixel=true,LinearMetrics=true,Hinting=SKFontHinting.None};using var shaper=new SKShaper(typeface);
        using var measureFont=new SKFont(typeface,font.Size*100){Subpixel=true,LinearMetrics=true,Hinting=SKFontHinting.None};
        float Measure(string value)=>measureFont.MeasureText(value)/100;
        text=System.Net.WebUtility.HtmlDecode(Regex.Replace(text,"<[^>]+>",""));
        float leading=font.Size*1.05f;float y=n.Y;var line="";
        bool overflow=false;
        void Flush(){var value=line.TrimEnd();float width=measureFont.MeasureText(value,out var bounds)/100;if(y+bounds.Height/100>n.Y+n.Height+.15f||width>n.Width+.15f){overflow=true;line="";return;}float x=n.X+(n.Align==2?(n.Width-width)/2:n.Align==3?n.Width-width:0);canvas.DrawShapedText(shaper,value,x,y-bounds.Top/100,SKTextAlign.Left,font,paint);y+=leading;line="";}
        foreach(var paragraph in text.Replace("\r","").Split('\n')){foreach(var word in Regex.Split(paragraph,"(?<=\\s)")){if(Measure((line+word).TrimEnd())>n.Width&&line.Length>0)Flush();line+=word;}if(line.Length>0)Flush();else y+=leading;}
        if(overflow)issues.Add("Υπερχείλιση κειμένου στο πεδίο "+n.Name+".");
    }
}
