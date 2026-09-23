import { useState } from "react";
import { Heading } from "@/components/layout/page-heading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Catalog } from "./catalog-page";

const sections = [
  [
    "brand",
    "Εταιρείες & επωνυμίες",
    "Περιγραφές εταιρειών, στοιχεία επικοινωνίας, λογότυπα και κείμενο «παράγεται από». Περιλαμβάνει τη ΦΑΕΘΩΝ και τις επωνυμίες private label.",
  ],
  [
    "reference",
    "Οδηγίες & κοινά κείμενα",
    "Οδηγίες χρήσης και διατήρησης, εκτροφή / προέλευση, συσκευασία και κατηγορίες. Χρησιμοποιήστε το φίλτρο «Λίστα» για να βρείτε το κείμενο.",
  ],
  [
    "language",
    "Γλώσσες & επικεφαλίδες",
    "Μεταφράσεις σταθερών επικεφαλίδων της ετικέτας. Οι διαθέσιμες γλώσσες εκτύπωσης εξαρτώνται από τη μορφή και την επωνυμία.",
  ],
];
export function LabelContentPage({ admin }: { admin: boolean }) {
  const [tab, setTab] = useState("brand");
  return (
    <>
      <Heading title="Περιεχόμενο ετικέτας" />
      <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
        Εδώ βρίσκονται τα κοινά κείμενα που χρησιμοποιούν οι ετικέτες. Οι
        περιγραφές ειδών βρίσκονται στα «Προϊόντα» και τα συστατικά / διατροφικά
        στις «Συστάσεις».
      </p>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList
          variant="line"
          className="h-auto flex-wrap justify-start mb-5"
        >
          {sections.map(([key, title]) => (
            <TabsTrigger key={key} value={key}>
              {title}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <p className="mb-5 rounded-lg bg-muted p-4 text-sm">
            {sections.find((s) => s[0] === tab)?.[2]}
            {!admin && " Η επεξεργασία γίνεται από τον διαχειριστή."}
          </p>
          <Catalog key={tab} kind={tab} admin={admin} onPrint={() => {}} />
        </TabsContent>
      </Tabs>
    </>
  );
}
