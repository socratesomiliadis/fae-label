using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Faethon;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var builder=WebApplication.CreateBuilder(args);
if(OperatingSystem.IsWindows())builder.Host.UseWindowsService(o=>o.ServiceName="Faethon Labeller");
builder.Services.AddDbContext<AppDb>(o=>o.UseNpgsql(builder.Configuration.GetConnectionString("Database")));
builder.Services.AddSingleton<AssetStore>();builder.Services.AddScoped<ImportService>();builder.Services.AddScoped<Resolver>();builder.Services.AddScoped<JobService>();builder.Services.AddSingleton<Rendering>();
builder.Services.AddOpenApi();builder.Services.AddProblemDetails();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o=>{
    o.Cookie.Name="faethon.session";o.Cookie.HttpOnly=true;o.Cookie.SameSite=SameSiteMode.Strict;o.ExpireTimeSpan=TimeSpan.FromHours(10);
    o.Events.OnRedirectToLogin=c=>{c.Response.StatusCode=401;return Task.CompletedTask;};o.Events.OnRedirectToAccessDenied=c=>{c.Response.StatusCode=403;return Task.CompletedTask;};
    o.Events.OnValidatePrincipal=async c=>{var db=c.HttpContext.RequestServices.GetRequiredService<AppDb>();if(!Guid.TryParse(c.Principal?.FindFirstValue(ClaimTypes.NameIdentifier),out var id)){c.RejectPrincipal();return;}var u=await db.Users.FindAsync(id);if(u is null||u.Disabled||u.SessionVersion.ToString()!=c.Principal?.FindFirstValue("version"))c.RejectPrincipal();};
});
builder.Services.AddAuthorization(o=>o.AddPolicy("admin",p=>p.RequireRole("admin")));
builder.Services.AddRateLimiter(o=>{o.RejectionStatusCode=429;o.AddPolicy("login",ctx=>RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString()??"local",_=>new(){PermitLimit=10,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));});
builder.Services.AddSingleton<BackupService>();
builder.Services.AddHostedService<BackupService>(sp=>sp.GetRequiredService<BackupService>());
var app=builder.Build();
if(args.Contains("--initialize")||args.Contains("--import")||args.Contains("--legacy-assets"))
{
    using var scope=app.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDb>();await db.Database.MigrateAsync();await Seed.Run(db);
    if(args.Contains("--legacy-assets")){var index=Array.IndexOf(args,"--legacy-assets");await LegacyAssets.Import(db,scope.ServiceProvider.GetRequiredService<AssetStore>(),args[index+1]);}
    if(args.Contains("--import")){var index=Array.IndexOf(args,"--import");var dir=args[index+1];var rows=new List<ImportRow>();foreach(var pair in new[]{("SYNTAGES.xlsx","recipe"),("PROIONTA.xlsx","product")}){using var f=File.OpenRead(Path.Combine(dir,pair.Item1));rows.AddRange(WorkbookReader.Parse(f,pair.Item2));}var service=scope.ServiceProvider.GetRequiredService<ImportService>();var review=await service.Stage(rows,"initial-import");await service.Commit(review.Id,"initial-import");Console.WriteLine($"Imported {review.Products} products and {review.Recipes} recipes; {review.Issues.Length} review issues.");}
    Console.WriteLine("Database initialized. No web server started.");return;
}
app.Use(async(ctx,next)=>{
    ctx.Response.Headers["X-Content-Type-Options"]="nosniff";ctx.Response.Headers["Referrer-Policy"]="same-origin";
    if(ctx.Request.Path.StartsWithSegments("/api")&&ctx.Request.Method is not ("GET" or "HEAD")&&!ctx.Request.Path.StartsWithSegments("/api/agent")&&ctx.Request.Headers["X-Faethon-Request"]!="1"){ctx.Response.StatusCode=400;return;}
    try{await next();}
    catch(DbUpdateConcurrencyException){ctx.Response.StatusCode=409;await ctx.Response.WriteAsJsonAsync(new{message="Η εγγραφή άλλαξε από άλλο χρήστη. Ανανεώστε και επαναλάβετε."});}
    catch(DbUpdateException e) when(e.InnerException is Npgsql.PostgresException {SqlState:"23505"}){ctx.Response.StatusCode=409;await ctx.Response.WriteAsJsonAsync(new{message="Υπάρχει ήδη εγγραφή με την ίδια ταυτότητα."});}
    catch(Exception e) when(e is InvalidOperationException or ArgumentException or JsonException or KeyNotFoundException){ctx.Response.StatusCode=400;await ctx.Response.WriteAsJsonAsync(new{message=e.Message});}
});
app.UseRateLimiter();app.UseAuthentication();app.UseAuthorization();app.UseDefaultFiles();app.UseStaticFiles();
string Actor(HttpContext c)=>c.User.Identity?.Name??"system";
app.MapGet("/api/setup",async(AppDb db)=>new{required=!await db.Users.AnyAsync()});
app.MapPost("/api/setup",async(Login body,HttpContext ctx,AppDb db)=>{
    var secret=builder.Configuration["SetupToken"];
    if(string.IsNullOrWhiteSpace(secret)||ctx.Request.Headers["X-Setup-Token"]!=secret)return Results.Unauthorized();
    await using var tx=await db.Database.BeginTransactionAsync();await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(812773)");
    if(await db.Users.AnyAsync())return Results.Conflict();if(body.Password.Length<12)throw new InvalidOperationException("Ο κωδικός πρέπει να έχει τουλάχιστον 12 χαρακτήρες.");
    var u=new User{Name=body.Name.Trim().ToLowerInvariant(),Role="admin"};u.PasswordHash=new PasswordHasher<User>().HashPassword(u,body.Password);db.Users.Add(u);await db.SaveChangesAsync();await tx.CommitAsync();return Results.Ok();
}).RequireRateLimiting("login");
app.MapPost("/api/login",async(Login body,HttpContext ctx,AppDb db)=>{
    var u=await db.Users.SingleOrDefaultAsync(u=>u.Name==body.Name.Trim().ToLowerInvariant()&&!u.Disabled);
    if(u is null||new PasswordHasher<User>().VerifyHashedPassword(u,u.PasswordHash,body.Password)==PasswordVerificationResult.Failed)return Results.Unauthorized();
    await ctx.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity([new(ClaimTypes.NameIdentifier,u.Id.ToString()),new(ClaimTypes.Name,u.Name),new(ClaimTypes.Role,u.Role),new("version",u.SessionVersion.ToString())],CookieAuthenticationDefaults.AuthenticationScheme)));return Results.Ok(new{u.Name,u.Role});
}).RequireRateLimiting("login");
app.MapPost("/api/logout",async(HttpContext ctx)=>{await ctx.SignOutAsync();return Results.Ok();});
var api=app.MapGroup("/api").RequireAuthorization();
api.MapGet("/me",(HttpContext c)=>new{name=Actor(c),role=c.User.FindFirstValue(ClaimTypes.Role)});
api.MapGet("/dashboard",async(AppDb db)=>new{products=await db.Records.CountAsync(r=>r.Kind=="product"&&!r.Archived),recipes=await db.Records.CountAsync(r=>r.Kind=="recipe"&&!r.Archived),queued=await db.Jobs.CountAsync(j=>j.Status=="queued"),attention=await db.Jobs.CountAsync(j=>j.Status=="uncertain"||j.Status=="failed"),recent=await db.Jobs.OrderByDescending(j=>j.CreatedAt).Take(6).Select(j=>new{j.Id,j.CreatedAt,j.Status,j.Quantity,j.Actor}).ToListAsync()});
api.MapGet("/records/{kind}",async(string kind,AppDb db)=>{if(!Validation.Kinds.Contains(kind))return Results.NotFound();var rows=await db.Records.Where(r=>r.Kind==kind&&!r.Archived).OrderBy(r=>r.Key).AsNoTracking().ToListAsync();return Results.Ok(rows.Select(ToRecord));});
api.MapPost("/products/{id:guid}/label-brands",async(Guid id,LabelBrands input,AppDb db,HttpContext c)=>{
    var row=await db.Records.SingleOrDefaultAsync(r=>r.Id==id&&r.Kind=="product"&&!r.Archived);if(row is null)return Results.NotFound();if(row.Version!=input.Version)return Results.Conflict();
    var brands=input.Brands.Distinct().ToArray();if(brands.Length==0||await db.Records.CountAsync(r=>r.Kind=="brand"&&!r.Archived&&brands.Contains(r.Key))!=brands.Length)throw new InvalidOperationException("Επιλέξτε τουλάχιστον μία υπάρχουσα επωνυμία.");
    row.Data=Json.Write(row.As<Product>() with{Brands=brands});row.Version++;row.UpdatedAt=DateTimeOffset.UtcNow;db.Audits.Add(new(){Actor=Actor(c),Action="product.label-brands",RecordId=id,Detail=Json.Write(brands)});await db.SaveChangesAsync();return Results.Ok(ToRecord(row));
});
api.MapPost("/records/{kind}",async(string kind,RecordInput input,AppDb db,HttpContext c)=>{
    if(!CanEdit(c,kind))return Results.Forbid();
    var key=kind=="product"&&string.IsNullOrWhiteSpace(input.Key)?Guid.NewGuid().ToString("N"):input.Key.Trim();
    if(string.IsNullOrWhiteSpace(key))throw new InvalidOperationException("Απαιτείται μοναδική ταυτότητα.");
    var data=Validation.Check(kind,input.Data);
    if(kind=="recipe"&&Json.Read<Recipe>(data).Code!=key)throw new InvalidOperationException("Ο κωδικός σύστασης πρέπει να συμφωνεί με την ταυτότητα.");
    var row=new Record{Kind=kind,Key=key,Data=data};db.Records.Add(row);db.Audits.Add(new(){Actor=Actor(c),Action="record.create",RecordId=row.Id,Detail=row.Data});await db.SaveChangesAsync();return Results.Ok(ToRecord(row));
});
api.MapPut("/records/{id:guid}",async(Guid id,RecordInput input,AppDb db,HttpContext c)=>{
    var row=await db.Records.FindAsync(id);if(row is null)return Results.NotFound();if(!CanEdit(c,row.Kind))return Results.Forbid();if(row.Version!=input.Version)return Results.Conflict(new{message="Η εγγραφή άλλαξε. Ανανεώστε τη σελίδα."});
    var data=Validation.Check(row.Kind,input.Data);
    if(row.Kind=="recipe"&&Json.Read<Recipe>(data).Code!=row.Key)throw new InvalidOperationException("Ο κωδικός σύστασης δεν αλλάζει αφού καταχωρηθεί.");
    db.Audits.Add(new(){Actor=Actor(c),Action="record.update",RecordId=id,Detail=Json.Write(new{before=row.Data,after=data})});row.Data=data;row.Version++;row.UpdatedAt=DateTimeOffset.UtcNow;await db.SaveChangesAsync();return Results.Ok(ToRecord(row));
});
api.MapDelete("/records/{id:guid}",async(Guid id,long version,AppDb db,HttpContext c)=>{var row=await db.Records.FindAsync(id);if(row is null)return Results.NotFound();if(!Validation.Kinds.Contains(row.Kind))return Results.BadRequest();if(row.Version!=version)return Results.Conflict();row.Archived=true;row.Version++;db.Audits.Add(new(){Actor=Actor(c),Action="record.archive",RecordId=id});await db.SaveChangesAsync();return Results.Ok();}).RequireAuthorization("admin");
api.MapPost("/daily",async(DailyUpdate[] items,AppDb db,HttpContext c)=>{await using var tx=await db.Database.BeginTransactionAsync();foreach(var item in items){var row=await db.Records.SingleAsync(r=>r.Id==item.Id&&r.Kind=="product");if(row.Version!=item.Version)return Results.Conflict();row.Data=Json.Write(row.As<Product>() with{Daily=item.Daily,DailyOrder=item.Order});row.Version++;}db.Audits.Add(new(){Actor=Actor(c),Action="daily.update",Detail=Json.Write(items)});await db.SaveChangesAsync();await tx.CommitAsync();return Results.Ok();});
api.MapPost("/imports",async(HttpRequest request,ImportService service,HttpContext c)=>{
    var form=await request.ReadFormAsync();var rows=new List<ImportRow>();foreach(var file in form.Files){if(file.Length>15_000_000)throw new InvalidOperationException("Μέγιστο μέγεθος αρχείου 15 MB.");using var stream=file.OpenReadStream();var kind=file.Name;rows.AddRange(WorkbookReader.Parse(stream,kind));}return await service.Stage(rows,Actor(c));
}).RequireAuthorization("admin").DisableAntiforgery();
api.MapGet("/imports",async(AppDb db)=>await db.Imports.OrderByDescending(i=>i.At).Take(20).Select(i=>new{i.Id,i.At,i.Committed,i.Issues}).ToListAsync()).RequireAuthorization("admin");
api.MapPost("/imports/{id:guid}/commit",async(Guid id,ImportService service,HttpContext c)=>{await service.Commit(id,Actor(c));return Results.Ok();}).RequireAuthorization("admin");
api.MapPost("/preview",async(Production input,Resolver resolver,JobService jobs,HttpContext c)=>await jobs.Preview(await resolver.Resolve(input),Actor(c)));
api.MapPost("/certificates/preview",async(Certificate input,Resolver resolver,JobService jobs,HttpContext c)=>await jobs.Preview(await resolver.ResolveCertificate(input),Actor(c)));
api.MapGet("/previews/{id:guid}/{format}",async(Guid id,string format,AppDb db,AssetStore store)=>{var row=await db.Records.SingleOrDefaultAsync(r=>r.Id==id&&r.Kind=="preview");if(row is null)return Results.NotFound();var preview=row.As<PreviewData>();return Results.File(store.Read(format=="pdf"?preview.PdfHash:preview.PngHash),format=="pdf"?"application/pdf":"image/png");});
api.MapPost("/jobs",async(SubmitJob input,JobService service,HttpContext c)=>await service.Submit(input,Actor(c)));
api.MapGet("/jobs",async(AppDb db)=>await db.Jobs.OrderByDescending(j=>j.CreatedAt).Take(500).Select(j=>new{j.Id,j.Status,j.Quantity,j.Actor,j.CreatedAt,j.Detail,j.Snapshot,j.Version,j.ReprintOf}).ToListAsync());
api.MapGet("/jobs/{id:guid}/pdf",async(Guid id,AppDb db,AssetStore store)=>{var job=await db.Jobs.FindAsync(id);return job is null?Results.NotFound():Results.File(store.Read(job.PdfHash),"application/pdf");});
api.MapPost("/jobs/{id:guid}/resolve",async(Guid id,JobResolution input,AppDb db,HttpContext c)=>{var j=await db.Jobs.FindAsync(id);if(j is null)return Results.NotFound();if(j.Version!=input.Version)return Results.Conflict();if(j.Status is not ("uncertain" or "failed" or "queued")||input.Status is not ("cancelled" or "confirmed"))throw new InvalidOperationException("Μη επιτρεπτή μετάβαση.");if(string.IsNullOrWhiteSpace(input.Note))throw new InvalidOperationException("Καταγράψτε το αποτέλεσμα ελέγχου.");j.Status=input.Status;j.Detail=input.Note;j.Version++;db.Audits.Add(new(){Actor=Actor(c),Action="job.resolve",RecordId=id,Detail=input.Note});await db.SaveChangesAsync();return Results.Ok();});
api.MapPost("/jobs/{id:guid}/reprint",async(Guid id,ReprintRequest input,AppDb db,HttpContext c)=>{var source=await db.Jobs.FindAsync(id);if(source is null)return Results.NotFound();if(source.Status is "claimed" or "queued" or "uncertain")throw new InvalidOperationException("Επιλύστε πρώτα την αρχική εργασία.");if(input.Quantity is <1 or >10000||!Guid.TryParse(input.RequestKey,out _))throw new InvalidOperationException("Μη έγκυρο αίτημα.");var old=await db.Jobs.SingleOrDefaultAsync(j=>j.RequestKey==input.RequestKey);if(old!=null)return Results.Ok(old);var j=new PrintJob{RequestKey=input.RequestKey,Actor=Actor(c),PrinterId=source.PrinterId,AgentId=source.AgentId,Quantity=input.Quantity,Snapshot=source.Snapshot,PdfHash=source.PdfHash,ZplHash=source.ZplHash,ReprintOf=id};db.Jobs.Add(j);db.Audits.Add(new(){Actor=Actor(c),Action="job.reprint",RecordId=j.Id,Detail=id.ToString()});await db.SaveChangesAsync();return Results.Ok(j);});
api.MapPost("/assets",async(HttpRequest request,AssetStore store)=>{var form=await request.ReadFormAsync();var file=form.Files.Single();if(file.Length>20_000_000)throw new InvalidOperationException("Μέγιστο μέγεθος 20 MB.");using var ms=new MemoryStream();await file.CopyToAsync(ms);var bytes=ms.ToArray();var pdf=bytes.AsSpan().StartsWith("%PDF"u8);using var bitmap=pdf?null:SkiaSharp.SKBitmap.Decode(bytes);if(!pdf&&bitmap is null)throw new InvalidOperationException("Επιτρέπονται PDF και εικόνες.");return new{hash=await store.Put(bytes),type=pdf?"application/pdf":"image/png"};}).RequireAuthorization("admin").DisableAntiforgery();
api.MapGet("/assets/{hash}",(string hash,AssetStore store)=>{var bytes=store.Read(hash);return Results.File(bytes,bytes.AsSpan().StartsWith("%PDF"u8)?"application/pdf":"image/png");});
api.MapGet("/users",async(AppDb db)=>await db.Users.Select(u=>new{u.Id,u.Name,u.Role,u.Disabled}).ToListAsync()).RequireAuthorization("admin");
api.MapPost("/users",async(UserInput input,AppDb db)=>{if(input.Password.Length<12||input.Role is not ("admin" or "operator"))throw new InvalidOperationException("Ελέγξτε κωδικό (12+ χαρακτήρες) και ρόλο.");var u=new User{Name=input.Name.Trim().ToLowerInvariant(),Role=input.Role};u.PasswordHash=new PasswordHasher<User>().HashPassword(u,input.Password);db.Users.Add(u);await db.SaveChangesAsync();return Results.Ok(new{u.Id});}).RequireAuthorization("admin");
api.MapPut("/users/{id:guid}",async(Guid id,UserChange input,AppDb db,HttpContext c)=>{var u=await db.Users.FindAsync(id);if(u is null)return Results.NotFound();if(u.Id.ToString()==c.User.FindFirstValue(ClaimTypes.NameIdentifier)&&input.Disabled)throw new InvalidOperationException("Δεν μπορείτε να απενεργοποιήσετε τον εαυτό σας.");u.Disabled=input.Disabled;if(!string.IsNullOrWhiteSpace(input.Password)){if(input.Password.Length<12)throw new InvalidOperationException("Ελάχιστο μήκος 12 χαρακτήρες.");u.PasswordHash=new PasswordHasher<User>().HashPassword(u,input.Password);}u.SessionVersion++;await db.SaveChangesAsync();return Results.Ok();}).RequireAuthorization("admin");
api.MapGet("/audit",async(AppDb db)=>await db.Audits.OrderByDescending(a=>a.At).Take(500).Select(a=>new{a.Id,a.At,a.Actor,a.Action,a.RecordId}).ToListAsync()).RequireAuthorization("admin");
api.MapGet("/backup",async(AppDb db,IConfiguration config)=>new{enabled=config.GetValue<bool>("Backup:Enabled"),hour=config.GetValue("Backup:Hour",2),retentionDays=config.GetValue("Backup:RetentionDays",30),recent=await db.Audits.Where(a=>a.Action=="backup.completed"||a.Action=="backup.failed").OrderByDescending(a=>a.At).Take(10).Select(a=>new{a.At,a.Action}).ToListAsync()}).RequireAuthorization("admin");
api.MapPost("/backup",async(BackupService backups,HttpContext c)=>{var file=await backups.Backup(c.RequestAborted);return Results.File(file,"application/zip",Path.GetFileName(file));}).RequireAuthorization("admin");
api.MapPost("/agents",async(AgentInput input,AppDb db)=>{var token=Convert.ToHexString(RandomNumberGenerator.GetBytes(32));var agent=new Agent{Name=input.Name,TokenHash=AssetStore.Hash(Encoding.UTF8.GetBytes(token))};db.Agents.Add(agent);await db.SaveChangesAsync();return new{agent.Id,token};}).RequireAuthorization("admin");
api.MapGet("/agents",async(AppDb db)=>await db.Agents.Select(a=>new{a.Id,a.Name,a.Disabled,a.LastSeen}).ToListAsync()).RequireAuthorization("admin");
app.MapGet("/api/agent/claim",async(HttpContext c,AppDb db,JobService jobs)=>{var agent=await AuthenticateAgent(c,db);if(agent is null)return Results.Unauthorized();var job=await jobs.Claim(agent);return job is null?Results.NoContent():Results.Ok(job);});
app.MapGet("/api/agent/jobs/{id:guid}/artifact",async(Guid id,HttpContext c,AppDb db,AssetStore assets)=>{var agent=await AuthenticateAgent(c,db);if(agent is null)return Results.Unauthorized();var job=await db.Jobs.SingleOrDefaultAsync(j=>j.Id==id&&j.AgentId==agent.Id);return job is null?Results.NotFound():Results.File(assets.Read(job.ZplHash),"application/octet-stream");});
app.MapPost("/api/agent/jobs/{id:guid}/ack",async(Guid id,AgentAck ack,HttpContext c,AppDb db,JobService jobs)=>{var agent=await AuthenticateAgent(c,db);if(agent is null)return Results.Unauthorized();await jobs.Ack(id,agent,ack.Status,ack.Detail);return Results.Ok();});
app.MapOpenApi().RequireAuthorization("admin");
app.MapFallbackToFile("index.html");
app.Run();
static bool CanEdit(HttpContext c,string kind)=>c.User.IsInRole("admin")||kind is "draft" or "customer" or "certificate";
static object ToRecord(Record r)=>new{r.Id,r.Kind,r.Key,r.Version,r.UpdatedAt,data=JsonSerializer.Deserialize<JsonElement>(r.Data)};
static async Task<Agent?> AuthenticateAgent(HttpContext c,AppDb db){var token=c.Request.Headers.Authorization.ToString();if(!token.StartsWith("Bearer "))return null;var hash=AssetStore.Hash(Encoding.UTF8.GetBytes(token[7..]));return await db.Agents.SingleOrDefaultAsync(a=>a.TokenHash==hash&&!a.Disabled);}
public sealed record Login(string Name,string Password);
public sealed record RecordInput(string Key,long Version,JsonElement Data);
public sealed record DailyUpdate(Guid Id,long Version,bool Daily,int Order);
public sealed record LabelBrands(long Version,string[] Brands);
public sealed record JobResolution(long Version,string Status,string Note);
public sealed record ReprintRequest(string RequestKey,int Quantity);
public sealed record UserInput(string Name,string Password,string Role);
public sealed record UserChange(bool Disabled,string? Password);
public sealed record AgentInput(string Name);
public sealed record AgentAck(string Status,string Detail);
public partial class Program { }
