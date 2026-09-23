using System.Security.Cryptography;
namespace Faethon;
public sealed class AssetStore
{
    public string Root { get; }
    public AssetStore(IConfiguration config){Root=Path.GetFullPath(config["Storage"]??"data");Directory.CreateDirectory(Path.Combine(Root,"assets"));}
    public static string Hash(byte[] value)=>Convert.ToHexStringLower(SHA256.HashData(value));
    public async Task<string> Put(byte[] bytes)
    {
        var hash=Hash(bytes);var path=PathFor(hash);
        if(!File.Exists(path)){var temp=path+"."+Guid.NewGuid()+".tmp";await File.WriteAllBytesAsync(temp,bytes);try{File.Move(temp,path,false);}catch(IOException) when(File.Exists(path)){File.Delete(temp);}}
        return hash;
    }
    public string PathFor(string hash){if(hash.Length!=64||!hash.All(Uri.IsHexDigit))throw new InvalidOperationException("Μη έγκυρο αρχείο.");return Path.Combine(Root,"assets",hash);}
    public byte[] Read(string hash)=>File.ReadAllBytes(PathFor(hash));
}
