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
    public string Connection {get;}=(Environment.GetEnvironmentVariable("FAETHON_TEST_DATABASE")??"Host=127.0.0.1;Port=55439;Username=faethon_test")+";Database=faethon_suite_"+Guid.NewGuid().ToString("N");
    protected override void ConfigureWebHost(IWebHostBuilder builder){builder.UseSetting("ConnectionStrings:Database",Connection);builder.UseSetting("SetupToken","test-bootstrap-token");builder.UseSetting("Storage",Path.Combine(Path.GetTempPath(),"faethon-api-"+Guid.NewGuid()));builder.UseSetting("Logging:LogLevel:Default","Warning");builder.UseSetting("Backup:Enabled","false");}
    public async Task Initialize(){using var scope=Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDb>();await db.Database.MigrateAsync();await Seed.Run(db);}
    public async Task Drop(){using var scope=Services.CreateScope();await scope.ServiceProvider.GetRequiredService<AppDb>().Database.EnsureDeletedAsync();}
}
public sealed class IntegrationTests
{
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
        var previewResponse=await op.PostAsJsonAsync("/api/preview",new Production{TemplateKey="custom-small",Languages=["el"],FreeText="ΔΟΚΙΜΗ"});previewResponse.EnsureSuccessStatusCode();var preview=(await previewResponse.Content.ReadFromJsonAsync<PreviewResult>())!;Assert.NotEmpty(preview.Issues);
        Assert.Equal(HttpStatusCode.BadRequest,(await op.PostAsJsonAsync("/api/jobs",new SubmitJob(preview.Id,Guid.NewGuid(),1,Guid.NewGuid().ToString()))).StatusCode);
        using var scope=app.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDb>();var imports=scope.ServiceProvider.GetRequiredService<ImportService>();
        using var p=File.OpenRead("C:/Users/Socrates/Downloads/faethonfiles/PROIONTA.xlsx");using var r=File.OpenRead("C:/Users/Socrates/Downloads/faethonfiles/SYNTAGES.xlsx");var rows=WorkbookReader.Parse(r,"recipe").Concat(WorkbookReader.Parse(p,"product")).ToList();var batch=await imports.Stage(rows,"test");await imports.Commit(batch.Id,"test");await imports.Commit(batch.Id,"test");Assert.Equal(779,await db.Records.CountAsync(r=>r.Kind=="product"));Assert.Equal(172,await db.Records.CountAsync(r=>r.Kind=="recipe"));
        var second=await imports.Stage(rows,"test");await imports.Commit(second.Id,"test");Assert.Equal(779,await db.Records.CountAsync(r=>r.Kind=="product"));
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
