using Xunit;

namespace Faethon.Tests;

internal static class TestEnvironment
{
    public static string Root { get; } = FindRoot();
    public static string ImportDirectory => Environment.GetEnvironmentVariable("FAETHON_IMPORT_SOURCE")
        ?? Path.Combine(Root, "data", "imports");
    public static string PgDump => Environment.GetEnvironmentVariable("FAETHON_PG_DUMP")
        ?? new[] {
            Path.Combine(Root, ".tools", "postgres", "pgsql", "bin", "pg_dump.exe"),
            "/opt/homebrew/opt/libpq/bin/pg_dump", "/usr/local/opt/libpq/bin/pg_dump"
        }.FirstOrDefault(File.Exists) ?? "pg_dump";
    private static string FindRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "Faethon.slnx"))) return dir.FullName;
        throw new DirectoryNotFoundException("Cannot find Faethon.slnx above the test output.");
    }
}

// Private source workbooks are not in Git. Explicitly configured bad paths still fail.
public sealed class WorkbookFactAttribute : FactAttribute
{
    public WorkbookFactAttribute()
    {
        if (Environment.GetEnvironmentVariable("FAETHON_IMPORT_SOURCE") is null &&
            new[] { "PROIONTA.xlsx", "SYNTAGES.xlsx" }.Any(name => !File.Exists(Path.Combine(TestEnvironment.ImportDirectory, name))))
            Skip = "Supply PROIONTA.xlsx and SYNTAGES.xlsx in data/imports or set FAETHON_IMPORT_SOURCE to run real-data regressions.";
    }
}
