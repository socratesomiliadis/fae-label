using System.Drawing.Printing;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

var builder=Host.CreateApplicationBuilder(args);builder.Services.AddWindowsService(o=>o.ServiceName="Faethon Print Helper");builder.Services.AddHostedService<PrintWorker>();await builder.Build().RunAsync();
public sealed record Dispatch(Guid Id,string Queue,string Transport,int Quantity,string ArtifactUrl,string ArtifactHash,float WidthMm,float HeightMm,int Dpi,float PaperWidthMm,float PaperHeightMm,int Rotation,int OffsetX,int OffsetY,float DotsPerMm);
public sealed record LedgerEntry(Guid Id,string Status,string Detail,bool Acknowledged=false);
public sealed class PrintWorker(IConfiguration config,ILogger<PrintWorker> logger):BackgroundService
{
    private readonly JsonSerializerOptions json=new(JsonSerializerDefaults.Web);
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        string root=Path.GetFullPath(config["Ledger"]??"ledger");Directory.CreateDirectory(root);
        using var client=new HttpClient{BaseAddress=new Uri(config["Backend"]??"http://localhost:5080"),Timeout=TimeSpan.FromSeconds(30)};
        client.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",config["Token"]??"");
        var queues=config.GetSection("AllowedQueues").Get<string[]>()??[];
        while(!stop.IsCancellationRequested)
        {
            try
            {
                foreach(var file in Directory.GetFiles(root,"*.json"))
                {
                    var entry=JsonSerializer.Deserialize<LedgerEntry>(await File.ReadAllTextAsync(file,stop),json)!;if(entry.Acknowledged)continue;
                    if(entry.Status=="dispatching"){entry=entry with{Status="uncertain",Detail="Helper restarted during spool submission; inspect printer output before reprinting."};await Save(root,entry,stop);}
                    using var ack=await client.PostAsJsonAsync($"/api/agent/jobs/{entry.Id}/ack",new{entry.Status,entry.Detail},stop);ack.EnsureSuccessStatusCode();await Save(root,entry with{Acknowledged=true},stop);
                }
                if(!config.GetValue<bool>("DispatchEnabled")){await Task.Delay(3000,stop);continue;}
                using var response=await client.GetAsync("/api/agent/claim",stop);if(response.StatusCode==HttpStatusCode.NoContent){await Task.Delay(2000,stop);continue;}response.EnsureSuccessStatusCode();
                var job=(await response.Content.ReadFromJsonAsync<Dispatch>(stop))!;var path=Path.Combine(root,job.Id+".json");
                if(File.Exists(path))continue; // A durable entry can never be automatically dispatched twice.
                if(!queues.Contains(job.Queue,StringComparer.Ordinal)){await Save(root,new(job.Id,"failed","Queue is not allowlisted on this helper."),stop);continue;}
                var bytes=await client.GetByteArrayAsync(job.ArtifactUrl,stop);if(!Convert.ToHexStringLower(SHA256.HashData(bytes)).Equals(job.ArtifactHash,StringComparison.Ordinal))throw new IOException("Artifact hash mismatch");
                await Save(root,new(job.Id,"dispatching","Spool submission started"),stop);
                try
                {
                    if(job.Transport=="zpl")RawPrinter.Print(job.Queue,bytes,job.Quantity);
                    else if(job.Transport=="windows")PrintDocument(job,bytes);
                    else throw new IOException("Unknown transport");
                    await Save(root,new(job.Id,"submitted","Accepted by Windows spooler; physical printing is not confirmed."),stop);
                }
                catch(Exception e){await Save(root,new(job.Id,"uncertain",e.Message),CancellationToken.None);logger.LogError(e,"Submission uncertain for {JobId}",job.Id);}
            }
            catch(Exception e) when(e is not OperationCanceledException){logger.LogError(e,"Print helper polling failed");}
            await Task.Delay(2000,stop);
        }
    }
    private async Task Save(string root,LedgerEntry entry,CancellationToken ct)
    {
        var path=Path.Combine(root,entry.Id+".json");var temp=path+".tmp";var bytes=JsonSerializer.SerializeToUtf8Bytes(entry,json);
        await using(var stream=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None,4096,FileOptions.WriteThrough)){await stream.WriteAsync(bytes,ct);stream.Flush(true);}File.Move(temp,path,true);
    }
    private static void PrintDocument(Dispatch job,byte[] bytes)
    {
        using var imageStream=new MemoryStream(bytes);using var image=System.Drawing.Image.FromStream(imageStream);
        using var document=new System.Drawing.Printing.PrintDocument{PrintController=new StandardPrintController(),DocumentName="Faethon "+job.Id};
        document.PrinterSettings.PrinterName=job.Queue;if(!document.PrinterSettings.IsValid)throw new IOException("Windows printer unavailable");
        // Copies are explicit pages below; never multiply them by queue defaults.
        document.PrinterSettings.Copies=1;
        if(document.PrinterSettings.CanDuplex)document.PrinterSettings.Duplex=Duplex.Simplex;
        document.DefaultPageSettings.Landscape=job.Rotation is 90 or 270;
        document.DefaultPageSettings.PaperSize=new PaperSize("Faethon media",(int)Math.Round(job.PaperWidthMm/25.4*100),(int)Math.Round(job.PaperHeightMm/25.4*100));
        document.DefaultPageSettings.Margins=new Margins(0,0,0,0);
        int printed=0;
        document.PrintPage+=(_,e)=>{var g=e.Graphics??throw new IOException("Missing print surface");g.TranslateTransform(-e.PageSettings.HardMarginX+job.OffsetX/job.DotsPerMm/25.4f*100,-e.PageSettings.HardMarginY+job.OffsetY/job.DotsPerMm/25.4f*100);g.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;g.PixelOffsetMode=System.Drawing.Drawing2D.PixelOffsetMode.Half;g.DrawImage(image,new System.Drawing.RectangleF(0,0,job.WidthMm/25.4f*100,job.HeightMm/25.4f*100));printed++;e.HasMorePages=printed<job.Quantity;};
        document.Print();
    }
}
internal static class RawPrinter
{
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]private sealed class DocInfo{[MarshalAs(UnmanagedType.LPWStr)]public string Name="Faethon";[MarshalAs(UnmanagedType.LPWStr)]public string? Output;[MarshalAs(UnmanagedType.LPWStr)]public string DataType="RAW";}
    [DllImport("winspool.drv",EntryPoint="OpenPrinterW",CharSet=CharSet.Unicode,SetLastError=true)]private static extern bool OpenPrinter(string name,out IntPtr handle,IntPtr defaults);
    [DllImport("winspool.drv",EntryPoint="StartDocPrinterW",CharSet=CharSet.Unicode,SetLastError=true)]private static extern int StartDoc(IntPtr handle,int level,DocInfo doc);
    [DllImport("winspool.drv",SetLastError=true)]private static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv",SetLastError=true)]private static extern bool WritePrinter(IntPtr h,byte[] bytes,int count,out int written);
    [DllImport("winspool.drv",SetLastError=true)]private static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv",SetLastError=true)]private static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv")]private static extern bool ClosePrinter(IntPtr h);
    public static void Print(string queue,byte[] bytes,int copies)
    {
        if(!OpenPrinter(queue,out var h,IntPtr.Zero))throw new System.ComponentModel.Win32Exception();
        try{if(StartDoc(h,1,new DocInfo())==0)throw new System.ComponentModel.Win32Exception();try{for(var i=0;i<copies;i++){if(!StartPagePrinter(h))throw new System.ComponentModel.Win32Exception();if(!WritePrinter(h,bytes,bytes.Length,out var written)||written!=bytes.Length)throw new IOException("Incomplete spool write");if(!EndPagePrinter(h))throw new System.ComponentModel.Win32Exception();}}finally{if(!EndDocPrinter(h))throw new System.ComponentModel.Win32Exception();}}finally{ClosePrinter(h);}
    }
}
