using Faethon;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Faethon.Tests;
public sealed class DomainTests
{
    [Fact]public void ProductRequiredFieldsAndIntrastatAreValidated()
    {
        var p=new Product{ErpCode="1-111-1-111",Barcode="123",CartonBarcode="456",RecipeCode="1",Brands=["1"],Names=new(){{"el","Προϊόν"}},Fields=new(){{"Συντομογραφία","ΓΚ"},{"Συσκευασία Προϊόντος","HOR"},{"Κατάσταση Συσκ.","Χύμα"},{"Τμήμα Παραγωγής","Κρέατα"},{"Οδηγίες Χρήσης","1"},{"Κωδ. Intrastat","02032959"},{"ΕΛΟΓΑΚ","0102004"}}};
        string Check(Product value)=>Validation.Check("product",System.Text.Json.JsonSerializer.SerializeToElement(value,Json.Options));
        Assert.NotEmpty(Check(p));
        Assert.Throws<InvalidOperationException>(()=>Check(p with{Barcode=""}));
        Assert.Throws<InvalidOperationException>(()=>Check(p with{Fields=[]}));
        Assert.Throws<InvalidOperationException>(()=>Check(p with{SmallLabelWeight="unknown"}));
        Assert.Throws<InvalidOperationException>(()=>Check(p with{Fields=p.Fields.ToDictionary(k=>k.Key,k=>k.Key=="Κωδ. Intrastat"?"letters":k.Value)}));
    }
    [Theory]
    [InlineData("2026-01-01","01/26/10/11091000/5")]
    [InlineData("2026-01-04","02/26/10/11091000/1")]
    [InlineData("2026-01-19","04/26/10/11091000/2")]
    [InlineData("2026-09-07","37/26/10/11091000/2")]
    [InlineData("2024-12-31","53/24/10/11091000/3")]
    public void LotMatchesAccess(string date,string expected)=>Assert.Equal(expected,Rules.Lot(DateOnly.Parse(date),"10","1-109-1-000",false));
    [Fact]public void FrozenLotAndLeapExpiry(){Assert.Equal("09/24/10/11091000/0",Rules.Lot(new(2024,2,29),"10","1-109-1-000",true));Assert.Equal(new DateOnly(2024,3,1),new Production{ProductionDate=new(2024,2,28),ShelfLife=2}.Expiry);}
    [Fact]public void InvalidDatesFail(){Assert.Throws<InvalidOperationException>(()=>Rules.ValidateProduction(new(){ProductionDate=new(2026,2,1),ExpiryOverride=new(2026,1,1)}));Assert.Throws<InvalidOperationException>(()=>Rules.ValidateProduction(new(){ShelfLife=10000}));}
    [Fact]public void ExplicitExpiryWins(){var draft=new Production{ProductionDate=new(2026,1,1),ShelfLife=10,ExpiryOverride=new(2026,1,20)};Assert.Equal(new DateOnly(2026,1,20),draft.Expiry);}
    [Fact]public void BarcodeUsesLegacyCode39(){Assert.True(Rendering.ValidBarcode("5212006800040"));Assert.True(Rendering.ValidBarcode("ABC123"));Assert.False(Rendering.ValidBarcode("lowercase"));Assert.True(Rendering.ValidBarcode("5212006800040","ean13"));Assert.False(Rendering.ValidBarcode("5212006800041","ean13"));}
    [WorkbookFact]public void RealWorkbookRowsRemainDistinct()
    {
        var dir=TestEnvironment.ImportDirectory;
        using var p=File.OpenRead(Path.Combine(dir,"PROIONTA.xlsx"));using var r=File.OpenRead(Path.Combine(dir,"SYNTAGES.xlsx"));
        var products=WorkbookReader.Parse(p,"product");var recipes=WorkbookReader.Parse(r,"recipe");Assert.Equal(779,products.Count);Assert.Equal(172,recipes.Count);Assert.Equal(779,products.Select(p=>p.Key).Distinct().Count());
        Assert.Equal(4,products.Count(p=>Json.Read<Product>(p.Data).ErpCode=="1-111-2-002"));Assert.Contains(recipes,r=>r.Key=="0100p");Assert.Contains(recipes,r=>r.Key=="0001");Assert.Contains(products,p=>Json.Read<Product>(p.Data).Brands.Length>1);
        var recipeKeys=recipes.Select(r=>r.Key).ToHashSet();Assert.Equal(0,products.Count(p=>!recipeKeys.Contains(Json.Read<Product>(p.Data).RecipeCode)));Assert.Contains("0108",recipeKeys);
    }
    [Fact]public async Task PrinterRasterHasCorrectDimensionsAndZplPacking()
    {
        var dir=Path.Combine(Path.GetTempPath(),"faethon-tests-"+Guid.NewGuid());var store=new AssetStore(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Storage",dir}}).Build());var renderer=new Rendering(store);
        var snapshot=new Snapshot{Template=new(){Family="custom",WidthMm=100,HeightMm=80},Production=new(){FreeText="ΔΟΚΙΜΗ / TEST",Languages=["el"]}};
        var rendered=renderer.Render(snapshot);Assert.StartsWith("%PDF",System.Text.Encoding.ASCII.GetString(rendered.Pdf.AsSpan(0,4)));Assert.Empty(rendered.Issues);
        var printer=new Printer{WidthMm=100,HeightMm=80,Rotation=0,Transport="windows"};var bytes=renderer.Raster(snapshot,printer);using var bitmap=SkiaSharp.SKBitmap.Decode(bytes);Assert.Equal(800,bitmap.Width);Assert.Equal(640,bitmap.Height);
        var zpl=System.Text.Encoding.ASCII.GetString(renderer.Raster(snapshot,printer with{Transport="zpl"}));Assert.Contains("^GFA,64000,64000,100,",zpl);Assert.EndsWith("^FS^PQ1^XZ",zpl);
        var hash=await store.Put(rendered.Pdf);Assert.Equal(hash,await store.Put(rendered.Pdf));Assert.Equal(rendered.Pdf,store.Read(hash));
        Assert.Throws<InvalidOperationException>(()=>store.PathFor("../outside"));
    }
    [Fact]public void SharedGeometryIsNotDuplicatedByLanguage(){Assert.True(SharedLayout.Layouts.Count<20);Assert.Equal(60,SharedLayout.Layouts["thermal-small"].Nodes.Length);Assert.Equal(16,SharedLayout.Captions.Keys.Count);}
    [Fact]public void LargeWindowsProfilePreservesActualSizeAndRejectsClipping()
    {
        var store=new AssetStore(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Storage",Path.Combine(Path.GetTempPath(),"faethon-tests-"+Guid.NewGuid())}}).Build());
        var renderer=new Rendering(store);
        var snapshot=new Snapshot{Template=new(){Family="custom",WidthMm=148,HeightMm=100},Production=new(){FreeText="TEST",Languages=["el"]}};
        var printer=new Printer{WidthMm=108,HeightMm=148,Rotation=90,PrintableWidthMm=104};
        Assert.Equal("windows",printer.Transport);
        using var bitmap=SkiaSharp.SKBitmap.Decode(renderer.Raster(snapshot,printer));
        // Driver handles landscape; the artifact retains the logical content dimensions.
        Assert.Equal(1184,bitmap.Width);Assert.Equal(800,bitmap.Height);
        Assert.Throws<InvalidOperationException>(()=>renderer.Raster(snapshot,printer with{Rotation=0}));
        Assert.Throws<InvalidOperationException>(()=>renderer.Raster(snapshot,printer with{PrintableWidthMm=99}));
        Assert.Throws<InvalidOperationException>(()=>renderer.Raster(snapshot,printer with{OffsetY=40}));
    }
}
