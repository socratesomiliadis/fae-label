import type { ProductionModel } from "@/features/production/use-production";
import { Checkbox } from "@/components/ui/checkbox";
import { post } from "@/lib/api";
import { nameOf } from "@/lib/records";
export function SelectedProductDetails({ model }: { model: ProductionModel }) {
  const { products, brands, draft, setError, busy, setBusy, change, selected } =
    model;
  return (
    selected && (
      <details className="col-span-full rounded-xl border bg-card p-4 [&>summary]:flex [&>summary]:cursor-pointer [&>summary]:justify-between [&>summary]:py-1 [&>summary]:text-sm [&>summary]:text-muted-foreground [&[open]>summary]:mb-4">
        <summary>Καθημερινή λίστα & συνδεδεμένες επωνυμίες</summary>
        <p className="mb-3 text-xs text-muted-foreground">
          Οι επιλογές αποθηκεύονται στο προϊόν και ισχύουν και για τις επόμενες
          παραγωγές.
        </p>
        <label className="mb-3 flex items-center gap-2.5 py-2.5 text-sm [&_input]:size-4 [&_input]:min-h-0 [&_input]:accent-primary">
          <Checkbox
            disabled={busy}
            checked={!!selected.data.daily}
            onCheckedChange={async (checked) => {
              setBusy(true);
              try {
                await post("/daily", [
                  {
                    id: selected.id,
                    version: selected.version,
                    daily: checked,
                    order: selected.data.dailyOrder || 0,
                  },
                ]);
                change(draft);
                await products.reload();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
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
                disabled={
                  busy ||
                  (selected.data.brands.length === 1 &&
                    selected.data.brands.includes(brand.key))
                }
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
