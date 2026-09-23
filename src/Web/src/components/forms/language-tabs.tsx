import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Row } from "@/types/records";

export function LanguageTabs({
  languages,
  rows,
}: {
  languages: string[];
  rows: Row[];
}) {
  return (
    <TabsList
      variant="line"
      activateOnFocus
      aria-label="Γλώσσες"
      className="my-4 h-auto flex-wrap justify-start"
    >
      {languages.map((language) => (
        <TabsTrigger key={language} value={language} className="px-3 py-2">
          {rows.find((row) => row.key === language)?.data.name ||
            language.toUpperCase()}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
