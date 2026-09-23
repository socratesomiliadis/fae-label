using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Faethon;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Faethon.Tests;
public sealed class TestApp:WebApplicationFactory<Program>
{
    public string Connection {get;}=(Environment.GetEnvironmentVariable("FAETHON_TEST_DATABASE")??"Host=127.0.0.1;Port=55440;Username=faethon_test;Password=faethon_local_dev")+";Database=faethon_suite_"+Guid.NewGuid().ToString("N");
    protected override void ConfigureWebHost(IWebHostBuilder builder){builder.UseSetting("ConnectionStrings:Database",Connection);builder.UseSetting("SetupToken","test-bootstrap-token");builder.UseSetting("Storage",Path.Combine(Path.GetTempPath(),"faethon-api-"+Guid.NewGuid()));builder.UseSetting("Logging:LogLevel:Default","Warning");builder.UseSetting("Backup:Enabled","false");builder.UseSetting("Backup:Directory",Path.Combine(Path.GetTempPath(),"faethon-backup-test-"+Guid.NewGuid()));builder.UseSetting("Backup:PgDump",TestEnvironment.PgDump);}
    public async Task Initialize(){using var scope=Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDb>();await db.Database.MigrateAsync();await Seed.Run(db);}
    public async Task Drop(){using var scope=Services.CreateScope();await scope.ServiceProvider.GetRequiredService<AppDb>().Database.EnsureDeletedAsync();}
}
public sealed class IntegrationTests
{
    [Fact]public async Task LabelRequirementsResolveAndSeedWithoutOverwritingValidatedProfiles()
    {
        await using var app=new TestApp();await app.Initialize();
        using(var scope=app.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<AppDb>();var resolver=scope.ServiceProvider.GetRequiredService<Resolver>();
            var product=new Record{Kind="product",Key="requirements",Data=Json.Write(new Product{ErpCode="1-111-1-111",Active=true,RecipeCode="requirements",Brands=["1"],SmallLabelWeight="carton",Fields=new(){{"Συντομογραφία","TEST"}}})};
            db.Records.Add(product);db.Records.Add(new(){Kind="recipe",Key="requirements",Data=Json.Write(new Recipe{Code="requirements",Name="Test",Family="10"})});await db.SaveChangesAsync();
            var small=await resolver.Resolve(new Production{ProductId=product.Id,TemplateKey="thermal-small",Languages=["el"],CartonWeight=5});
            Assert.Equal("carton",small.Production.Mode);Assert.Equal(80,small.Template.HeightMm);Assert.DoesNotContain(small.Issues,i=>i.Contains("βάρος προϊόντος")||i.Contains("τεμάχια"));
            var large=await resolver.Resolve(new Production{ProductId=product.Id,Languages=["el"]});Assert.Contains(large.Issues,i=>i.Contains("ελληνικά και αγγλικά"));
            var invalidPallet=await resolver.Resolve(new Production{ProductId=product.Id,TemplateKey="pallet-a4",Mode="carton",Languages=["el","en"]});
            Assert.Contains(invalidPallet.Issues,i=>i.Contains("Δεν υποστηρίζεται αυτός ο συνδυασμός"));
            var invalidButcher=await resolver.Resolve(new Production{TemplateKey="butcher-a4",Mode="blank",Languages=["el","en"]});
            Assert.Contains(invalidButcher.Issues,i=>i.Contains("Δεν υποστηρίζεται αυτός ο συνδυασμός"));
            var blank=await resolver.Resolve(new Production{TemplateKey="sample-blank",Mode="blank",Languages=["el"],FreeText="Customer"});Assert.DoesNotContain(blank.Issues,i=>i.Contains("Επιλέξτε προϊόν"));
            var renderer=scope.ServiceProvider.GetRequiredService<Rendering>();
            await LegacyAssets.Import(db,scope.ServiceProvider.GetRequiredService<AssetStore>(),Path.GetFullPath("../../../../../legacy",AppContext.BaseDirectory));
            Assert.DoesNotContain(renderer.Render(blank).Issues,i=>i.Contains("αντιστοίχιση")||i.Contains("Λείπει"));
            var butcher=await resolver.Resolve(new Production{TemplateKey="butcher-a4",Mode="blank",Languages=["el"]});Assert.Empty(renderer.Render(butcher).Issues);
            var row=await db.Records.SingleAsync(r=>r.Kind=="template"&&r.Key=="thermal-small");row.Data=Json.Write(row.As<Template>() with{HeightMm=82,Validated=true});await db.SaveChangesAsync();
            await Seed.Run(db);Assert.Equal(82,row.As<Template>().HeightMm);Assert.True(await db.Records.AnyAsync(r=>r.Key=="abbreviation:TEST"));
            var imports=scope.ServiceProvider.GetRequiredService<ImportService>();
            product.Data=Json.Write(product.As<Product>() with{Butcher=true});await db.SaveChangesAsync();
            var imported=await imports.Stage([new("product",product.Key,Json.Write(product.As<Product>() with{Butcher=false,SmallLabelWeight="product"}),1)],"test");await imports.Commit(imported.Id,"test");Assert.True(product.As<Product>().Butcher);Assert.Equal("carton",product.As<Product>().SmallLabelWeight);
        }
        await app.Drop();
    }
    [Fact]public async Task AuthorizationImportConcurrencyAndHistory()
    {
        await using var app=new TestApp();await app.Initialize();using var client=app.CreateClient();client.DefaultRequestHeaders.Add("X-Faethon-Request","1");
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/api/dashboard")).StatusCode);
        client.DefaultRequestHeaders.Add("X-Setup-Token","test-bootstrap-token");
        (await client.PostAsJsonAsync("/api/setup",new{Name="admin",Password="test password 123456"})).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/login",new{Name="admin",Password="test password 123456"})).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/api/dashboard")).StatusCode);
        var input=new{key="test-customer",version=0,data=new ReferenceData{Name="Customer",Address="Address"}};
        var created=await client.PostAsJsonAsync("/api/records/customer",input);created.EnsureSuccessStatusCode();var row=await created.Content.ReadFromJsonAsync<JsonElement>();var id=row.GetProperty("id").GetGuid();
        (await client.PutAsJsonAsync($"/api/records/{id}",input with{version=1})).EnsureSuccessStatusCode();Assert.Equal(HttpStatusCode.Conflict,(await client.PutAsJsonAsync($"/api/records/{id}",input with{version=1})).StatusCode);
        (await client.PostAsJsonAsync("/api/users",new{Name="operator",Password="operator password 123",Role="operator"})).EnsureSuccessStatusCode();
        using var op=app.CreateClient();op.DefaultRequestHeaders.Add("X-Faethon-Request","1");(await op.PostAsJsonAsync("/api/login",new{Name="operator",Password="operator password 123"})).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Forbidden,(await op.PostAsJsonAsync("/api/records/brand",input)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await op.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await op.GetAsync("/api/backup")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await op.PostAsync("/api/backup",null)).StatusCode);
        var backupResponse=await client.PostAsync("/api/backup",null);backupResponse.EnsureSuccessStatusCode();using(var zip=new System.IO.Compression.ZipArchive(new MemoryStream(await backupResponse.Content.ReadAsByteArrayAsync()))){Assert.NotNull(zip.GetEntry("database.dump"));Assert.NotNull(zip.GetEntry("manifest.json"));}
        var manual=new Product{ErpCode="1-111-1-111",Barcode="123",CartonBarcode="456",RecipeCode="1",Brands=["1"],Names=new(){{"el","Προϊόν"}},Fields=new(){{"Συντομογραφία","ΓΚ"},{"Συσκευασία Προϊόντος","HOR"},{"Κατάσταση Συσκ.","Χύμα"},{"Τμήμα Παραγωγής","Κρέατα"},{"Οδηγίες Χρήσης","1"},{"Κωδ. Intrastat","02032959"},{"ΕΛΟΓΑΚ","0102004"}}};
        var manualResponse=await client.PostAsJsonAsync("/api/records/product",new{key="",version=0,data=manual});manualResponse.EnsureSuccessStatusCode();var manualRow=await manualResponse.Content.ReadFromJsonAsync<JsonElement>();var manualId=manualRow.GetProperty("id").GetGuid();Assert.False(string.IsNullOrWhiteSpace(manualRow.GetProperty("key").GetString()));
        Assert.Equal(HttpStatusCode.Forbidden,(await op.PutAsJsonAsync($"/api/records/{manualId}",new{key="",version=1,data=manual})).StatusCode);
        (await op.PostAsJsonAsync($"/api/products/{manualId}/label-brands",new{version=1,brands=new[]{"1"}})).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict,(await op.PostAsJsonAsync($"/api/products/{manualId}/label-brands",new{version=1,brands=new[]{"1"}})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await op.PostAsJsonAsync($"/api/products/{manualId}/label-brands",new{version=2,brands=Array.Empty<string>()})).StatusCode);
        (await client.DeleteAsync($"/api/records/{manualId}?version=2")).EnsureSuccessStatusCode();
        var previewResponse=await op.PostAsJsonAsync("/api/preview",new Production{TemplateKey="custom-small",Languages=["el"],FreeText="ΔΟΚΙΜΗ"});previewResponse.EnsureSuccessStatusCode();var preview=(await previewResponse.Content.ReadFromJsonAsync<PreviewResult>())!;Assert.NotEmpty(preview.Issues);
        Assert.Equal(HttpStatusCode.BadRequest,(await op.PostAsJsonAsync("/api/jobs",new SubmitJob(preview.Id,Guid.NewGuid(),1,Guid.NewGuid().ToString()))).StatusCode);
        await app.Drop();
    }
    [WorkbookFact]public async Task RealWorkbookImportsAreIdempotent()
    {
        await using var app=new TestApp();await app.Initialize();
        using var scope=app.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDb>();var imports=scope.ServiceProvider.GetRequiredService<ImportService>();
        using var p=File.OpenRead(Path.Combine(TestEnvironment.ImportDirectory,"PROIONTA.xlsx"));using var r=File.OpenRead(Path.Combine(TestEnvironment.ImportDirectory,"SYNTAGES.xlsx"));var rows=WorkbookReader.Parse(r,"recipe").Concat(WorkbookReader.Parse(p,"product")).ToList();var batch=await imports.Stage(rows,"test");await imports.Commit(batch.Id,"test");await imports.Commit(batch.Id,"test");Assert.Equal(779,await db.Records.CountAsync(r=>r.Kind=="product"&&!r.Archived));Assert.Equal(172,await db.Records.CountAsync(r=>r.Kind=="recipe"));
        var second=await imports.Stage(rows,"test");await imports.Commit(second.Id,"test");Assert.Equal(779,await db.Records.CountAsync(r=>r.Kind=="product"&&!r.Archived));
        var bad=await imports.Stage([rows[0],rows[0]],"test");await Assert.ThrowsAsync<InvalidOperationException>(()=>imports.Commit(bad.Id,"test"));Assert.Equal(172,await db.Records.CountAsync(r=>r.Kind=="recipe"));
        await app.Drop();
    }
    [Fact]public async Task ClaimIsSerializedAndUncertaintyBlocksNextJob()
    {
        await using var app=new TestApp();await app.Initialize();using var scope=app.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDb>();var jobs=scope.ServiceProvider.GetRequiredService<JobService>();var agent=new Agent{Name="test",TokenHash="unused"};db.Agents.Add(agent);
        var snapshot=new JobSnapshot(new Snapshot(),new Printer{Queue="test"},1);var first=new PrintJob{AgentId=agent.Id,RequestKey=Guid.NewGuid().ToString(),Snapshot=Json.Write(snapshot)};var second=new PrintJob{AgentId=agent.Id,RequestKey=Guid.NewGuid().ToString(),Snapshot=Json.Write(snapshot),CreatedAt=DateTimeOffset.UtcNow.AddSeconds(1)};db.Jobs.AddRange(first,second);await db.SaveChangesAsync();
        var claim=await jobs.Claim(agent);Assert.Equal(first.Id,claim?.Id);Assert.Null(await jobs.Claim(agent));await jobs.Ack(first.Id,agent,"uncertain","partial print");Assert.Null(await jobs.Claim(agent));await jobs.Ack(first.Id,agent,"submitted","helper recovered acknowledgement");Assert.Equal(second.Id,(await jobs.Claim(agent))?.Id);
        await app.Drop();
    }
}
