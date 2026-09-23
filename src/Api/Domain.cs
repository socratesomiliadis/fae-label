using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace Faethon;

public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public static string Write<T>(T value) => JsonSerializer.Serialize(value, Options);
    public static T Read<T>(string value) => JsonSerializer.Deserialize<T>(value, Options)!;
}
public sealed class Record
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Kind { get; set; } = "";
    public string Key { get; set; } = "";
    public string Data { get; set; } = "{}";
    public long Version { get; set; } = 1;
    public bool Archived { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public T As<T>() => Json.Read<T>(Data);
}
public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "operator";
    public bool Disabled { get; set; }
    public int SessionVersion { get; set; } = 1;
}
public sealed class Audit
{
    public long Id { get; set; }
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public string Actor { get; set; } = "system";
    public string Action { get; set; } = "";
    public Guid? RecordId { get; set; }
    public string Detail { get; set; } = "";
}
public sealed class ImportBatch
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public string Actor { get; set; } = "";
    public string Payload { get; set; } = "[]";
    public string Issues { get; set; } = "[]";
    public bool Committed { get; set; }
    public long Version { get; set; } = 1;
}
public sealed class PrintJob
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string RequestKey { get; set; } = "";
    public string Actor { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ClaimedAt { get; set; }
    public Guid PrinterId { get; set; }
    public Guid? AgentId { get; set; }
    public string Status { get; set; } = "queued";
    public string Snapshot { get; set; } = "{}";
    public string PdfHash { get; set; } = "";
    public string ZplHash { get; set; } = "";
    public int Quantity { get; set; }
    public Guid? ReprintOf { get; set; }
    public string Detail { get; set; } = "";
    public long Version { get; set; } = 1;
}
public sealed class Agent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string TokenHash { get; set; } = "";
    public bool Disabled { get; set; }
    public DateTimeOffset? LastSeen { get; set; }
}
public sealed class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<Record> Records => Set<Record>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Audit> Audits => Set<Audit>();
    public DbSet<ImportBatch> Imports => Set<ImportBatch>();
    public DbSet<PrintJob> Jobs => Set<PrintJob>();
    public DbSet<Agent> Agents => Set<Agent>();
    protected override void OnModelCreating(ModelBuilder m)
    {
        m.Entity<Record>().HasIndex(x => new { x.Kind, x.Key }).IsUnique();
        m.Entity<Record>().Property(x => x.Data).HasColumnType("jsonb");
        m.Entity<Record>().Property(x => x.Version).IsConcurrencyToken();
        m.Entity<User>().HasIndex(x => x.Name).IsUnique();
        m.Entity<PrintJob>().HasIndex(x => x.RequestKey).IsUnique();
        m.Entity<PrintJob>().Property(x => x.Version).IsConcurrencyToken();
        m.Entity<PrintJob>().Property(x => x.Snapshot).HasColumnType("jsonb");
        m.Entity<ImportBatch>().Property(x => x.Version).IsConcurrencyToken();
    }
}
public sealed record TextRun(string Text, bool Bold = false, bool Italic = false);
public sealed record Product
{
    public string SourceId { get; init; } = "";
    public string ErpCode { get; init; } = "";
    public string SecondaryCode { get; init; } = "";
    public string Barcode { get; init; } = "";
    public string CartonBarcode { get; init; } = "";
    public string RecipeCode { get; init; } = "";
    public string[] Brands { get; init; } = [];
    public Dictionary<string, string> Names { get; init; } = [];
    public Dictionary<string, string> Fields { get; init; } = [];
    public Dictionary<string, string> LegacyProduction { get; init; } = [];
    public bool Active { get; init; }
    public bool Daily { get; init; }
    public int DailyOrder { get; init; }
    public int ShelfLife { get; init; }
    public bool Frozen { get; init; }
}
public sealed record Recipe
{
    public string Code { get; init; } = "";
    public string Name { get; init; } = "";
    public string Family { get; init; } = "";
    public string Category { get; init; } = "";
    public string OriginKey { get; init; } = "";
    public string SpecificationAsset { get; init; } = "";
    public Dictionary<string, RecipeText> Translations { get; init; } = [];
    public Dictionary<string, string> Nutrition { get; init; } = [];
}
public sealed record RecipeText(string Ingredients = "", string Allergens = "", string Nutrition = "", TextRun[]? Runs = null);
public sealed record ReferenceData
{
    public string Name { get; init; } = "";
    public string Group { get; init; } = "";
    public Dictionary<string, string> Texts { get; init; } = [];
    public Dictionary<string, string> Manufacturer { get; init; } = [];
    public Dictionary<string, string> Origins { get; init; } = [];
    public string LogoAsset { get; init; } = "";
    public string Address { get; init; } = "";
    public string Vat { get; init; } = "";
    public string City { get; init; } = "";
    public string Country { get; init; } = "";
    public string LayoutProfile { get; init; } = "";
    public bool Complete { get; init; }
}
public sealed record Language(string Name, Dictionary<string, string> Headings, bool Complete = false);
public sealed record Template
{
    public string GeometryKey { get; init; } = "";
    public string BarcodeFormat { get; init; } = "code39";
    public string Name { get; init; } = "";
    public string Family { get; init; } = "thermal";
    public string Profile { get; init; } = "large";
    public float WidthMm { get; init; } = 148;
    public float HeightMm { get; init; } = 100;
    public float FontSize { get; init; } = 7;
    public bool Validated { get; init; }
    public string ValidationNote { get; init; } = "";
    public string[] ApprovalAssets { get; init; } = [];
    public string QrPayload { get; init; } = "";
}
public sealed record Printer
{
    public string Transport { get; init; } = "windows";
    public float DotsPerMm { get; init; } = 8;
    public float PrintableWidthMm { get; init; } = 104;
    public string Name { get; init; } = "";
    public string Queue { get; init; } = "";
    public Guid AgentId { get; init; }
    public int Dpi { get; init; } = 203;
    public float WidthMm { get; init; } = 100;
    public float HeightMm { get; init; } = 148;
    public int Rotation { get; init; } = 90;
    public int OffsetX { get; init; }
    public int OffsetY { get; init; }
    public bool Validated { get; init; }
}
public sealed record Production
{
    public Guid? ProductId { get; init; }
    public string Name { get; init; } = "";
    public DateOnly ProductionDate { get; init; } = Rules.Today();
    public DateOnly? FreezeDate { get; init; }
    public int ShelfLife { get; init; }
    public DateOnly? ExpiryOverride { get; init; }
    public decimal? Weight { get; init; }
    public int? Pieces { get; init; }
    public decimal? CartonWeight { get; init; }
    public decimal? PalletWeight { get; init; }
    public string AnimalCode { get; init; } = "";
    public string Slaughterhouse { get; init; } = "";
    public string Supplier { get; init; } = "";
    public string BrandKey { get; init; } = "1";
    public string Mode { get; init; } = "product";
    public string[] Languages { get; init; } = ["el", "en"];
    public string TemplateKey { get; init; } = "thermal-large";
    public string FreeText { get; init; } = "";
    public Guid? CustomerId { get; init; }
    public DateOnly Expiry => ExpiryOverride ?? ProductionDate.AddDays(ShelfLife);
}
public sealed record Certificate
{
    public string Name { get; init; } = "";
    public Guid CustomerId { get; init; }
    public string Vehicle { get; init; } = "";
    public string Trailer { get; init; } = "";
    public DateOnly ShipmentDate { get; init; } = Rules.Today();
    public string TemplateKey { get; init; } = "certificate-bg";
    public string[] Languages { get; init; } = ["bg"];
    public CertificateLine[] Lines { get; init; } = [];
    public string Notes { get; init; } = "";
}
public sealed record CertificateLine(Guid ProductId, decimal Weight, string Lot, DateOnly ProductionDate, DateOnly ExpiryDate, DateOnly? FreezeDate);
public static partial class Rules
{
    public static DateOnly Today() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow, "Europe/Athens").DateTime);
    public static string Lot(DateOnly date, string family, string erp, bool frozen)
    {
        if (!ErpPattern().IsMatch(erp) || !Regex.IsMatch(family, "^[0-9]{2}$")) throw new InvalidOperationException("Μη έγκυρος κωδικός είδους ή οικογένειας για LOT.");
        var week = CultureInfo.InvariantCulture.Calendar.GetWeekOfYear(date.ToDateTime(TimeOnly.MinValue), CalendarWeekRule.FirstDay, DayOfWeek.Sunday);
        return $"{week:00}/{date.Year % 100:00}/{family}/{erp.Replace("-", "")}/{(frozen ? 0 : (int)date.DayOfWeek + 1)}";
    }
    [GeneratedRegex("^[0-9]-[0-9]{3}-[0-9]-[0-9]{3}$")] public static partial Regex ErpPattern();
    public static void ValidateProduction(Production p)
    {
        if (p.ShelfLife is < 0 or > 9999 || p.Expiry < p.ProductionDate || p.FreezeDate < p.ProductionDate || p.FreezeDate > p.Expiry)
            throw new InvalidOperationException("Ελέγξτε ημερομηνίες και ημέρες λήξης (0–9999).");
        if (p.Weight < 0 || p.CartonWeight < 0 || p.PalletWeight < 0 || p.Pieces < 0) throw new InvalidOperationException("Τα βάρη και τα τεμάχια δεν μπορούν να είναι αρνητικά.");
        if (p.Languages.Length is < 1 or > 2 || p.Languages.Distinct().Count() != p.Languages.Length) throw new InvalidOperationException("Επιλέξτε μία ή δύο διαφορετικές γλώσσες.");
    }
}
