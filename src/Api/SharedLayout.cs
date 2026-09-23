using System.Globalization;
using System.Reflection;
using System.Text.RegularExpressions;
using SkiaSharp;
using SkiaSharp.HarfBuzz;
using ZXing;
namespace Faethon;

public sealed record Geometry(string Source,float WidthMm,float HeightMm,LayoutNode[] Nodes);
public sealed record LayoutNode(string Type,string Name,float X,float Y,float Width,float Height,string Font,float FontSize,bool Bold,bool Italic,int Align,string Binding,int Slot,string CaptionKey,string Image,string ImageName,bool Visible,long? Background,long Foreground,bool Border,bool Rich,string Caption="",string Section="",string Condition="",int FontWeight=0,bool Underline=false,long BorderColor=0,float BorderWidth=.12f,int SizeMode=3,int PictureAlignment=2,bool CanGrow=false,bool CanShrink=false,string Format="",int DecimalPlaces=255,float ImageDpiX=96,float ImageDpiY=96);
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
        foreach(var original in PaintOrder(layout!.Nodes))
        {
            var n=original;
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
            string text=n.Type is "TextBox" or "Label"?(caption.Length>0?caption:Resolve(b,lang,s,issues,n)):"";
            if(n.CanGrow||n.CanShrink)
            {
                using var measurePaint=new SKPaint();
                float available=GrowthLimit(n,layout.Nodes,s.Template.HeightMm);
                n=n with{Height=Math.Min(available,LabelText.Draw(null,text,n,measurePaint,[],available))};
            }
            if(n.Y+n.Height>s.Template.HeightMm+.5||n.X+n.Width>s.Template.WidthMm+.5){issues.Add("Η γεωμετρία του προτύπου υπερβαίνει τη σελίδα.");}
            using var paint=new SKPaint{Color=Color(n.Foreground),IsAntialias=true};
            if(n.Background.HasValue){using var bg=new SKPaint{Color=Color(n.Background.Value)};canvas.DrawRect(n.X,n.Y,n.Width,n.Height,bg);}
            if(n.Type=="Line"){using var line=new SKPaint{Color=Color(n.BorderColor),StrokeWidth=n.BorderWidth};canvas.DrawLine(n.X,n.Y,n.X+n.Width,n.Y+n.Height,line);continue;}
            if(n.Type is "Rectangle" or "OptionGroup"||n.Border){using var border=new SKPaint{Color=Color(n.BorderColor),Style=SKPaintStyle.Stroke,StrokeWidth=n.BorderWidth};canvas.DrawRect(n.X,n.Y,n.Width,n.Height,border);if(n.Type is "Rectangle" or "OptionGroup")continue;}
            if(n.Type=="Image")
            {
                if(!exact&&p.BrandKey!="1"&&n.ImageName.Contains("QR",StringComparison.OrdinalIgnoreCase))continue;
                if(!exact&&p.BrandKey!="1"&&string.IsNullOrEmpty(s.Brand?.LogoAsset)&&(n.ImageName.Contains("LOGO",StringComparison.OrdinalIgnoreCase)||n.ImageName.Contains("FAETHON",StringComparison.OrdinalIgnoreCase))){issues.Add("Δεν υπάρχει αντιστοίχιση λογοτύπου για την επωνυμία.");continue;}
                var hash=LogoHash(n,s.Brand);
                if(hash.Length==0){issues.Add("Λείπει εικόνα: "+n.ImageName);continue;}
                try{using var image=SKBitmap.Decode(assets.Read(hash));if(image!=null){DrawImage(canvas,image,n);}}
                catch(IOException){issues.Add("Λείπει αρχείο εικόνας: "+n.ImageName);}continue;
            }
            if(n.Type is not ("TextBox" or "Label"))continue;
            if(b.Contains("BARCODE"))
            {
                if(text.Length==0)continue;
                try{var barcode=new MultiFormatWriter().encode(text,s.Template.BarcodeFormat=="ean13"?BarcodeFormat.EAN_13:BarcodeFormat.CODE_39,0,0);float unit=n.Width/barcode.Width;using var bars=new SKPaint{Color=SKColors.Black,IsAntialias=false};for(int x=0;x<barcode.Width;x++)if(barcode[x,0])canvas.DrawRect(n.X+x*unit,n.Y,unit,n.Height*.75f,bars);Text(canvas,text,n with{Y=n.Y+n.Height*.76f,Height=n.Height*.24f,Font="Calibri",FontSize=4.5f,Align=2},paint,issues);}
                catch(ArgumentException){issues.Add("Μη έγκυρο barcode.");}continue;
            }
            if(DrawNutritionHeader(canvas,text,n,layout.Nodes,paint,issues))continue;
            LabelText.Draw(canvas,text,n,paint,issues,GrowthLimit(n,layout.Nodes,s.Template.HeightMm));
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
        foreach(var n in PaintOrder(nodes).Where(n=>n.Visible))
        {
            using var paint=new SKPaint{Color=Color(n.Foreground),IsAntialias=true};
            if(n.Background is {} color){using var bg=new SKPaint{Color=Color(color)};canvas.DrawRect(n.X,n.Y,n.Width,n.Height,bg);}
            using var rule=new SKPaint{Color=Color(n.BorderColor),Style=SKPaintStyle.Stroke,StrokeWidth=n.BorderWidth};
            if(n.Type=="Line"){canvas.DrawLine(n.X,n.Y,n.X+n.Width,n.Y+n.Height,rule);continue;}
            if(n.Type=="Rectangle"||n.Border)canvas.DrawRect(n.X,n.Y,n.Width,n.Height,rule);
            if(n.Type=="Image")
            {
                try{using var image=SKBitmap.Decode(assets.Read(n.Image));if(image is null){issues.Add("Μη έγκυρη εικόνα: "+n.ImageName);continue;}DrawImage(canvas,image,n);}
                catch(IOException){issues.Add("Λείπει αρχείο εικόνας: "+n.ImageName);}continue;
            }
            if(n.Type is "Label" or "TextBox")Text(canvas,n.Caption,n,paint,issues);
        }
    }
    private static SKColor Color(long value)=>value<0?SKColors.Black:new((byte)(value&255),(byte)((value>>8)&255),(byte)((value>>16)&255));
    private static string Resolve(string b,string lang,Snapshot s,List<string> issues,LayoutNode n)
    {
        var p=s.Production;var product=s.Product;var recipe=s.Recipe;
        string Date(DateOnly? d)=>d?.ToString(n.Format=="Long Date"?"D":"d/M/yyyy",n.Format=="Long Date"?CultureInfo.GetCultureInfo(lang):CultureInfo.InvariantCulture)??"";
        string Num(decimal? d)=>d?.ToString(n.Format=="Fixed"?"F"+(n.DecimalPlaces==255?2:Math.Clamp(n.DecimalPlaces,0,10)):"0.###",CultureInfo.InvariantCulture)??"";
        var rt=recipe?.Translations.GetValueOrDefault(lang);
        string Required(string value,string label){if(string.IsNullOrWhiteSpace(value))issues.Add("Συμπληρώστε το ειδικό πεδίο ετικέτας: "+label);return value;}
        var value=b switch
        {
            "EPONYMIES.EPONYMIA"=>BrandName(s.Brand,lang,issues),
            "EPONYMIES.STOIXEIA"=>s.Brand?.Texts.GetValueOrDefault(lang)??"",
            "EPONYMIES.SXOLIO1"=>s.Brand?.Manufacturer.GetValueOrDefault(lang)??"",
            "PROIONTA.PROION"=>s.Template.Family=="butcher"&&!string.IsNullOrWhiteSpace(p.FreeText)?p.FreeText:product?.Names.GetValueOrDefault(lang)??"",
            "SYNTAGES.SYSTATIKA" or "SYSTATIKA"=>Ingredients(rt,n.Rich),
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
    private static bool DrawNutritionHeader(SKCanvas canvas,string text,LayoutNode node,LayoutNode[] nodes,SKPaint paint,List<string> issues)
    {
        if(!text.Contains("NUTRITION FACTS"))return false;
        var captions=Regex.Split(text.Trim(),@"\s{4,}");
        var energy=nodes.FirstOrDefault(n=>n.Binding.Contains("ENERGEIA_ANA_100GR"));
        var ri=nodes.FirstOrDefault(n=>n.Binding.Contains("ENERGEIA_PPA"));
        if(captions.Length!=3||energy is null||ri is null)return false;
        float center=energy.X+energy.Width/2,riCenter=ri.X+ri.Width/2;
        float half=(riCenter-center)/2;
        if(half<=0)return false;
        // Align heading cells to their actual data columns, independent of spaces/font metrics.
        var cells=new[]{node with{Width=center-half-node.X,Align=1},
            node with{X=center-half,Width=half*2,Align=2},
            node with{X=riCenter-half,Width=Math.Min(half*2,node.X+node.Width-(riCenter-half)),Align=2}};
        for(int i=0;i<cells.Length;i++)LabelText.Draw(canvas,captions[i],cells[i],paint,issues,singleLine:true);
        return true;
    }
    private static void Text(SKCanvas canvas,string text,LayoutNode n,SKPaint paint,List<string> issues)
        =>LabelText.Draw(canvas,text,n,paint,issues);

    // Keep source stacking except for backed captions overlapped by opaque images.
    // Their legend must stay visible without moving every logo behind unrelated backgrounds.
    private static IEnumerable<LayoutNode> PaintOrder(IEnumerable<LayoutNode> nodes)
    {
        var all=nodes.ToArray();
        return all.OrderBy(n=>n.Type=="Label"&&n.Background.HasValue&&all.Any(image=>
            image.Visible&&image.Type=="Image"&&image.X<n.X+n.Width&&image.X+image.Width>n.X&&
            image.Y<n.Y+n.Height&&image.Y+image.Height>n.Y)?1:0);
    }

    public static string LogoHash(LayoutNode node,ReferenceData? brand)
    {
        if(!node.ImageName.Contains("LOGO",StringComparison.OrdinalIgnoreCase)||string.IsNullOrEmpty(brand?.LogoAsset))return node.Image;
        var seededLogo=LegacyLayouts["MEGALH_ETIKETA_FAETHON_GR_EN"].Nodes.First(n=>n.ImageName=="LOGO 4").Image;
        // LegacyAssets seeded LOGO 4 automatically. It is not an uploaded override.
        return brand.LogoAsset==seededLogo?node.Image:brand.LogoAsset;
    }
    public static string BrandName(ReferenceData? brand,string language,List<string> issues)
    {
        if(brand is null)return "";
        if(brand.Names.TryGetValue(language,out var name)&&!string.IsNullOrWhiteSpace(name))return name;
        if(language=="el")return brand.Name;
        issues.Add("Λείπει μετάφραση επωνυμίας " + language + ".");
        return "";
    }
    private static string Ingredients(RecipeText? text,bool rich)
    {
        if(text is null)return "";
        // Ignore stale Excel runs after an operator edits the ingredient text.
        if(!rich||text.Runs is not {Length:>0}||string.Concat(text.Runs.Select(r=>r.Text)).Trim()!=text.Ingredients.Trim())return text.Ingredients;
        return string.Concat(text.Runs.Select(r=>(r.Bold?"<b>":"")+(r.Italic?"<i>":"")+System.Net.WebUtility.HtmlEncode(r.Text)+(r.Italic?"</i>":"")+(r.Bold?"</b>":"")));
    }
    private static float GrowthLimit(LayoutNode node,IEnumerable<LayoutNode> nodes,float pageHeight)
    {
        if(!node.CanGrow)return node.Height;
        float bottom=nodes.Where(n=>n.Visible&&n.Name!=node.Name&&(n.Type is "TextBox" or "Label" or "Image")&&n.Y>=node.Y+node.Height-.1f&&n.X<node.X+node.Width&&n.X+n.Width>node.X)
            .Select(n=>n.Y).DefaultIfEmpty(pageHeight).Min();
        return Math.Max(node.Height,Math.Min(pageHeight,bottom)-node.Y);
    }
    private static void DrawImage(SKCanvas canvas,SKBitmap image,LayoutNode node)
    {
        float scale=Math.Min(node.Width/image.Width,node.Height/image.Height);
        float w=node.SizeMode==1?node.Width:node.SizeMode==0?image.Width*25.4f/node.ImageDpiX:image.Width*scale;
        float h=node.SizeMode==1?node.Height:node.SizeMode==0?image.Height*25.4f/node.ImageDpiY:image.Height*scale;
        float x=node.X+(node.Width-w)/2,y=node.Y+(node.Height-h)/2;
        canvas.Save();canvas.ClipRect(new(node.X,node.Y,node.X+node.Width,node.Y+node.Height));
        canvas.DrawBitmap(image,new SKRect(x,y,x+w,y+h));canvas.Restore();
    }
}
