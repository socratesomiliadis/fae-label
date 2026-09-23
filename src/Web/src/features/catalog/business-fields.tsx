import { Tabs } from "@/components/ui/tabs";
import { ProductFields } from "./product-fields";
import { RecipeFields } from "./recipe-fields";
import { ReferenceFields } from "./reference-fields";
import {
  useBusinessFields,
  type BusinessFieldsProps,
} from "./use-business-fields";
export function BusinessFields(props: BusinessFieldsProps) {
  const model = useBusinessFields(props);
  return (
    <Tabs
      value={model.language}
      onValueChange={(value) => model.setLanguage(String(value))}
    >
      {props.kind === "reference" ? (
        <ReferenceFields {...props} model={model} />
      ) : props.kind === "product" ? (
        <ProductFields {...props} model={model} />
      ) : (
        <RecipeFields {...props} model={model} />
      )}
    </Tabs>
  );
}
