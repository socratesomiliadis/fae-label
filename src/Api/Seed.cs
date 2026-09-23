using Microsoft.EntityFrameworkCore;
namespace Faethon;
public static class Seed
{
    public static async Task Run(AppDb db)
    {
        async Task Add(string kind,string key,object value){if(!await db.Records.AnyAsync(r=>r.Kind==kind&&r.Key==key))db.Records.Add(new(){Kind=kind,Key=key,Data=Json.Write(value)});}
        string[] names=["Ελληνικά","English","Deutsch","Български","Română","Français","Italiano","Español","Polski","Nederlands","Português","Čeština","Svenska","Magyar","Hrvatski","Shqip"];
        var el=new Dictionary<string,string>{{"ingredients","Συστατικά"},{"allergens","Αλλεργιογόνα"},{"nutrition","ΔΙΑΤΡΟΦΙΚΑ ΣΤΟΙΧΕΙΑ"},{"origin","Εκτροφή & Σφαγή"},{"instructions","Οδηγίες χρήσης"},{"production","Ημερ. Παραγωγής"},{"freeze","Ημερ. Κατάψυξης"},{"expiry","Ανάλωση έως"},{"weight","Καθαρό βάρος"},{"carton","Βάρος κιβωτίου"},{"pieces","Τεμ./κιβ."},{"pallet","Βάρος παλέτας"},{"condition","Κατάσταση"},{"frozen","ΚΤΨ"},{"fresh","ΝΩΠΟ"},{"packaging","Συσκευασία"},{"animal","Κωδικός ζώου"},{"slaughterhouse","Αρ. έγκρ. σφαγείου"},{"supplier","Προμηθευτής"},{"sample","ΔΕΙΓΜΑ"},{"certificate","ΠΙΣΤΟΠΟΙΗΤΙΚΟ"}};
        var en=new Dictionary<string,string>{{"ingredients","Ingredients"},{"allergens","Allergens"},{"nutrition","NUTRITION FACTS"},{"origin","Reared & Slaughtered"},{"instructions","Instructions"},{"production","Production date"},{"freeze","Freeze date"},{"expiry","Use by"},{"weight","Net weight"},{"carton","Carton weight"},{"pieces","Pieces/carton"},{"pallet","Pallet weight"},{"condition","Condition"},{"frozen","FROZEN"},{"fresh","FRESH"},{"packaging","Packaging"},{"animal","Animal code"},{"slaughterhouse","Slaughterhouse approval"},{"supplier","Supplier"},{"sample","SAMPLE"},{"certificate","CERTIFICATE"}};
        for(var i=0;i<names.Length;i++)await Add("language",WorkbookReader.Languages[i],new Language(names[i],i==0?el:i==1?en:[],i<2));
        (string Key,string Name,string Family,string Profile,float W,float H)[] templates=[
            ("thermal-large","Μεγάλη δίγλωσση ετικέτα","thermal","large",148,100),
            ("thermal-small","Μικρή μονόγλωσση ετικέτα","thermal","small",100,80),
            ("pallet-a4","Παλέτα Α4","pallet","a4",297,210),
            ("sample-small","Δείγμα","sample","small",100,80),
            ("custom-small","Ελεύθερο κείμενο · μικρή","custom","small",100,80),
            ("custom-large","Ελεύθερο κείμενο · μεγάλη","custom","large",148,100),
            ("address-small","Στοιχεία πελάτη","address","small",100,80),
            ("production-small","Ετικέτα προς παραγωγή","production","small",100,80),
            ("butcher-small","Ταμπελάκι κρεοπωλείου","butcher","small",100,80),
            ("certificate-bg","Πιστοποιητικό Βουλγαρίας","certificate-bg","a4",210,297),
            ("certificate-conformance","Πιστοποιητικό συμμόρφωσης","certificate-conformance","a4",210,297),
            ("reference-list","Κατάλογος αναφοράς","reference-list","a4",210,297)];
        foreach(var t in templates)await Add("template",t.Key,new Template{Name=t.Name,Family=t.Family,Profile=t.Profile,GeometryKey=t.Key,WidthMm=t.W,HeightMm=t.Profile=="small"?82:t.H,FontSize=t.Profile=="small"?5.7f:7,ValidationNote="Απαιτείται σύγκριση με πρωτότυπο και δοκιμαστική εκτύπωση."});
        await Add("template","butcher-a4",new Template{Name="Ταμπελάκια κρεοπωλείου Α4",Family="butcher",Profile="a4",WidthMm=210,HeightMm=297,FontSize=10});
        await Add("template","sample-blank",new Template{Name="Δείγμα · στοιχεία πελάτη",Family="sample",Profile="small",WidthMm=100,HeightMm=82,FontSize=12});
        await Add("printer","zebra-large",new Printer{Name="Zebra ZT411 · Μεγάλη",Queue="ZDesigner ZT411-203dpi ZPL (Αντίγραφο 1)",WidthMm=108,HeightMm=148,Rotation=90,Dpi=203,DotsPerMm=8});
        await Add("printer","zebra-small",new Printer{Name="Zebra ZT230 · Μικρή",Queue="Zebra ZT230-Network",WidthMm=100,HeightMm=82,Rotation=0,Dpi=203,DotsPerMm=8});
        await Add("printer","kyocera-a4",new Printer{Name="Kyocera ECOSYS MA5500ifx · A4",Queue="ECOSYS MA5500ifx",WidthMm=210,HeightMm=297,Rotation=0,Dpi=300,DotsPerMm=300/25.4f,PrintableWidthMm=210,Transport="windows"});
        await Add("brand","1",new ReferenceData{Name="ΦΑΕΘΩΝ",Group="brand",Complete=false});
        foreach(var family in new[]{"10","20","25","26","27","30","40","45","50","60"})await Add("reference","family:"+family,new ReferenceData{Name=family,Group="family"});
        foreach(var category in new[]{"Β1","Β2","Β4","ΠΚ","ΤΚ","ΧΠ"})await Add("reference","category:"+category,new ReferenceData{Name=category,Group="category"});
        await Add("reference","condition:ΝΩΠΟ",new ReferenceData{Name="Νωπό",Group="condition",Texts=new(){{"el","ΝΩΠΟ"},{"en","FRESH"}}});
        await Add("reference","condition:ΚΤΨ",new ReferenceData{Name="Κατεψυγμένο",Group="condition",Frozen=true,Texts=new(){{"el","ΚΤΨ"},{"en","FROZEN"}}});
        foreach(var (group,values) in new (string,string[])[]{
            ("abbreviation",["ΓΚ","ΓΜ","ΓΧ","ΕΜ","ΛΚ","ΜΠ","ΠΑ","ΠΚ","ΠΜ","ΠΠ","ΣΚ","ΣΥ","ΣΧ","ΤΚ"]),
            ("packaging",["HOR","MAP","VAC"]),
            ("packaging-state",["Κιβώτιο","Σκαφάκι","Συσκευασμένο","Χύμα"]),
            ("department",["Αποθήκη","Γύροι Κοτόπουλο","Γύροι Χοιρινοί","Κοτόπουλα","Κρέατα","Μπιφτέκια","Σουβλάκια Χοιρινά","Συσκευαστήριο","Ψυγείο_5"])})
            foreach(var value in values)await Add("reference",group+":"+value,new ReferenceData{Name=value,Group=group});
        await db.SaveChangesAsync();
        // Preserve imported codes in selectable lists without inventing translations.
        foreach(var row in await db.Records.Where(r=>r.Kind=="template"||r.Kind=="printer").ToListAsync())
        {
            if(row.Kind=="template"&&row.As<Template>() is {Validated:false,Profile:"small",HeightMm:80} t){row.Data=Json.Write(t with{HeightMm=82});row.Version++;}
            if(row.Kind=="printer"&&row.Key=="zebra-small"&&row.As<Printer>() is {Validated:false,HeightMm:80} p){row.Data=Json.Write(p with{HeightMm=82});row.Version++;}
        }
        var products=(await db.Records.Where(r=>r.Kind=="product"&&!r.Archived).ToListAsync()).Select(r=>r.As<Product>()).ToArray();
        foreach(var (field,group) in new[]{("Συντομογραφία","abbreviation"),("Συσκευασία Προϊόντος","packaging"),("Κατάσταση Συσκ.","packaging-state"),("Τμήμα Παραγωγής","department"),("Οδηγίες Χρήσης","instructions"),("ΕΛΟΓΑΚ","elogak"),("Προμηθευτής","supplier"),("Αρ.Εγκρ.Σφ.","slaughterhouse")})
            foreach(var value in products.Select(p=>p.Fields.GetValueOrDefault(field,"")).Where(v=>!string.IsNullOrWhiteSpace(v)).Distinct())await Add("reference",group+":"+value,new ReferenceData{Name=value,Group=group});
        await db.SaveChangesAsync();
    }
}
