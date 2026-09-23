using Faethon;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Faethon.Tests;

public sealed class LegacyLabelSeedTests
{
    [Fact] public async Task RecoveredDataIsIdempotentAndPreservesOperatorChanges()
    {
        await using var app=new TestApp();await app.Initialize();
        using(var scope=app.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<AppDb>();
            var brandRow=await db.Records.SingleAsync(r=>r.Kind=="brand"&&r.Key=="1");
            var brand=brandRow.As<ReferenceData>();
            Assert.Equal("ΦΑΕΘΩΝ ΑΒΕΕ",brand.Names["el"]);Assert.Equal("FAETHON SA",brand.Names["en"]);
            Assert.Contains("sales@faethon.eu",brand.Texts["en"]);Assert.True(brand.Complete);
            var origin=await db.Records.SingleAsync(r=>r.Kind=="reference"&&r.Key=="origin:1");
            Assert.Contains("Γερμανία",origin.As<ReferenceData>().Texts["el"]);
            var version=brandRow.Version;var originVersion=origin.Version;
            await Seed.Run(db);Assert.Equal(version,brandRow.Version);Assert.Equal(originVersion,origin.Version);
            brandRow.Data=Json.Write(brand with{Names=new(){{"el","EDITED NAME"},{"en","EDITED EN"}},Texts=new(){{"el","EDITED DETAILS"},{"en","EDITED EN DETAILS"}}});
            var instruction=await db.Records.SingleAsync(r=>r.Kind=="reference"&&r.Key=="instructions:1");
            instruction.Data=Json.Write(instruction.As<ReferenceData>() with{Texts=new(){{"el","EDITED INSTRUCTIONS"},{"en","EDITED EN INSTRUCTIONS"}}});await db.SaveChangesAsync();
            await Seed.Run(db);
            Assert.Equal("EDITED NAME",brandRow.As<ReferenceData>().Names["el"]);
            Assert.Equal("EDITED DETAILS",brandRow.As<ReferenceData>().Texts["el"]);
            Assert.Equal("EDITED INSTRUCTIONS",instruction.As<ReferenceData>().Texts["el"]);
        }
        await app.Drop();
    }
    [Fact] public async Task RealLabelReferenceFieldsResolveThroughApplicationWithoutMissingData()
    {
        await using var app=new TestApp();await app.Initialize();
        using(var scope=app.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<AppDb>();
            var product=new Record{Kind="product",Key="113",Data=Json.Write(new Product{ErpCode="3-106-2-000",Barcode="5212006801184",Brands=["1"],Active=true,RecipeCode="1031",Names=new(){{"el","ΣΟΥΒΛΑΚΙ ΧΟΙΡΙΝΟ ΜΗΧΑΝΗΣ 80gr, ΝΩΠΟ"},{"en","PORK SKEWER 80GR MACHINEMADE, FRESH"}},Fields=new(){{"Οδηγίες Χρήσης","1"},{"Συσκευασία Προϊόντος","HOR"},{"Κατάσταση Προϊόντος","ΝΩΠΟ"}}})};
            var recipe=new Record{Kind="recipe",Key="1031",Data=Json.Write(new Recipe{Code="1031",Family="10",Category="Β1",OriginKey="1",Translations=new(){{"el",new("Κρέας χοιρινό (95%)","Πιθανόν να περιέχει ίχνη από: γλουτένη, σόγια, λακτόζη, σέλινο και σινάπι.")},{"en",new("Pork meat (95%)","It may contain traces of: gluten, soy, lactose, celery and mustard.")}}})};
            db.Records.AddRange(product,recipe);await db.SaveChangesAsync();await Seed.Run(db);
            var s=await scope.ServiceProvider.GetRequiredService<Resolver>().Resolve(new(){ProductId=product.Id,ProductionDate=new(2026,7,7),ShelfLife=3,Weight=5,Languages=["el","en"]});
            Assert.Single(s.Issues);Assert.Contains("επικυρωθεί",s.Issues[0]);
            Assert.Equal("FAETHON SA",s.Brand!.Names["en"]);Assert.Equal("RAW",s.Conditions["en"]);
            Assert.Equal("HORECA",s.Packaging["el"]);Assert.Contains("CLASS B1",s.Categories["en"]);
            Assert.Contains("Deutschland, Netherland, Denmark",s.Origins["en"]);
            Assert.Contains("Preservation",s.Instructions["en"]);Assert.Contains("<b>gluten",s.Recipe!.Translations["en"].Allergens);
            await LegacyAssets.Import(db,scope.ServiceProvider.GetRequiredService<AssetStore>(),Path.Combine(TestEnvironment.Root,"legacy"));
            Assert.Empty(scope.ServiceProvider.GetRequiredService<Rendering>().Render(s).Issues);
        }
        await app.Drop();
    }
    [Fact] public void TitlesAreOpaqueAndHeaderArtworkClearsLegends()
    {
        var nodes=SharedLayout.LegacyLayouts["MEGALH_ETIKETA_FAETHON_GR_EN"].Nodes;
        Assert.All(nodes.Where(n=>n.Binding.StartsWith("PROIONTA.PROION_")),n=>Assert.Equal(16777215L,n.Background));
        Assert.Null(nodes.Single(n=>n.Binding=="EPONYMIES.STOIXEIA_GR").Background); // explicit transparent control
        foreach(var layout in SharedLayout.LegacyLayouts.Values)
        foreach(var legend in layout.Nodes.Where(n=>n.Type=="Label"&&n.TextCenterY.HasValue))
            Assert.All(layout.Nodes.Where(n=>n.Type=="Image"&&n.Y<legend.Y&&n.X<legend.X+legend.Width&&n.X+n.Width>legend.X),image=>Assert.True(image.Y+image.Height<=legend.Y-.49f,layout.Source));
    }
}
