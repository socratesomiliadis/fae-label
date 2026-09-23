using System.Diagnostics;
using System.IO.Compression;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
namespace Faethon;
public sealed class BackupService(IServiceScopeFactory scopes,IConfiguration config,AssetStore assets,ILogger<BackupService> logger):BackgroundService
{
    private DateOnly? last;
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while(!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var local=TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow,"Europe/Athens");
                if(config.GetValue<bool>("Backup:Enabled")&&last!=DateOnly.FromDateTime(local.Date)&&local.Hour>=config.GetValue("Backup:Hour",2))
                {
                    await Backup(stoppingToken);last=DateOnly.FromDateTime(local.Date);
                }
            }
            catch(Exception e) when(e is not OperationCanceledException){logger.LogError(e,"Backup failed");using var scope=scopes.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDb>();try{db.Audits.Add(new(){Action="backup.failed",Detail=e.Message});await db.SaveChangesAsync(stoppingToken);}catch(Exception logError){logger.LogError(logError,"Cannot record backup failure");}}
            await Task.Delay(TimeSpan.FromMinutes(1),stoppingToken);
        }
    }
    public async Task<string> Backup(CancellationToken ct)
    {
        var dir=Path.GetFullPath(config["Backup:Directory"]??"backups");Directory.CreateDirectory(dir);
        var work=Path.Combine(dir,"pending-"+Guid.NewGuid());Directory.CreateDirectory(work);
        var cs=new NpgsqlConnectionStringBuilder(config.GetConnectionString("Database"));
        var start=new ProcessStartInfo(config["Backup:PgDump"]??"pg_dump"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardError=true};
        foreach(var a in new[]{"-h",cs.Host??"localhost","-p",cs.Port.ToString(),"-U",cs.Username??"","-d",cs.Database??"","-Fc","-f",Path.Combine(work,"database.dump")})start.ArgumentList.Add(a);
        start.Environment["PGPASSWORD"]=cs.Password??"";
        using var p=Process.Start(start)??throw new IOException("Cannot start pg_dump");var stderr=p.StandardError.ReadToEndAsync(ct);await p.WaitForExitAsync(ct);if(p.ExitCode!=0)throw new IOException("pg_dump failed: "+await stderr);
        // Assets are content-addressed and never modified/deleted: copying after
        // the database snapshot includes every artifact referenced by that dump.
        var target=Path.Combine(work,"assets");Directory.CreateDirectory(target);
        foreach(var file in Directory.EnumerateFiles(Path.Combine(assets.Root,"assets"))){if(Path.GetFileName(file).Length==64)File.Copy(file,Path.Combine(target,Path.GetFileName(file)));}
        await File.WriteAllTextAsync(Path.Combine(work,"manifest.json"),JsonSerializer.Serialize(new{createdAt=DateTimeOffset.UtcNow,format=1,database="PostgreSQL",files=Directory.GetFiles(target).Length}),ct);
        var output=Path.Combine(dir,$"faethon-{DateTime.UtcNow:yyyyMMdd-HHmmss}.zip");ZipFile.CreateFromDirectory(work,output);Directory.Delete(work,true);
        var cutoff=DateTime.UtcNow.AddDays(-config.GetValue("Backup:RetentionDays",30));foreach(var file in Directory.EnumerateFiles(dir,"faethon-*.zip")){if(File.GetLastWriteTimeUtc(file)<cutoff)File.Delete(file);}
        using var scope=scopes.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDb>();db.Audits.Add(new(){Action="backup.completed",Detail=output});await db.SaveChangesAsync(ct);return output;
    }
}
