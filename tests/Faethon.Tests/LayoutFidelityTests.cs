using Faethon;
using Microsoft.Extensions.Configuration;
using SkiaSharp;
using Xunit;

namespace Faethon.Tests;

public sealed class LayoutFidelityTests
{
    private static LayoutNode Node => new("TextBox","test",1,1,40,10,"Calibri",9,false,false,1,"",0,"","","",true,null,0,false,true);

    [Fact] public void SeededLogoKeepsHorizontalArtworkButUploadedLogoOverridesIt()
    {
        var small=SharedLayout.LegacyLayouts["MIKRH_ETIKETA_FAETHON_GR"].Nodes.Single(n=>n.ImageName=="Faethon_Logo_ΜΙΚΡΗ");
        var seeded=SharedLayout.LegacyLayouts["MEGALH_ETIKETA_FAETHON_GR_EN"].Nodes.Single(n=>n.ImageName=="LOGO 4").Image;
        Assert.NotEqual(seeded,small.Image);
        Assert.Equal(small.Image,SharedLayout.LogoHash(small,new(){LogoAsset=seeded}));
        Assert.Equal("uploaded",SharedLayout.LogoHash(small,new(){LogoAsset="uploaded"}));
    }
    [Fact] public void HeaderNamesUseTheirLanguageAndMissingTranslationIsReported()
    {
        var brand=new ReferenceData{Name="ΦΑΕΘΩΝ",Names=new(){{"el","ΦΑΕΘΩΝ"},{"en","FAETHON"}}};
        var issues=new List<string>();
        Assert.Equal("ΦΑΕΘΩΝ",SharedLayout.BrandName(brand,"el",issues));
        Assert.Equal("FAETHON",SharedLayout.BrandName(brand,"en",issues));
        Assert.Empty(issues);
        Assert.Equal("",SharedLayout.BrandName(brand,"bg",issues));Assert.Single(issues);
    }
    [Fact] public void LegacyVisibilityRulesAndBordersArePreserved()
    {
        var large=SharedLayout.LegacyLayouts["MEGALH_ETIKETA_FAETHON_GR_EN"];
        Assert.Equal("beef",large.Nodes.Single(n=>n.Name=="Ετικέτα26").Condition);
        Assert.Equal("frozen",large.Nodes.Single(n=>n.Name=="Ετικέτα17").Condition);
        Assert.True(large.Nodes.Single(n=>n.Name=="ODHGIES_XRHSHS.OD_XRHSHS_GR").Border);
        var footer=SharedLayout.LegacyLayouts["CERTIFICATE_OF_CONFORMANCE_FULL"].Nodes.Single(n=>n.Name=="Εικόνα35");
        Assert.Equal(0,footer.SizeMode);Assert.InRange(footer.ImageDpiX,93,95);
        var weight=large.Nodes.Single(n=>n.Name=="PROIONTA.BAROS");
        Assert.Equal("Fixed",weight.Format);Assert.Equal(2,weight.DecimalPlaces);
    }
    [Fact] public void RichTextKeepsParagraphsNestedEmphasisAndEntities()
    {
        var runs=LabelText.Parse("<div>Κρέας &amp; <b>γάλα <i>σόγια</i></b></div><div>Δεύτερη<br>γραμμή</div>",Node);
        Assert.Equal("Κρέας & γάλα σόγια\nΔεύτερη\nγραμμή",string.Concat(runs.Select(r=>r.Text)));
        Assert.Contains(runs,r=>r.Text=="σόγια"&&r.Weight==700&&r.Italic);
        Assert.Contains(runs,r=>r.Text=="Δεύτερη"&&r.Weight==400&&!r.Italic);
    }
    [Fact] public void TemperatureComparisonsAreNotTreatedAsHtml()
        =>Assert.Equal("< -18 °C",string.Concat(LabelText.Parse("< -18 °C",Node).Select(r=>r.Text)));

    [Theory]
    [InlineData("5.125",2,"5,13")]
    [InlineData("5",3,"5,000")]
    [InlineData("5.125",0,"5")]
    public void FixedNumbersHonorSourcePrecision(string value,int decimals,string expected)
        =>Assert.Equal(expected,LabelText.FormatValue(value,Node with{Format="Fixed",DecimalPlaces=decimals}));

    [Fact] public void ItalicTypefaceReallyIsItalic()
    {
        using var face=LabelFonts.Resolve("Calibri",700,true);
        Assert.Equal(SKFontStyleSlant.Italic,face.FontSlant);
        using var stream=typeof(LabelFonts).Assembly.GetManifestResourceStream("Faethon.Api.Fonts.Carlito-BoldItalic.ttf");
        using var fallback=SKTypeface.FromStream(stream!);
        Assert.Equal(SKFontStyleSlant.Italic,fallback.FontSlant);
    }
    [Fact] public void OversizedLineDrawsVisibleTextAndReportsOverflow()
    {
        using var bitmap=new SKBitmap(200,100);using var canvas=new SKCanvas(bitmap);canvas.Clear(SKColors.White);canvas.Scale(4);
        using var paint=new SKPaint{Color=SKColors.Black};var issues=new List<string>();
        LabelText.Draw(canvas,"ABCDEFGHIJKLMNOPQRSTUV",Node with{Width=5,Height=8},paint,issues);
        Assert.Single(issues);Assert.Contains(bitmap.Pixels,c=>c!=SKColors.White);
        Assert.Equal(SKColors.White,bitmap.GetPixel(30,10)); // ink cannot escape the field
    }
    [Fact] public void GrowthUsesAvailableSpaceAndShrinkReturnsContentHeight()
    {
        using var paint=new SKPaint();var issues=new List<string>();
        var node=Node with{CanGrow=true,Height=3,Width=30};
        float height=LabelText.Draw(null,"One\nTwo\nThree",node,paint,issues,15);
        Assert.InRange(height,6,15);Assert.Empty(issues);
        LabelText.Draw(null,"One\nTwo\nThree",node,paint,issues,3);Assert.Single(issues);
        float shrunk=LabelText.Draw(null,"One",Node with{CanShrink=true,Height=20},paint,[],20);
        Assert.InRange(shrunk,1,5);
    }
    [Fact] public async Task ImagesCannotOverpaintCaptions()
    {
        using var bitmap=new SKBitmap(100,100);using var canvas=new SKCanvas(bitmap);canvas.Clear(SKColors.White);canvas.Scale(4);
        var store=new AssetStore(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Storage",Path.Combine(Path.GetTempPath(),"fae-layer-"+Guid.NewGuid())}}).Build());
        using var source=new SKBitmap(5,5);source.Erase(SKColors.Red);using var encoded=source.Encode(SKEncodedImageFormat.Png,100);
        var hash=await store.Put(encoded.ToArray());
        var caption=Node with{Type="Label",Caption="",X=1,Y=1,Width=10,Height=4,Background=16777215};
        var image=Node with{Type="Image",Image=hash,X=1,Y=1,Width=10,Height=10};
        SharedLayout.DrawDocumentNodes(canvas,[caption,image],store,[]);
        Assert.Equal(SKColors.White,bitmap.GetPixel(10,10));Assert.Equal(SKColors.Red,bitmap.GetPixel(10,25));
    }
    [Fact] public void IngredientLegendInkIsCenteredOnTheRule()
    {
        using var bitmap=new SKBitmap(500,200);using var canvas=new SKCanvas(bitmap);
        canvas.Clear(SKColors.White);canvas.Scale(10);
        using var paint=new SKPaint{Color=SKColors.Black};
        var node=Node with{Y=8,Height=4,TextCenterY=10,FontSize=8};
        LabelText.Draw(canvas,"Ingredients:",node,paint,[]);
        var rows=Enumerable.Range(0,200).Where(y=>Enumerable.Range(0,500).Any(x=>bitmap.GetPixel(x,y).Red<100)).ToArray();
        Assert.NotEmpty(rows);
        Assert.InRange((rows.First()+rows.Last())/20f,9.85f,10.15f);
    }
    [Fact] public void IngredientTextPaintsAboveLateOpaqueHeadingsAndPanelBordersRemainClosed()
    {
        using var bitmap=new SKBitmap(200,200);using var canvas=new SKCanvas(bitmap);
        canvas.Clear(SKColors.White);canvas.Scale(10);
        var store=new AssetStore(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Storage",Path.Combine(Path.GetTempPath(),"fae-order-test")}}).Build());
        var body=Node with{Caption="",X=1,Y=1,Width=10,Height=4,Background=255,PaintLayer=2};
        var heading=body with{Background=16777215,PaintLayer=1};
        var panel=Node with{Caption="",X=1,Y=10,Width=10,Height=5,Border=true,BorderWidth=.3f};
        SharedLayout.DrawDocumentNodes(canvas,[body,heading,panel],store,[]);
        Assert.Equal(SKColors.Red,bitmap.GetPixel(20,20));
        Assert.Equal(SKColors.Black,bitmap.GetPixel(50,100));
        Assert.Equal(SKColors.Black,bitmap.GetPixel(50,150));

    }
    [Fact] public void PaddingInsetsRichTextWithoutMovingTheBorder()
    {
        using var bitmap=new SKBitmap(500,300);using var canvas=new SKCanvas(bitmap);
        canvas.Clear(SKColors.White);canvas.Scale(20);
        var store=new AssetStore(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Storage",Path.Combine(Path.GetTempPath(),"fae-padding-test")}}).Build());
        var panel=Node with{X=1,Y=1,Width=20,Height=10,FontSize=7,Border=true,BorderWidth=.2f,
            Foreground=255,Caption="<b>Way of use:</b> Cook before eating. Keep refrigerated.",
            PaddingLeft=.7f,PaddingRight=.7f,PaddingTop=.4f,PaddingBottom=.4f};
        var issues=new List<string>();SharedLayout.DrawDocumentNodes(canvas,[panel],store,issues);
        Assert.Empty(issues);
        Assert.Equal(SKColors.Black,bitmap.GetPixel(20,100));
        Assert.Equal(SKColors.Black,bitmap.GetPixel(200,220));
        var ink=(from x in Enumerable.Range(0,500) from y in Enumerable.Range(0,300)
            let c=bitmap.GetPixel(x,y) where c.Red>150&&c.Green<100&&c.Blue<100 select (x,y)).ToArray();
        Assert.NotEmpty(ink);
        Assert.All(ink,p=>{Assert.InRange(p.x,34,405);Assert.InRange(p.y,28,211);});
        using var paint=new SKPaint();
        var plain=panel with{PaddingLeft=0,PaddingRight=0,PaddingTop=0,PaddingBottom=0,CanShrink=true};
        float measured=LabelText.Draw(null,"One",plain with{PaddingTop=.4f,PaddingBottom=.4f},paint,[]);
        Assert.Equal(LabelText.Draw(null,"One",plain,paint,[])+.8f,measured,3);
    }
    [Fact] public void SampleLotSurvivesTheLateBarcodeBackground()
    {
        var nodes=SharedLayout.LegacyLayouts["DEIGMA_ETIKETA_GR"].Nodes;
        var lot=nodes.Single(n=>n.Binding=="LOT");
        var barcode=nodes.Single(n=>n.Binding=="PROIONTA.BARCODE");
        using var bitmap=new SKBitmap(800,80);using var canvas=new SKCanvas(bitmap);
        canvas.Clear(SKColors.White);canvas.Scale(20);canvas.Translate(-65,-72);
        var store=new AssetStore(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Storage",Path.Combine(Path.GetTempPath(),"fae-lot-test")}}).Build());
        // Isolate the two source controls in their original (LOT then barcode) order.
        SharedLayout.DrawDocumentNodes(canvas,[lot with{Caption="LOT TEST",Foreground=255},barcode with{Caption=""}],store,[]);
        Assert.True(Enumerable.Range(0,800).Any(x=>Enumerable.Range(20,21).Any(y=>{
            var c=bitmap.GetPixel(x,y);return c.Red>150&&c.Green<100&&c.Blue<100;
        })),"The top of the LOT text was erased by the barcode background.");
    }
    [Fact] public async Task EveryLabelVariantRendersRichIngredientsWithoutOverflow()
    {
        var store=new AssetStore(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Storage",Path.Combine(Path.GetTempPath(),"fae-all-layouts-"+Guid.NewGuid())}}).Build());
        foreach(var path in Directory.GetFiles(Path.Combine(TestEnvironment.Root,"legacy/assets")))await store.Put(await File.ReadAllBytesAsync(path));
        var product=new Product{Frozen=true,ErpCode="1-109-1-000",Barcode="5212006800040",CartonBarcode="5212006800040",Names=WorkbookReader.Languages.ToDictionary(l=>l,l=>"TEST / ΔΟΚΙΜΗ")};
        var recipe=new Recipe{Family="10",Translations=WorkbookReader.Languages.ToDictionary(l=>l,l=>new RecipeText("<div>Κρέας, <b>γάλα</b>, <i>soy</i>.</div><div>Salt.</div>","Allergens: milk, soy"))};
        foreach(var report in SharedLayout.Catalog.Where(r=>!r.Family.StartsWith("certificate")&&r.Family!="reference-list"))
        {
            bool a4=report.Profile=="a4"||report.Family=="butcher";
            var template=new Template{GeometryKey=report.Report,Family=report.Family,Profile=report.Family=="butcher"?"a4":report.Profile,WidthMm=a4?(report.Family=="pallet"?297:210):report.Profile=="large"?148:100,HeightMm=a4?(report.Family=="pallet"?210:297):report.Profile=="large"?100:report.Family=="thermal"?80:82};
            var snapshot=new Snapshot{Template=template,Product=product,Recipe=recipe,
                Instructions=WorkbookReader.Languages.ToDictionary(l=>l,l=>report.Brand=="ZLATHS"?"Cook before eating. Keep refrigerated.":"<b><u>Way of use:</u></b> To be consumed after heat treatment.<br><b><u>Preservation:</u></b> Preserve frozen &lt; -18°C / Preserve raw &lt; 2°C. Refreezing if defrosted is forbidden. After defrosting the product may have a maximum shelf life of 2 days under 2°C."),
                Production=new(){ProductionDate=new(2026,9,23),FreezeDate=new(2026,9,23),PackagingDate=new(2026,9,23),ShelfLife=365,Languages=report.Languages,BrandKey=report.Brand,Mode=report.Mode,Weight=5.125m,CartonWeight=10.25m,Pieces=2,CustomerProductCode="42",CustomerOrigin="EU",LabelComment="QA",FreeText=report.Family is "custom" or "production"?"QA SAMPLE":""},Lot="39/26/10/11091000/0"};
            var result=new Rendering(store).Render(snapshot);
            Assert.True(result.Issues.Length==0,report.Report+": "+string.Join("; ",result.Issues));
        }
    }

}
