using System.Globalization;
using System.Text.RegularExpressions;
using SkiaSharp;

namespace Faethon;

// Access coordinates are relative to each section, not the printed page.
// Keep source copy/artwork; reflow narrow table cells and honor the BG page break.
public static class CertificateLayouts
{
    public static string? Source(string key)=>key switch{"certificate-bg"=>"PISTOPOIHTIKA_BG","certificate-conformance"=>"CERTIFICATE_OF_CONFORMANCE_FULL",_=>null};
    public static Snapshot[] Pages(Snapshot s)
    {
        var certificate=s.Certificate!;
        if(certificate.TemplateKey=="certificate-bg")
        {
            int count=certificate.Lines.Length*2;
            return certificate.Lines.SelectMany((line,i)=>Enumerable.Range(0,2).Select(part=>s with{Certificate=certificate with{Lines=[line]},CertificateLineOffset=i,CertificatePart=part,DocumentPage=i*2+part+1,DocumentPages=count})).ToArray();
        }
        const int capacity=5;
        int pages=Math.Max(1,(certificate.Lines.Length+capacity-1)/capacity);
        return Enumerable.Range(0,pages).Select(i=>s with{Certificate=certificate with{Lines=certificate.Lines.Skip(i*capacity).Take(capacity).ToArray()},CertificateLineOffset=i*capacity,DocumentPage=i+1,DocumentPages=pages}).ToArray();
    }
    public static void Draw(SKCanvas canvas,Snapshot s,AssetStore assets,List<string> issues)
    {
        canvas.Clear(SKColors.White);
        if(s.Template.WidthMm<209||s.Template.HeightMm<296){issues.Add("Το πιστοποιητικό απαιτεί σελίδα Α4 210 × 297 mm.");return;}
        var key=Source(s.Certificate!.TemplateKey)??throw new InvalidOperationException("Unknown certificate template.");
        var source=SharedLayout.LegacyLayouts[key];
        var nodes=key=="PISTOPOIHTIKA_BG"?Bulgarian(source,s,issues):Conformance(source,s,issues);
        SharedLayout.DrawDocumentNodes(canvas,nodes,assets,issues);
    }
    private static string Decode(string text)=>Regex.Replace(text,@"\\([0-7]{3})",m=>((char)Convert.ToInt32(m.Groups[1].Value,8)).ToString()).Replace("\r","");
    private static string Date(DateOnly? value)=>value?.ToString("dd/MM/yyyy",CultureInfo.InvariantCulture)??"";
    private static string Num(decimal? value)=>value?.ToString("0.##",CultureInfo.InvariantCulture)??"";
    private static LayoutNode Text(string name,string text,float x,float y,float width,float height,float size=9,bool bold=false)=>new("Label",name,x,y,width,height,"Calibri",size,bold,false,1,"",0,"","","",true,null,0,false,false,text);
    private static string Customer(string binding,Snapshot s)=>binding switch{"EPONYMIA"=>s.Customer?.Name??"","DIEYTHINSH"=>s.Customer?.Address??"","POLH"=>s.Customer?.City??"","XORA"=>s.Customer?.Country??"","VAT"=>s.Customer?.Vat??"",_=>""};
    private static string Intrastat(Product? p)=>p?.Fields.FirstOrDefault(k=>k.Key.Contains("intrastat",StringComparison.OrdinalIgnoreCase)).Value??"";
    private static IEnumerable<LayoutNode> Conformance(Geometry source,Snapshot s,List<string> issues)
    {
        var cert=s.Certificate!;var nodes=new List<LayoutNode>();
        foreach(var n in source.Nodes.Where(n=>n.Visible&&n.Section is "PageHeader" or "BreakHeader" or "PageFooter"))
        {
            if(n.Section=="BreakHeader"&&n.Y>88)continue; // rebuilt table header below
            var caption=n.Caption.Length>0?Decode(n.Caption):n.Binding=="HMEROMHNIA"?Date(cert.ShipmentDate):Customer(n.Binding,s);
            var item=n with{X=n.X+6,Y=n.Y+(n.Section=="PageHeader"?6:n.Section=="BreakHeader"?28:175),Caption=caption};
            if(n.Name=="Ετικέτα45")item=item with{X=25,Width=160};
            if(n.Name=="Ετικέτα44")item=item with{FontSize=8.3f,Height=31};
            if(n.Name=="Ετικέτα41")item=item with{FontSize=9.2f,Height=40};
            if(n.Name=="Ετικέτα42")item=item with{Height=41};
            if(n.Section=="BreakHeader"&&n.Binding.Length>0)item=item with{FontSize=9};
            nodes.Add(item);
        }
        nodes.Add(Text("Customer phone",s.Customer?.Phone??"",130.1f,58.9f,60,4));
        nodes.Add(Text("Customer email",s.Customer?.Email??"",130.1f,66.9f,60,8,8));
        nodes.Add(Text("Shipment",$"{cert.Name}   {Date(cert.ShipmentDate)}   {cert.Vehicle} {cert.Trailer}",10,109,190,5,8));
        float[] widths=[10,25,65,38,25,24];
        string[] labels=["No","Κωδικός /\nItem code","Περιγραφή Προϊόντος / Product Description","Παρτίδα / Batch No","Ημερ. Λήξης /\nExpiry date","Intrastat ID"];
        float x=9;
        for(int i=0;i<widths.Length;i++){nodes.Add(Text("Header background "+i,"",x,116,widths[i],9) with{Type="Rectangle",Background=1512260});nodes.Add(Text("Column "+i,labels[i],x+1,117,widths[i]-2,8,8,true) with{Foreground=16777215});x+=widths[i];}
        for(int row=0;row<cert.Lines.Length;row++)
        {
            var line=cert.Lines[row];var product=s.CertificateProducts.GetValueOrDefault(line.ProductId);
            var intrastat=Intrastat(product);if(string.IsNullOrWhiteSpace(intrastat))issues.Add("Λείπει κωδικός Intrastat: "+product?.ErpCode);
            string[] values=[(s.CertificateLineOffset+row+1).ToString("00"),product?.ErpCode??"",product?.Names.GetValueOrDefault("en")??"",line.Lot,Date(line.ExpiryDate),intrastat];x=9;
            for(int col=0;col<widths.Length;col++){nodes.Add(Text("Cell","",x,125+row*9,widths[col],9) with{Type="Rectangle"});nodes.Add(Text($"Line {s.CertificateLineOffset+row+1} column {col}",values[col],x+1,126+row*9,widths[col]-2,7,col==3?7.3f:8));x+=widths[col];}
        }
        nodes.Add(Text("Notes",cert.Notes,10,172,188,4,8));
        nodes.Add(Text("Page",$"{s.DocumentPage} / {s.DocumentPages}",181,290,20,4,8));
        return nodes;
    }
    private static IEnumerable<LayoutNode> Bulgarian(Geometry source,Snapshot s,List<string> issues)
    {
        var cert=s.Certificate!;var line=cert.Lines[0];var product=s.CertificateProducts.GetValueOrDefault(line.ProductId);
        var recipe=s.CertificateRecipes.GetValueOrDefault(line.ProductId);
        string ingredients=recipe?.Translations.GetValueOrDefault("bg")?.Ingredients??"";
        if(string.IsNullOrWhiteSpace(ingredients))issues.Add("Λείπει σύσταση bg για το πιστοποιητικό: "+product?.ErpCode);
        if(line.Cartons is null or <=0)issues.Add("Συμπληρώστε πλήθος κιβωτίων πιστοποιητικού.");
        var split=source.Nodes.Single(n=>n.Type=="PageBreak").Y;
        string Value(string b)
        {
            if(Regex.IsMatch(b,@"_[2-5]$"))return ""; // one product/lot per certificate pair
            return b switch
            {
                "KOD_PISTOPOIHTIKOY"=>$"{cert.Name} / {s.CertificateLineOffset+1}   LOT: {line.Lot}",
                "PROION_BG"=>product?.Names.GetValueOrDefault("bg")??"",
                "HMER_PARAGOGHS"=>Date(line.ProductionDate),"HMER_LHXHS"=>Date(line.ExpiryDate),"HMER_KATAPSIXIS"=>Date(line.FreezeDate),
                "PLITHOS_KIVOTION"=>line.Cartons?.ToString()??"","BAROS"=>Num(line.Weight),
                "BAROS KIVOTIOY"=>line.Cartons>0?Num(line.Weight/line.Cartons):"",
                "SYSTATIKA_BG"=>ingredients,"HMER_APOSTOLHS"=>Date(cert.ShipmentDate),"PARATHRHSEIS"=>cert.Notes,
                "SYNTHIKES"=>product?.Frozen==true?"< -18 °C":"< 2 °C",
                _ when b.StartsWith("=")=>$"Page {s.DocumentPage} of {s.DocumentPages}",
                _=>Customer(b,s)
            };
        }
        var nodes=new List<LayoutNode>();
        foreach(var n in source.Nodes.Where(n=>n.Visible&&n.Type!="PageBreak"))
        {
            if(n.Name is "BAROS KIVOTIOY" or "Κείμενο96" or "Κείμενο97")continue; // single composed packing statement avoids overprinting
            if(n.Section=="Section"&&(s.CertificatePart==0?n.Y>=split:n.Y<split))continue;
            float offset=n.Section=="PageHeader"?5:n.Section=="PageFooter"?270:30-(s.CertificatePart==1?split:0);
            var item=n with{X=n.X+7,Y=n.Y+offset,Caption=n.Caption.Length>0?Decode(n.Caption):Value(n.Binding)};
            if(n.Type is "Label" or "TextBox")item=item with{FontSize=Math.Min(n.FontSize,n.Section=="Section"?9.5f:9)};
            if(n.Name is "Ετικέτα27" or "Ετικέτα72")item=item with{X=15,Width=180,FontSize=13};
            if(n.Name is "Ετικέτα31" or "Ετικέτα73")item=item with{X=25,Width=160,FontSize=11};
            if(n.Binding=="KOD_PISTOPOIHTIKOY")item=item with{X=14,Y=44,Width=184,Height=4,FontSize=8};
            if(n.Binding=="POLH")item=item with{Width=50};
            if(n.Binding=="XORA")item=item with{X=s.CertificatePart==0?118:143,Width=49};
            if(n.Name=="SYSTATIKA_BG")item=item with{FontSize=9};
            if(n.Name is "Κείμενο85" or "Κείμενο103")item=item with{FontSize=8.5f,Height=7};
            if(n.Name=="SYNTHIKES")item=item with{Width=106,FontSize=9};
            if(n.Name=="Ετικέτα95")item=item with{Caption=$"{line.Cartons} кутии × {(line.Cartons>0?Num(line.Weight/line.Cartons):"—")} kg = {Num(line.Weight)} kg",FontSize=10};
            nodes.Add(item);
        }
        nodes.Add(Text("Certificate reference",$"{cert.Name} / {s.CertificateLineOffset+1}   LOT: {line.Lot}",14,44,184,4,8));
        if(s.CertificatePart==0)nodes.Add(Text("Vehicle",$"{cert.Vehicle} / {cert.Trailer}",85,108.1f,108,6,11));
        return nodes;
    }
}
