using Microsoft.EntityFrameworkCore;
namespace Faethon;
public static class LegacyAssets
{
    public static async Task Import(AppDb db,AssetStore store,string root)
    {
        var manifest=Path.Combine(root,"asset-manifest.json");if(!File.Exists(manifest))return;
        var assets=Json.Read<AssetManifest[]>(await File.ReadAllTextAsync(manifest));
        foreach(var a in assets){var bytes=await File.ReadAllBytesAsync(Path.Combine(root,"assets",a.File));if(AssetStore.Hash(bytes)!=a.Hash)throw new InvalidOperationException("Legacy asset checksum mismatch: "+a.File);await store.Put(bytes);}
        foreach(var lang in await db.Records.Where(r=>r.Kind=="language").ToListAsync())
        {
            var content=lang.As<Language>();var headings=new Dictionary<string,string>(content.Headings);
            if(SharedLayout.Captions.TryGetValue(lang.Key,out var captions))foreach(var caption in captions)headings.TryAdd(caption.Key,caption.Value);
            lang.Data=Json.Write(content with{Headings=headings});lang.Version++;
        }
        var brand=await db.Records.SingleAsync(r=>r.Kind=="brand"&&r.Key=="1");var b=brand.As<ReferenceData>();if(b.LogoAsset.Length==0){brand.Data=Json.Write(b with{LogoAsset=assets.First(a=>a.Name=="LOGO 4").Hash});brand.Version++;}
        await db.SaveChangesAsync();
    }
    private sealed record AssetManifest(string File,string Name,string Hash);
}
