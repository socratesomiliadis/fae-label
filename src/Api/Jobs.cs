using Microsoft.EntityFrameworkCore;
namespace Faethon;
public sealed record PreviewData(Snapshot Snapshot,string PdfHash,string PngHash);
public sealed record PreviewResult(Guid Id,string PdfUrl,string ImageUrl,string[] Issues,string Lot,string Expiry,string SourceReport="",int PageCount=1);
public sealed record SubmitJob(Guid PreviewId,Guid PrinterId,int Quantity,string RequestKey);
public sealed record Dispatch(Guid Id,string Queue,string Transport,int Quantity,string ArtifactUrl,string ArtifactHash,float WidthMm,float HeightMm,int Dpi,float PaperWidthMm,float PaperHeightMm,int Rotation,int OffsetX,int OffsetY,float DotsPerMm);
public sealed class JobService(AppDb db,Rendering rendering,AssetStore assets)
{
    public async Task<PreviewResult> Preview(Snapshot snapshot,string actor)
    {
        var rendered=rendering.Render(snapshot);snapshot=snapshot with{Issues=snapshot.Issues.Concat(rendered.Issues).Distinct().ToArray()};
        var pdf=await assets.Put(rendered.Pdf);var png=await assets.Put(rendered.Png);
        var row=new Record{Kind="preview",Key=Guid.NewGuid().ToString(),Data=Json.Write(new PreviewData(snapshot,pdf,png))};
        db.Records.Add(row);db.Audits.Add(new(){Actor=actor,Action="preview",RecordId=row.Id});await db.SaveChangesAsync();
        return new(row.Id,$"/api/previews/{row.Id}/pdf",$"/api/previews/{row.Id}/image",snapshot.Issues,snapshot.Lot,snapshot.Production.Expiry.ToString("yyyy-MM-dd"),snapshot.Template.GeometryKey,rendered.PageCount);
    }
    public async Task<PrintJob> Submit(SubmitJob request,string actor)
    {
        if(request.Quantity is <1 or >10000 || !Guid.TryParse(request.RequestKey,out _))throw new InvalidOperationException("Μη έγκυρη ποσότητα ή ταυτότητα αιτήματος.");
        var old=await db.Jobs.SingleOrDefaultAsync(j=>j.RequestKey==request.RequestKey);if(old!=null)return old;
        var preview=(await db.Records.SingleAsync(r=>r.Id==request.PreviewId&&r.Kind=="preview")).As<PreviewData>();
        if(preview.Snapshot.Issues.Length>0)throw new InvalidOperationException(string.Join("\n",preview.Snapshot.Issues));
        foreach(var version in preview.Snapshot.Versions){var parts=version.Key.Split(':',2);if(!await db.Records.AnyAsync(r=>r.Kind==parts[0]&&r.Key==parts[1]&&r.Version==version.Value&&!r.Archived))throw new InvalidOperationException("Τα στοιχεία άλλαξαν. Δημιουργήστε νέα προεπισκόπηση.");}
        var row=await db.Records.SingleAsync(r=>r.Id==request.PrinterId&&r.Kind=="printer"&&!r.Archived);var printer=row.As<Printer>();
        if(!printer.Validated||printer.AgentId==Guid.Empty||!await db.Agents.AnyAsync(a=>a.Id==printer.AgentId&&!a.Disabled))throw new InvalidOperationException("Ο εκτυπωτής δεν έχει επικυρωθεί ή συνδεθεί με βοηθό.");
        var a4=preview.Snapshot.Template.Profile=="a4";
        if(a4)printer=printer with{Rotation=preview.Snapshot.Template.WidthMm>preview.Snapshot.Template.HeightMm?90:0};
        if(a4&&printer.WidthMm<200 || !a4&&printer.WidthMm>=200)throw new InvalidOperationException("Επιλέξτε κατάλληλο εκτυπωτή για το πρότυπο.");
        var raster=rendering.Raster(preview.Snapshot,printer);var hash=await assets.Put(raster);
        var job=new PrintJob{Actor=actor,RequestKey=request.RequestKey,PrinterId=row.Id,AgentId=printer.AgentId,Quantity=request.Quantity,Snapshot=Json.Write(new JobSnapshot(preview.Snapshot,printer,row.Version)),PdfHash=preview.PdfHash,ZplHash=hash};
        db.Jobs.Add(job);db.Audits.Add(new(){Actor=actor,Action="job.create",RecordId=job.Id});await db.SaveChangesAsync();return job;
    }
    public async Task<Dispatch?> Claim(Agent agent)
    {
        await using var transaction=await db.Database.BeginTransactionAsync();
        // One in-flight job per agent, hence per assigned queue. PostgreSQL lock excludes competing polls.
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({agent.Id.ToString()}))");
        var inFlight=await db.Jobs.Where(j=>j.AgentId==agent.Id&&(j.Status=="claimed"||j.Status=="uncertain")).ToListAsync();
        foreach(var stale in inFlight.Where(j=>j.Status=="claimed"&&j.ClaimedAt<DateTimeOffset.UtcNow.AddMinutes(-5))){stale.Status="uncertain";stale.Detail="Δεν επιβεβαιώθηκε η υποβολή. Απαιτείται έλεγχος χειριστή.";stale.Version++;}
        if(inFlight.Count>0){await db.SaveChangesAsync();await transaction.CommitAsync();return null;}
        var job=await db.Jobs.Where(j=>j.AgentId==agent.Id&&j.Status=="queued").OrderBy(j=>j.CreatedAt).FirstOrDefaultAsync();
        if(job is null){await transaction.CommitAsync();return null;}
        job.Status="claimed";job.ClaimedAt=DateTimeOffset.UtcNow;job.Version++;agent.LastSeen=DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();await transaction.CommitAsync();var snap=Json.Read<JobSnapshot>(job.Snapshot);
        return new(job.Id,snap.Printer.Queue,snap.Printer.Transport,job.Quantity,$"/api/agent/jobs/{job.Id}/artifact",job.ZplHash,snap.Content.Template.WidthMm,snap.Content.Template.HeightMm,snap.Printer.Dpi,snap.Printer.WidthMm,snap.Printer.HeightMm,snap.Printer.Rotation,snap.Printer.OffsetX,snap.Printer.OffsetY,snap.Printer.DotsPerMm);
    }
    public async Task Ack(Guid id,Agent agent,string status,string detail)
    {
        if(status is not ("submitted" or "uncertain" or "failed"))throw new InvalidOperationException("Μη έγκυρη κατάσταση.");
        var job=await db.Jobs.SingleAsync(j=>j.Id==id&&j.AgentId==agent.Id);
        if(job.Status==status)return;
        if(job.Status is not ("claimed" or "uncertain"))throw new InvalidOperationException("Η εργασία δεν δέχεται αυτή τη μετάβαση.");
        job.Status=status;job.Detail=detail.Length>1000?detail[..1000]:detail;job.Version++;db.Audits.Add(new(){Actor=agent.Name,Action="job."+status,RecordId=id,Detail=job.Detail});await db.SaveChangesAsync();
    }
}
public sealed record JobSnapshot(Snapshot Content,Printer Printer,long PrinterVersion);
