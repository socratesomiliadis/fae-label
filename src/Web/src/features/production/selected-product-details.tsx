import type { ProductionModel } from "@/features/production/use-production";
import { Checkbox } from "@/components/ui/checkbox";
import { post } from "@/lib/api";
import { nameOf } from "@/lib/records";
export function SelectedProductDetails({ model }: { model: ProductionModel }) {
  const {
    products,
    brands,
    recipes,
    draft,
    setError,
    busy,
    setBusy,
    change,
    selected,
  } = model;
  return (
    selected && (
      <details className="col-span-full my-2 mb-4 rounded-lg border p-3 [&>summary]:flex [&>summary]:cursor-pointer [&>summary]:justify-between [&>summary]:py-1 [&>summary]:text-sm [&>summary]:text-muted-foreground [&[open]>summary]:mb-4">
        <summary>{nameOf(selected)}</summary>
        <p>
          {recipes.rows.find((r) => r.key === selected.data.recipeCode)?.data
            .translations?.[draft.languages[0]]?.ingredients || "—"}
        </p>
        <p>
          {
            recipes.rows.find((r) => r.key === selected.data.recipeCode)?.data
              .translations?.[draft.languages[0]]?.allergens
          }
        </p>
        <label className="mb-3 flex items-center gap-2.5 py-2.5 text-sm [&_input]:size-4 [&_input]:min-h-0 [&_input]:accent-primary">
          <Checkbox
            checked={!!selected.data.daily}
            onCheckedChange={async (checked) => {
              try {
                await post("/daily", [
                  {
                    id: selected.id,
                    version: selected.version,
                    daily: checked,
                    order: selected.data.dailyOrder || 0,
                  },
                ]);
                await products.reload();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          Καθημερινό
        </label>
        <div className="flex flex-wrap gap-x-5">
          {brands.rows.map((brand) => (
            <label
              className="mb-3 flex items-center gap-2.5 py-2.5 text-sm [&_input]:size-4 [&_input]:min-h-0 [&_input]:accent-primary"
              key={brand.id}
            >
              <Checkbox
                disabled={busy}
                checked={selected.data.brands.includes(brand.key)}
                onCheckedChange={async (checked) => {
                  const next = checked
                    ? [...selected.data.brands, brand.key]
                    : selected.data.brands.filter(
                        (key: string) => key !== brand.key,
                      );
                  setBusy(true);
                  try {
                    await post(`/products/${selected.id}/label-brands`, {
                      version: selected.version,
                      brands: next,
                    });
                    await products.reload();
                    change({
                      ...draft,
                      brandKey: next.includes(draft.brandKey)
                        ? draft.brandKey
                        : next[0],
                    });
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              {nameOf(brand)}
            </label>
          ))}
        </div>
      </details>
    )
  );
}
