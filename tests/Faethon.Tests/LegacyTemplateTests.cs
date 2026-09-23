using Faethon;
using Microsoft.Extensions.Configuration;
using System.Text;
using System.Text.RegularExpressions;
using Xunit;

namespace Faethon.Tests;
public sealed class LegacyTemplateTests
{
    [Fact] public void RulesRetainAccessGeometryAndWeightAcrossEveryReport()
    {
        int checkedRules=0;
        foreach(var (report,layout) in SharedLayout.LegacyLayouts)
        {
            string source=File.ReadAllText(Path.Combine(TestEnvironment.Root,"legacy/definitions",report+".txt"));
            foreach(Match block in Regex.Matches(source,@"Begin Line\s+(.*?)\r?\n\s*End",RegexOptions.Singleline))
            {
                string name=Regex.Match(block.Value,"Name =\"([^\"]+)\"").Groups[1].Value;
                if(name.Length==0)continue;
                float Value(string key){var m=Regex.Match(block.Value,@"(?m)^\s*"+key+@" =([0-9]+)");return m.Success?float.Parse(m.Groups[1].Value,System.Globalization.CultureInfo.InvariantCulture):0;}
                var rule=layout.Nodes.Single(n=>n.Name==name);
                float mm=25.4f/1440;
                Assert.True(rule.Visible,$"{report}/{name} hidden");
                Assert.InRange(Math.Abs(Value("Top")*mm-rule.Y),0,.001f);
                Assert.InRange(Math.Abs(Value("Width")*mm-rule.Width),0,.001f);
                Assert.InRange(Math.Abs(Value("Height")*mm-rule.Height),0,.001f);
                // Only vertical joins may reconcile a source offset below one hairline.
                Assert.InRange(Math.Abs(Value("Left")*mm-rule.X),0,rule.Width==0?.15f:.001f);
                float weight=Value("BorderWidth");
                Assert.Equal(weight>0?weight*25.4f/72:.12f,rule.BorderWidth,3);
                checkedRules++;
            }
        }
        Assert.True(checkedRules>100);
    }
    [Fact] public void ReferenceFooterJoinsAreClosedAndTextClearsTheThickRule()
    {
        var nodes=SharedLayout.LegacyLayouts["MEGALH_ETIKETA_FAETHON_GR_EN"].Nodes;
        var rule=nodes.Single(n=>n.Name=="Γραμμή48");
        Assert.True(rule.Visible);
        Assert.Equal(4665*25.4f/1440,rule.Y,3);
        Assert.Equal(2*25.4f/72,rule.BorderWidth,3);
        var right=nodes.Single(n=>n.Name=="Πλαίσιο14");
        foreach(var name in new[]{"Γραμμή47","Γραμμή30"})Assert.Equal(right.X,nodes.Single(n=>n.Name==name).X);
        var instructions=nodes.Where(n=>n.Binding.StartsWith("ODHGIES_XRHSHS.OD_XRHSHS")).OrderBy(n=>n.X).ToArray();
        Assert.All(instructions,n=>Assert.True(n.Border));
        Assert.Equal(right.X,instructions[0].X+instructions[0].Width,3);
        Assert.Equal(right.X,instructions[1].X);
        foreach(var name in new[]{"Ετικέτα28","PROIONTA.KOD_PROIONTOS"})
            Assert.True(nodes.Single(n=>n.Name==name).Y>=rule.Y+rule.BorderWidth/2+.14f);
    }
    [Theory]
    [InlineData("Regular")]
    [InlineData("Bold")]
    public void BundledFallbackContainsGreekAndCyrillicGlyphs(string style)
    {
        using var stream=typeof(LabelFonts).Assembly.GetManifestResourceStream($"Faethon.Api.Fonts.Carlito-{style}.ttf");
        Assert.NotNull(stream);
        using var face=SkiaSharp.SKTypeface.FromStream(stream);
        Assert.Equal("Carlito",face.FamilyName);
        using var font=new SkiaSharp.SKFont(face,12);
        Assert.True(font.ContainsGlyphs("ΦΑΕΘΩΝ άέήίόύώ ϊϋΐΰ Продукт СЪХРАНЕНИЕ 0123456789"));
    }
    [Fact]public void MillimetreFontMetricsFitLegacyDateBox()
    {
        var node=SharedLayout.LegacyLayouts["MEGALH_ETIKETA_FAETHON_GR_EN"].Nodes.Single(n=>n.Name=="PROIONTA.HMER_PARAGOGHS");
        using var face=LabelFonts.Resolve(node.Font,true);
        using var font=new SkiaSharp.SKFont(face,node.FontSize*25.4f/72*100){Subpixel=true,LinearMetrics=true,Hinting=SkiaSharp.SKFontHinting.None};
        var width=font.MeasureText("23/9/2026",out var bounds)/100;
        Assert.True(width<node.Width&&bounds.Height/100<node.Height,$"width={width}, bounds={bounds}, box={node.Width}x{node.Height}");
    }
    [Fact]public void ReportVariantsKeepTheirOwnArtworkAndHeadings()
    {
        Assert.Equal(106,SharedLayout.Catalog.Length);
        var production=new Production{BrandKey="METEORA",Languages=["ro","en"]};
        var chosen=LegacyTemplates.Select(new(){GeometryKey="thermal-large"},production,null);
        Assert.Equal("MEGALH_ETIKETA_METEORA_RO_EN",chosen?.Report);
        var source=SharedLayout.LegacyLayouts[chosen!.Report];
        Assert.Contains(source.Nodes,n=>n.ImageName.Contains("Meteora"));
        Assert.Contains(source.Nodes,n=>n.Caption.Length>0);
        Assert.Equal("MEGALH_ETIKETA_METEORA_RO_EN_KIBOTIO",LegacyTemplates.Select(new(){GeometryKey="thermal-large"},production with{Mode="carton"},null)?.Report);
        Assert.Null(LegacyTemplates.Select(new(){GeometryKey="user-custom"},production,null));
    }
    [Fact]public void NoLogoAndBlankSamplesUseDistinctRecoveredDefinitions()
    {
        var noLogo=SharedLayout.LegacyLayouts["CUSTOM_ETIKETA_MIKRH_NOLOGO"];
        Assert.DoesNotContain(noLogo.Nodes,n=>n.Type=="Image");
        Assert.Contains(SharedLayout.LegacyLayouts["CUSTOM_ETIKETA_MIKRH_LOGO"].Nodes,n=>n.Type=="Image");
        var sample=LegacyTemplates.Select(new(){GeometryKey="sample-blank",Family="sample",Profile="small"},new(){Mode="blank",Languages=["de"]},null);
        Assert.Equal("DEIGMA_KENO_ETIKETA_GE",sample?.Report);
    }
    [Fact]public void ReferenceReportsKeepAllRowsAndPaginatePdf()
    {
        var records=Enumerable.Range(1,45).Select(i=>new Record{Kind="recipe",Key=i.ToString("0000"),Data=Json.Write(new Recipe{Code=i.ToString("0000"),Name="Recipe "+i,Family="10",Category="A"})}).ToList();
        var versions=new Dictionary<string,long>();
        var report=ReferenceReports.Resolve("LISTA_SYNTAGON",records,new(2026,9,23),versions);
        Assert.Equal(45,report.Rows.Length);Assert.Equal(45,versions.Count);Assert.Equal("0045",report.Rows[^1][0]);
        var renderer=Renderer();var snapshot=new Snapshot{Template=new(){Name="Recipes",Family="reference-list",WidthMm=210,HeightMm=297},ReferenceHeadings=report.Headings,ReferenceRows=report.Rows};
        var pdf=renderer.Render(snapshot);Assert.Empty(pdf.Issues);
        Assert.Equal(3,Regex.Matches(Encoding.Latin1.GetString(pdf.Pdf),@"/Type /Page\b").Count);
        Assert.Throws<InvalidOperationException>(()=>renderer.Raster(snapshot,new(){WidthMm=210,HeightMm=297,PrintableWidthMm=210,Rotation=0}));
    }
    [Fact]public void ThirtyCertificateLinesAreNotClippedToOnePage()
    {
        var id=Guid.NewGuid();var line=new CertificateLine(id,10,"QA",new(2026,9,23),new(2026,9,26),null,2);
        var snapshot=new Snapshot{Template=new(){Family="certificate-conformance",WidthMm=210,HeightMm=297},Certificate=new(){TemplateKey="certificate-conformance",Lines=Enumerable.Repeat(line,30).ToArray()},CertificateProducts=new(){{id,new(){Names=new(){{"el","Product"},{"en","Product"}}}}}};
        var pdf=Renderer().Render(snapshot);
        Assert.DoesNotContain(pdf.Issues,i=>i.Contains("υπερβαίνει"));
        Assert.Equal(6,Regex.Matches(Encoding.Latin1.GetString(pdf.Pdf),@"/Type /Page\b").Count);
    }
    private static Rendering Renderer()=>new(new AssetStore(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Storage",Path.Combine(Path.GetTempPath(),"faethon-legacy-tests-"+Guid.NewGuid())}}).Build()));
    [Fact]public async Task BulgarianCertificateKeepsEachProductOnItsOwnTwoPagePair()
    {
        var first=Guid.NewGuid();var second=Guid.NewGuid();
        var line=new CertificateLine(first,50,"QA-ONE",new(2026,9,23),new(2026,9,26),null,10);
        var snapshot=new Snapshot{Template=new(){Family="certificate-bg",WidthMm=210,HeightMm=297},Certificate=new(){TemplateKey="certificate-bg",Name="QA",Lines=[line,line with{ProductId=second,Lot="QA-TWO",FreezeDate=new(2026,9,23)}]},CertificateProducts=new(){{first,new(){Names=new(){{"bg","Продукт едно"}}}},{second,new(){Frozen=true,Names=new(){{"bg","Продукт две"}}}}},CertificateRecipes=new(){{first,new(){Translations=new(){{"bg",new("Свинско месо, сол")}}}},{second,new(){Translations=new(){{"bg",new("Говеждо месо, сол")}}}}}};
        var pages=CertificateLayouts.Pages(snapshot);
        Assert.Equal(4,pages.Length);
        Assert.Equal(new[]{"QA-ONE","QA-ONE","QA-TWO","QA-TWO"},pages.Select(p=>p.Certificate!.Lines.Single().Lot));
        Assert.Equal(new[]{0,1,0,1},pages.Select(p=>p.CertificatePart));
        Assert.Equal(new[]{1,2,3,4},pages.Select(p=>p.DocumentPage));
        var store=new AssetStore(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Storage",Path.Combine(Path.GetTempPath(),"faethon-cert-tests-"+Guid.NewGuid())}}).Build());
        foreach(var file in Directory.GetFiles(Path.GetFullPath("../../../../../legacy/assets",AppContext.BaseDirectory)))await store.Put(await File.ReadAllBytesAsync(file));
        var rendered=new Rendering(store).Render(snapshot);
        Assert.Empty(rendered.Issues);Assert.Equal(4,rendered.PageCount);
        var conformance=SharedLayout.LegacyLayouts["CERTIFICATE_OF_CONFORMANCE_FULL"];
        Assert.Contains(conformance.Nodes,n=>n.Section=="BreakHeader"&&n.Caption=="CERTIFICATE OF CONFORMANCE");
        Assert.Contains(conformance.Nodes,n=>n.Binding=="CERTIFICATE_OF_CONFORMANCE_FULL_CODE_COC"&&!n.Visible);
    }
    [Fact]public async Task PrivateLabelLogoOverridesRecoveredArtwork()
    {
        var store=new AssetStore(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Storage",Path.Combine(Path.GetTempPath(),"faethon-private-tests-"+Guid.NewGuid())}}).Build());
        async Task<string> Logo(SkiaSharp.SKColor color){using var bitmap=new SkiaSharp.SKBitmap(100,100);using(var canvas=new SkiaSharp.SKCanvas(bitmap))canvas.Clear(color);using var image=SkiaSharp.SKImage.FromBitmap(bitmap);using var data=image.Encode(SkiaSharp.SKEncodedImageFormat.Png,100);return await store.Put(data.ToArray());}
        var template=new Template{Family="custom",GeometryKey="CUSTOM_MEGALH_ETIKETA_LOGO",WidthMm=148,HeightMm=100};
        var snapshot=new Snapshot{Template=template,Brand=new(){Name="FICTIONAL QA",LogoAsset=await Logo(SkiaSharp.SKColors.Red)},Production=new(){BrandKey="QA",FreeText="QA SAMPLE"}};
        var renderer=new Rendering(store);var red=renderer.Render(snapshot);var blue=renderer.Render(snapshot with{Brand=snapshot.Brand with{LogoAsset=await Logo(SkiaSharp.SKColors.Blue)}});
        Assert.Empty(red.Issues);Assert.Empty(blue.Issues);
        using var r=SkiaSharp.SKBitmap.Decode(red.Png);using var b=SkiaSharp.SKBitmap.Decode(blue.Png);
        Assert.Equal(SkiaSharp.SKColors.Red,r.GetPixel(40,40));Assert.Equal(SkiaSharp.SKColors.Blue,b.GetPixel(40,40));
    }
    [WorkbookFact]public async Task RealProductFitsEveryRecoveredLabelVariant()
    {
        var directory=TestEnvironment.ImportDirectory;
        using var products=File.OpenRead(Path.Combine(directory,"PROIONTA.xlsx"));
        var product=Json.Read<Product>(WorkbookReader.Parse(products,"product").Single(r=>r.Key=="100").Data);
        using var recipes=File.OpenRead(Path.Combine(directory,"SYNTAGES.xlsx"));
        var recipe=Json.Read<Recipe>(WorkbookReader.Parse(recipes,"recipe").Single(r=>r.Key==product.RecipeCode).Data);
        var store=new AssetStore(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Storage",Path.Combine(Path.GetTempPath(),"faethon-label-regression-"+Guid.NewGuid())}}).Build());
        foreach(var file in Directory.GetFiles(Path.GetFullPath("../../../../../legacy/assets",AppContext.BaseDirectory)))await store.Put(await File.ReadAllBytesAsync(file));
        var renderer=new Rendering(store);
        foreach(var report in SharedLayout.Catalog.Where(r=>!r.Family.StartsWith("certificate")&&r.Family!="reference-list"))
        {
            var a4=report.Profile=="a4"||report.Family=="butcher";
            var template=new Template{GeometryKey=report.Report,Family=report.Family,Profile=report.Family=="butcher"?"a4":report.Profile,WidthMm=a4?(report.Family=="pallet"?297:210):report.Profile=="large"?148:100,HeightMm=a4?(report.Family=="pallet"?210:297):report.Profile=="large"?100:82};
            var snapshot=new Snapshot{Template=template,Product=product,Recipe=recipe,Production=new(){ProductionDate=new(2026,9,23),PackagingDate=new(2026,9,23),ShelfLife=3,Languages=report.Languages,BrandKey=report.Brand,Mode=report.Mode,Weight=5,CartonWeight=10,Pieces=2,PalletWeight=500,CustomerProductCode="42",CustomerOrigin="EU",LabelComment="QA",FreeText=report.Family is "custom" or "production"?"QA SAMPLE":""},Lot="39/26/10/31002041/4"};
            var output=renderer.Render(snapshot);
            var failures=output.Issues.Where(i=>i.Contains("αντιστοίχιση πεδίου")||i.Contains("Υπερχείλιση")||i.Contains("υπερβαίνει")).ToArray();
            Assert.True(failures.Length==0,report.Report+": "+string.Join("; ",failures));
        }
    }
}
