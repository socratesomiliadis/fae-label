import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("../Api/wwwroot");
const product = {
  id: "b0fe1200-32de-42b6-9018-a01652639333",
  kind: "product",
  key: "1",
  version: 1,
  updatedAt: "2026-09-23",
  data: {
    erpCode: "1-109-1-000",
    secondaryCode: "A",
    names: { el: "ΧΟΙΡΙΝΗ ΣΚΕΠΗ, ΚΤΨ", en: "PORK RIND, FROZEN" },
    recipeCode: "0001",
    brands: ["1"],
    active: true,
    daily: true,
    dailyOrder: 1,
    shelfLife: 365,
    frozen: true,
  },
};
const template = {
  id: "12b83fca-59ca-4ed5-8f01-d05003eacbfa",
  kind: "template",
  key: "thermal-large",
  version: 1,
  data: {
    name: "Μεγάλη δίγλωσση ετικέτα",
    family: "thermal",
    profile: "large",
    widthMm: 148,
    heightMm: 100,
    validated: false,
  },
};
const recipe = {
  id: "recipe",
  key: "0001",
  kind: "recipe",
  version: 1,
  data: {
    code: "0001",
    name: "Χοιρινό",
    family: "10",
    category: "ΧΠ",
    originKey: "1",
    translations: {
      el: { ingredients: "Κρέας χοιρινό (100%)", allergens: "", nutrition: "" },
      en: { ingredients: "Pork (100%)", allergens: "", nutrition: "" },
    },
    nutrition: {},
  },
};
const reference = {
  id: "ref",
  key: "packaging:HOR",
  data: { name: "HORECA", group: "packaging", texts: { el: "HORECA" } },
};
test.beforeEach(async ({ page }) => {
  await page.route("http://faethon.test/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const values: Record<string, unknown> = {
      "/api/me": { name: "Socrates", role: "admin" },
      "/api/dashboard": {
        products: 779,
        recipes: 172,
        queued: 0,
        attention: 0,
        recent: [],
      },
      "/api/records/product": [product],
      "/api/records/recipe": [recipe],
      "/api/records/reference": [reference],
      "/api/records/template": [
        template,
        {
          ...template,
          id: "small",
          key: "thermal-small",
          data: {
            ...template.data,
            name: "Μικρή",
            profile: "small",
            widthMm: 100,
            heightMm: 82,
          },
        },
        {
          ...template,
          id: "custom",
          key: "custom-small",
          data: {
            ...template.data,
            name: "Ελεύθερη ετικέτα",
            profile: "small",
            family: "custom",
            widthMm: 100,
            heightMm: 82,
          },
        },
      ],
      "/api/records/brand": [
        { id: "brand", key: "1", data: { name: "ΦΑΕΘΩΝ" } },
      ],
      "/api/records/language": [
        { id: "el", key: "el", data: { name: "Ελληνικά" } },
        { id: "en", key: "en", data: { name: "English" } },
      ],
      "/api/records/printer": [],
      "/api/records/customer": [],
      "/api/records/draft": [],
      "/api/jobs": [],
    };
    if (pathname.startsWith("/api/")) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(values[pathname] ?? []),
      });
    }
    const file =
      pathname === "/"
        ? path.join(root, "index.html")
        : path.join(root, pathname);
    if (!file.startsWith(root)) return route.abort();
    return route.fulfill({
      contentType: file.endsWith(".js")
        ? "application/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : "text/html",
      body: fs.readFileSync(file),
    });
  });
  await page.goto("http://faethon.test/");
});
test("Greek workspace, search and print preparation work without a dev server", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.getByRole("heading", { name: "Επισκόπηση" })).toBeVisible();
  await expect(page.getByText("779", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "../../artifacts/ui-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Προϊόντα", exact: true }).click();
  await page.getByPlaceholder("Αναζήτηση με περιγραφή ή κωδικό…").fill("1-109");
  await expect(
    page.getByText("ΧΟΙΡΙΝΗ ΣΚΕΠΗ, ΚΤΨ", { exact: true }),
  ).toBeVisible();
  await page.getByTitle("Έκδοση ετικέτας").click();
  await expect(
    page.getByRole("heading", { name: "Έκδοση ετικετών" }),
  ).toBeVisible();
  await expect(
    page.locator("summary").filter({ hasText: product.data.names.el }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Αποστολή για εκτύπωση" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "../../artifacts/ui-production.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("template catalog makes shared layouts and validation visible", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Πρότυπα", exact: true }).click();
  await expect(
    page.getByText("Μεγάλη δίγλωσση ετικέτα", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Προς επικύρωση", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Επεξεργασία", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Κλείσιμο", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("active label list filters products and opens live production values", async ({
  page,
}) => {
  await page.route("**/api/records/product", (r) =>
    r.fulfill({
      json: [
        product,
        {
          ...product,
          id: "butcher",
          data: { ...product.data, butcher: true, names: { el: "ΚΡΕΟΠΩΛΕΙΟ" } },
        },
      ],
    }),
  );
  await page
    .getByRole("button", { name: "Έκδοση ετικετών", exact: true })
    .click();
  await expect(page.getByText("ΚΡΕΟΠΩΛΕΙΟ", { exact: true })).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Οικογένεια", exact: true })
    .selectOption("10");
  await page.screenshot({
    path: "../../artifacts/ui-label-list.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Έκδοση ετικέτας", exact: true })
    .click();
  await page
    .getByLabel("Ημερομηνία παραγωγής", { exact: true })
    .fill("2026-09-07");
  await expect(
    page.getByText("37/26/10/11091000/0", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2027-09-07", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Βάρος κιβωτίου (kg)", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Κιβώτιο GR/EN", exact: true })
    .click();
  await expect(
    page.getByLabel("Βάρος κιβωτίου (kg)", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Άλλο προϊόν", exact: true }).click();
  await expect(
    page.getByPlaceholder("Αναζήτηση με περιγραφή ή κωδικό…"),
  ).toBeVisible();
});
test("product and recipe editors expose reference lists and language tabs", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Προϊόντα", exact: true }).click();
  await page.getByRole("button", { name: "Επεξεργασία", exact: true }).click();
  await expect(page.getByLabel("Σύσταση", { exact: true })).toHaveValue("0001");
  await expect(
    page
      .getByLabel("Συσκευασία Προϊόντος", { exact: true })
      .getByRole("option", { name: "HOR · HORECA" }),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "English", exact: true }).click();
  await expect(page.getByLabel("Περιγραφή (EN)", { exact: true })).toHaveValue(
    "PORK RIND, FROZEN",
  );
  await page.screenshot({
    path: "../../artifacts/ui-product-editor.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Κλείσιμο", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Συστάσεις", exact: true }).click();
  await page.getByRole("button", { name: "Επεξεργασία", exact: true }).click();
  await expect(page.getByLabel("Συστατικά", { exact: true })).toHaveValue(
    "Κρέας χοιρινό (100%)",
  );
  await page.getByRole("tab", { name: "English", exact: true }).click();
  await expect(page.getByLabel("Συστατικά", { exact: true })).toHaveValue(
    "Pork (100%)",
  );
  await expect(
    page.getByLabel("Λιπαρά ανά 100gr", { exact: true }),
  ).toBeVisible();
});
test("custom labels expose text directly and daily batches accept weight", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Ελεύθερη ετικέτα", exact: true })
    .click();
  await expect(
    page.getByLabel("Ελεύθερο κείμενο / τίτλος", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Ημερομηνία παραγωγής", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Καθημερινή παραγωγή", exact: true })
    .click();
  await page
    .getByLabel("Βάρος ΧΟΙΡΙΝΗ ΣΚΕΠΗ, ΚΤΨ", { exact: true })
    .fill("5.25");
  await page.locator("input.quantity").last().fill("2");
  let submitted: any;
  await page.route("**/api/preview", (r) => {
    submitted = r.request().postDataJSON();
    return r.fulfill({
      json: { id: "preview", issues: [], lot: "test", pdfUrl: "/test.pdf" },
    });
  });
  await page.getByRole("button", { name: "Έλεγχος παρτίδας" }).click();
  await expect.poll(() => submitted?.weight).toBe(5.25);
});
test("operators can view recipes but cannot edit master data", async ({
  page,
}) => {
  await page.route("**/api/me", (r) =>
    r.fulfill({ json: { name: "Operator", role: "operator" } }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Ρυθμίσεις", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Συστάσεις", exact: true }).click();
  await page.getByRole("button", { name: "Προβολή", exact: true }).click();
  await expect(page.getByLabel("Συστατικά", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Αποθήκευση", exact: true }),
  ).toHaveCount(0);
});
test("label size selects its configured printer", async ({ page }) => {
  await page.route("**/api/records/printer", (route) =>
    route.fulfill({
      json: [
        { id: "large-printer", key: "zebra-large", data: { name: "Zebra A" } },
        { id: "small-printer", key: "zebra-small", data: { name: "Zebra B" } },
      ],
    }),
  );
  await page
    .getByRole("button", { name: "Έκδοση ετικετών", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Έκδοση ετικέτας", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Εκτυπωτής", exact: true }),
  ).toHaveValue("large-printer");
  await page.getByRole("button", { name: "Μικρή", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Εκτυπωτής", exact: true }),
  ).toHaveValue("small-printer");
});
