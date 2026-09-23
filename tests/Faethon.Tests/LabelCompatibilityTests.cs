using Faethon;
using Xunit;

namespace Faethon.Tests;
public sealed class LabelCompatibilityTests
{
    [Fact]
    public void EveryRecoveredReportAcceptsItsOwnCombinationButRejectsOtherLanguagesAndModes()
    {
        foreach (var report in SharedLayout.Catalog.Where(r => !r.Family.StartsWith("certificate") && r.Family != "reference-list"))
        {
            var template = new Template { LegacyReport = report.Report, Family = report.Family, Profile = report.Profile };
            var production = new Production { BrandKey = report.Brand, Mode = report.Mode, Languages = report.Languages };
            Assert.True(LabelCompatibility.Supports(template, production, null), report.Report);
            Assert.False(LabelCompatibility.Supports(template, production with { Languages = ["xx"] }, null), report.Report);
            Assert.False(LabelCompatibility.Supports(template, production with { Mode = "invalid" }, null), report.Report);
        }
    }

    [Theory]
    [InlineData("thermal-large", "thermal", "large", "NEW BRAND", "product", "el,en", true)]
    [InlineData("thermal-large", "thermal", "large", "NEW BRAND", "product", "de,ro", false)]
    [InlineData("thermal-small", "thermal", "small", "IONIC", "product", "el", true)]
    [InlineData("thermal-small", "thermal", "small", "IONIC", "product", "de", false)]
    [InlineData("thermal-small", "thermal", "small", "FAETHON", "product", "el,en", false)]
    [InlineData("thermal-large", "thermal", "large", "MAVROUDIS", "carton", "de,en", true)]
    [InlineData("thermal-large", "thermal", "large", "METEORA", "product", "ro,en", true)]
    [InlineData("thermal-large", "thermal", "large", "FAETHON", "product", "ro,en", false)]
    [InlineData("thermal-large", "thermal", "large", "FAETHON", "blank", "el,en", false)]
    [InlineData("pallet-a4", "pallet", "a4", "FAETHON", "carton", "el,en", false)]
    [InlineData("pallet-a4", "pallet", "a4", "FAETHON", "product", "el", false)]
    [InlineData("sample-blank", "sample", "small", "FAETHON", "blank", "de", true)]
    [InlineData("sample-blank", "sample", "small", "FAETHON", "product", "el", false)]
    [InlineData("sample-small", "sample", "small", "FAETHON", "product", "en", false)]
    [InlineData("butcher-a4", "butcher", "a4", "FAETHON", "blank", "el,en", false)]
    [InlineData("production-small", "production", "small", "FAETHON", "blank", "el", true)]
    public void BuiltinOptionsFollowTheActualReports(string geometry, string family, string profile, string brand, string mode, string languages, bool expected)
    {
        Assert.Equal(expected, LabelCompatibility.Supports(new Template { GeometryKey = geometry, Family = family, Profile = profile },
            new Production { BrandKey = brand, Mode = mode, Languages = languages.Split(',') }, new ReferenceData { LegacyBrand = brand }));
    }
}
