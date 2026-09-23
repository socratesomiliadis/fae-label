using Microsoft.EntityFrameworkCore;
using System.Text.Json.Nodes;

namespace Faethon;

// Transcribed from the real GR/EN label supplied on 24 September 2026.
// Keys are verified against product 113 / ERP 3-106-2-000 / recipe 1031.
// This is a limited recovery of observed values, not an export of the entire backend.
public static class LegacyLabelSeed
{
    public static readonly Dictionary<string,string> CompanyNames=new(){{"el","ΦΑΕΘΩΝ ΑΒΕΕ"},{"en","FAETHON SA"}};
    public static readonly Dictionary<string,string> CompanyDetails=new()
    {
        {"el","Βιομηχανία Επεξ/σίας & Τυποπ/σης Κρέατος & Κρεατοσκευασμάτων\n6ο χλμ. Σιδηροκάστρου - Προμαχώνα, Σέρρες, ΤΚ 62300, Ελλάδα\nΤηλ: +30 23230 28160-167, Email: sales@faethon.eu"},
        {"en","Meat Processing & Packaging - Food Trading\n6th km Sidirokastrou - Promachona, Serres, 62300, Greece\nTel: +30 23230 28160-167, Email: sales@faethon.eu"}
    };
    public static readonly Dictionary<string,Dictionary<string,string>> References=new()
    {
        ["category:Β1"]=new(){{"el","ΚΑΤΗΓΟΡΙΑ Β1: Παρασκευάσματα από τεμάχια κρέατος"},{"en","CLASS B1: Preparations from meat pieces"}},
        ["origin:1"]=new(){{"el","Εκτροφή & Σφαγή: Γερμανία, Ολλανδία, Δανία"},{"en","Reared & Slaughtered: Deutschland, Netherland, Denmark"}},
        ["packaging:HOR"]=new(){{"el","HORECA"},{"en","HORECA"}},
        ["condition:ΝΩΠΟ"]=new(){{"el","ΝΩΠΟ"},{"en","RAW"}},
        ["instructions:1"]=new()
        {
            {"el","<u><b>Οδηγίες Χρήσης:</b></u> Να καταναλωθεί μετά από Θερμική Επεξεργασία.<br><u><b>Διατήρηση:</b></u> Κατεψυγμένα&lt;-18°C/Νωπά&lt;2°C. Απαγορεύεται η επανακατάψυξη του προϊόντος εάν έχει αποψυχθεί.Μετά την απόψυξη(2/+2°C)το προϊόν διατηρείται έως 2 ημέρες στους 2/+2°C"},
            {"en","<u><b>Way of Use:</b></u> To be consumed after heat treatment.<br><u><b>Preservation:</b></u> Preserve frozen &lt; -18 °C / Preserve raw &lt; 2 °C. Refreezing if defrosted is forbidden.<br>After defrosting (2/+2°C) the product may have a maximum shelf life of 2 days under 2/+2°C."}
        }
    };
    private static Dictionary<string,string> Fill(Dictionary<string,string> existing,Dictionary<string,string> recovered)
    {
        var result=new Dictionary<string,string>(existing);
        foreach(var (lang,value) in recovered)if(!result.TryGetValue(lang,out var current)||string.IsNullOrWhiteSpace(current))result[lang]=value;
        return result;
    }
    private static void Update(Record row,ReferenceData value)
    {
        var json=Json.Write(value);
        if(JsonNode.DeepEquals(JsonNode.Parse(json),JsonNode.Parse(row.Data)))return;
        row.Data=json;row.Version++;row.UpdatedAt=DateTimeOffset.UtcNow;
    }
    public static async Task Apply(AppDb db)
    {
        var brandRow=await db.Records.SingleOrDefaultAsync(r=>r.Kind=="brand"&&r.Key=="1"&&!r.Archived);
        if(brandRow is not null)
        {
            var brand=brandRow.As<ReferenceData>();
            // Only repair the known FAETHON seed, never a different brand reusing its key.
            if(brand.Name is "ΦΑΕΘΩΝ" or "ΦΑΕΘΩΝ ΑΒΕΕ")
            {
                var names=Fill(brand.Names,CompanyNames);
                if(!brand.Complete)
                {
                    if(names.GetValueOrDefault("el")=="ΦΑΕΘΩΝ")names["el"]=CompanyNames["el"];
                    if(names.GetValueOrDefault("en")=="FAETHON")names["en"]=CompanyNames["en"];
                }
                Update(brandRow,brand with{Names=names,Texts=Fill(brand.Texts,CompanyDetails),Complete=true});
            }
        }
        foreach(var (key,texts) in References)
        {
            var row=await db.Records.SingleOrDefaultAsync(r=>r.Kind=="reference"&&r.Key==key);
            if(row?.Archived==true)continue;
            if(row is null)
            {
                row=new(){Kind="reference",Key=key,Data=Json.Write(new ReferenceData{Name=key.Split(':')[1],Group=key.Split(':')[0]})};db.Records.Add(row);
            }
            var value=row.As<ReferenceData>();var merged=Fill(value.Texts,texts);
            if(key=="condition:ΝΩΠΟ"&&!value.Complete&&merged.GetValueOrDefault("en")=="FRESH")merged["en"]="RAW";
            Update(row,value with{Texts=merged,Complete=true});
        }
        await ApplyRecipeEmphasis(db);
        await db.SaveChangesAsync();
    }
    public static async Task ApplyRecipeEmphasis(AppDb db)
    {
        var row=await db.Records.SingleOrDefaultAsync(r=>r.Kind=="recipe"&&r.Key=="1031"&&!r.Archived);
        if(row is null)return;
        var recipe=row.As<Recipe>();var translations=new Dictionary<string,RecipeText>(recipe.Translations);bool changed=false;
        foreach(var (language,prefix,allergens) in new[]{
            ("el","Πιθανόν να περιέχει ίχνη από: ","γλουτένη, σόγια, λακτόζη, σέλινο και σινάπι."),
            ("en","It may contain traces of: ","gluten, soy, lactose, celery and mustard.")})
            if(translations.TryGetValue(language,out var text)&&text.Allergens==prefix+allergens)
            {translations[language]=text with{Allergens=prefix+"<b>"+allergens+"</b>"};changed=true;}
        if(changed){row.Data=Json.Write(recipe with{Translations=translations});row.Version++;row.UpdatedAt=DateTimeOffset.UtcNow;}
    }
}
