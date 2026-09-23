import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.env.FAETHON_UI_DIST || "../Api/wwwroot");
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
          : file.endsWith(".svg")
            ? "image/svg+xml"
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
    page.getByRole("heading", { name: product.data.names.el, exact: true }),
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
    .getByRole("button", { name: "Κιβώτιο 148 × 100 mm", exact: true })
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
        {
          id: "large-printer",
          key: "zebra-large",
          data: {
            name: "Zebra A",
            widthMm: 108,
            heightMm: 148,
            rotation: 90,
            validated: true,
          },
        },
        {
          id: "small-printer",
          key: "zebra-small",
          data: {
            name: "Zebra B",
            widthMm: 100,
            heightMm: 82,
            rotation: 0,
            validated: true,
          },
        },
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
  await page
    .getByRole("button", { name: "Μικρή 100 × 82 mm", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Εκτυπωτής", exact: true }),
  ).toHaveValue("small-printer");
});

test("official branding loads and mobile navigation stays usable", async ({
  page,
}) => {
  const logo = page.getByRole("img", { name: "ΦΑΕΘΩΝ", exact: true });
  await expect(logo).toBeVisible();
  await expect
    .poll(() =>
      logo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(202);
  await expect(
    page.getByRole("link", { name: "ΦΑΕΘΩΝ — Επισκόπηση" }),
  ).toHaveCSS("background-color", "rgb(74, 29, 27)");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Προϊόντα", exact: true }).click();
  await expect(
    page.getByPlaceholder("Αναζήτηση με περιγραφή ή κωδικό…"),
  ).toBeVisible();
  await page.screenshot({
    path: "../../artifacts/ui-mobile.png",
    fullPage: true,
  });
});

test("editor traps focus, supports keyboard language tabs, and restores focus on Escape", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Προϊόντα", exact: true }).click();
  const edit = page.getByRole("button", { name: "Επεξεργασία", exact: true });
  await edit.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
  const code = page.getByLabel("Κωδικός ERP", { exact: true });
  await expect
    .poll(async () => (await code.boundingBox())?.width ?? 0)
    .toBeGreaterThan(200);
  await page.getByRole("tab", { name: "Ελληνικά", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "English", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Περιγραφή (EN)", { exact: true })).toHaveValue(
    "PORK RIND, FROZEN",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(edit).toBeFocused();
});

test("late preview responses cannot enable printing an edited draft", async ({
  page,
}) => {
  await page.route("**/api/records/printer", (route) =>
    route.fulfill({
      json: [
        {
          id: "printer",
          key: "zebra-large",
          data: {
            name: "Zebra",
            widthMm: 108,
            heightMm: 148,
            rotation: 90,
            validated: true,
          },
        },
      ],
    }),
  );
  let releasePreview: () => void = () => {};
  let requested = false;
  const pending = new Promise<void>((resolve) => {
    releasePreview = resolve;
  });
  await page.route("**/api/preview", async (route) => {
    requested = true;
    await pending;
    await route.fulfill({
      json: {
        id: "old-preview",
        issues: [],
        lot: "old",
        pdfUrl: "/test.pdf",
        imageUrl: "/brand/faethon-logo.svg",
      },
    });
  });
  await page
    .getByRole("button", { name: "Έκδοση ετικετών", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Έκδοση ετικέτας", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Προεπισκόπηση", exact: true })
    .click();
  await expect.poll(() => requested).toBe(true);
  await page
    .getByLabel("Ημερομηνία παραγωγής", { exact: true })
    .fill("2026-10-01");
  releasePreview();
  await expect(
    page.getByRole("button", { name: "Προεπισκόπηση", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Αποστολή για εκτύπωση" }),
  ).toBeDisabled();
});

async function openProduct(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: "Έκδοση ετικετών", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Έκδοση ετικέτας", exact: true })
    .click();
}
const extraTemplates = [
  ["pallet-a4", "Παλέτα Α4", "pallet", "a4", 297, 210],
  ["sample-small", "Δείγμα", "sample", "small", 100, 82],
  ["sample-blank", "Δείγμα · στοιχεία πελάτη", "sample", "small", 100, 82],
  ["butcher-a4", "Ταμπελάκια κρεοπωλείου Α4", "butcher", "a4", 210, 297],
].map(([key, name, family, profile, widthMm, heightMm]) => ({
  ...template,
  id: String(key),
  key,
  data: { name, family, profile, widthMm, heightMm, geometryKey: key },
}));

async function allFormats(page: import("@playwright/test").Page) {
  await page.route("**/api/records/template", (r) =>
    r.fulfill({
      json: [
        template,
        {
          ...template,
          id: "small",
          key: "thermal-small",
          data: {
            ...template.data,
            profile: "small",
            widthMm: 100,
            heightMm: 80,
          },
        },
        ...extraTemplates,
      ],
    }),
  );
}

test("output choices prevent unsupported languages and preserve production details across formats", async ({
  page,
}) => {
  await allFormats(page);
  await openProduct(page);
  await page
    .getByLabel("Ημερομηνία παραγωγής", { exact: true })
    .fill("2026-10-01");
  await page.getByLabel("Βάρος προϊόντος (kg)", { exact: true }).fill("3.5");
  await expect(page.getByLabel("Δεύτερη γλώσσα", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Μικρή 100 × 80 mm", exact: true })
    .click();
  await page.getByLabel("Γλώσσα ετικέτας", { exact: true }).selectOption("de");
  await expect(
    page.getByLabel("Γλώσσα ετικέτας", { exact: true }).locator("option"),
  ).toHaveCount(16);
  await page
    .getByRole("button", { name: "Παλέτα Α4 297 × 210 mm", exact: true })
    .click();
  await expect(page.getByLabel("Γλώσσα ετικέτας", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Περιεχόμενο", { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel("Ημερομηνία παραγωγής", { exact: true }),
  ).toHaveValue("2026-10-01");
  await expect(
    page.getByLabel("Βάρος προϊόντος (kg)", { exact: true }),
  ).toHaveValue("3.5");
  let request: any;
  await page.route("**/api/preview", (r) => {
    request = r.request().postDataJSON();
    return r.fulfill({
      json: { id: "preview", issues: [], imageUrl: "/brand/faethon-logo.svg" },
    });
  });
  await page
    .getByRole("button", { name: "Προεπισκόπηση", exact: true })
    .click();
  await expect.poll(() => request?.languages).toEqual(["el", "en"]);
  expect(request.mode).toBe("product");
  expect(request.weight).toBe(3.5);
  await page.screenshot({
    path: "../../artifacts/ux-output-workspace.png",
    fullPage: true,
  });
});

test("private-label languages follow each brand and preserve supported bilingual variants", async ({
  page,
}) => {
  await allFormats(page);
  await page.route("**/api/records/product", (r) =>
    r.fulfill({
      json: [
        {
          ...product,
          data: { ...product.data, brands: ["1", "IONIC", "METEORA"] },
        },
      ],
    }),
  );
  await page.route("**/api/records/brand", (r) =>
    r.fulfill({
      json: ["1", "IONIC", "METEORA"].map((key) => ({
        id: key,
        key,
        kind: "brand",
        data: {
          name: key === "1" ? "ΦΑΕΘΩΝ" : key,
          legacyBrand: key === "1" ? "FAETHON" : key,
        },
      })),
    }),
  );
  await openProduct(page);
  await page.getByLabel("Επωνυμία στην ετικέτα").selectOption("IONIC");
  await page
    .getByRole("button", { name: "Μικρή 100 × 80 mm", exact: true })
    .click();
  await expect(
    page.getByLabel("Γλώσσα ετικέτας").locator("option"),
  ).toHaveCount(2);
  await expect(
    page.getByLabel("Γλώσσα ετικέτας").locator('option[value="de"]'),
  ).toHaveCount(0);
  await page.getByLabel("Επωνυμία στην ετικέτα").selectOption("METEORA");
  await page
    .getByRole("button", { name: "Μεγάλη 148 × 100 mm", exact: true })
    .click();
  await page.getByLabel("Γλώσσα ετικέτας").selectOption("ro/en");
  await page.getByLabel("Επωνυμία στην ετικέτα").selectOption("1");
  await expect(page.getByLabel("Γλώσσα ετικέτας")).toHaveCount(0);
  await expect(
    page.getByText("Ελληνικά + English", { exact: false }),
  ).toBeVisible();
});

test("blank samples hide product fields and cannot submit a retained product", async ({
  page,
}) => {
  await allFormats(page);
  await openProduct(page);
  await page
    .getByRole("button", {
      name: "Δείγμα · στοιχεία πελάτη 100 × 82 mm",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Ημερομηνία παραγωγής", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Κωδικός ζώου")).toHaveCount(0);
  await expect(page.getByLabel("Πελάτης", { exact: true })).toBeVisible();
  await page.getByLabel("Γλώσσα ετικέτας").selectOption("en");
  let request: any;
  await page.route("**/api/preview", (r) => {
    request = r.request().postDataJSON();
    return r.fulfill({
      json: { id: "blank", issues: [], imageUrl: "/brand/faethon-logo.svg" },
    });
  });
  await page
    .getByRole("button", { name: "Προεπισκόπηση", exact: true })
    .click();
  await expect.poll(() => request?.mode).toBe("blank");
  expect(request.productId).toBeNull();
  expect(request.languages).toEqual(["en"]);
  await page
    .getByRole("button", { name: "Μεγάλη 148 × 100 mm", exact: true })
    .click();
  await expect(
    page.getByLabel("Ημερομηνία παραγωγής", { exact: true }),
  ).toBeVisible();
});

test("company content stays in the catalog and operators only get read access", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Εταιρείες & επωνυμίες", exact: true })
    .click();
  await page.getByRole("button", { name: "Επεξεργασία", exact: true }).click();
  await expect(
    page.getByLabel("Περιγραφή εταιρείας & στοιχεία επικοινωνίας"),
  ).toBeVisible();
  await page.getByRole("tab", { name: "English", exact: true }).click();
  await page
    .getByLabel("Περιγραφή εταιρείας & στοιχεία επικοινωνίας")
    .fill("Company details");
  await page.screenshot({
    path: "../../artifacts/ux-company-editor.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Περιεχόμενο ετικέτας", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Οδηγίες & κοινά κείμενα" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../artifacts/ux-content-hub.png",
    fullPage: true,
  });
  await page.route("**/api/me", (r) =>
    r.fulfill({ json: { name: "Operator", role: "operator" } }),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Εταιρείες & επωνυμίες", exact: true })
    .click();
  await page.getByRole("button", { name: "Προβολή", exact: true }).click();
  await expect(
    page.getByLabel("Περιγραφή εταιρείας & στοιχεία επικοινωνίας"),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Αποθήκευση", exact: true }),
  ).toHaveCount(0);
});

test("old saved drafts are normalized to one language and retain carton quantities", async ({
  page,
}) => {
  await allFormats(page);
  await page.route("**/api/records/draft", (r) =>
    r.fulfill({
      json: [
        {
          id: "saved",
          key: "saved",
          kind: "draft",
          version: 1,
          data: {
            name: "Saved small label",
            productId: product.id,
            templateKey: "thermal-small",
            mode: "carton",
            languages: ["el", "en"],
            brandKey: "1",
            productionDate: "2026-10-01",
            shelfLife: 365,
            weight: 3,
            cartonWeight: 12,
            pieces: 4,
            freeText: "",
          },
        },
      ],
    }),
  );
  await page
    .getByRole("button", { name: "Έκδοση ετικετών", exact: true })
    .click();
  await page.getByLabel("Αποθηκευμένη προετοιμασία").selectOption("saved");
  await expect(page.getByLabel("Γλώσσα ετικέτας")).toHaveValue("el");
  await page
    .getByRole("button", { name: "Κιβώτιο 148 × 100 mm", exact: true })
    .click();
  await expect(page.getByLabel("Βάρος κιβωτίου (kg)")).toHaveValue("12");
  await expect(page.getByLabel("Τεμάχια / κιβώτιο")).toHaveValue("4");
});

test("small labels use the product carton-weight preference and filter incompatible printers", async ({
  page,
}) => {
  await allFormats(page);
  await page.route("**/api/records/product", (r) =>
    r.fulfill({
      json: [
        { ...product, data: { ...product.data, smallLabelWeight: "carton" } },
      ],
    }),
  );
  await page.route("**/api/records/printer", (r) =>
    r.fulfill({
      json: [
        {
          id: "s",
          key: "zebra-small",
          data: {
            name: "Small",
            widthMm: 100,
            heightMm: 80,
            rotation: 0,
            validated: true,
          },
        },
        {
          id: "l",
          key: "zebra-large",
          data: {
            name: "Large",
            widthMm: 108,
            heightMm: 148,
            rotation: 90,
            validated: true,
          },
        },
        {
          id: "a",
          key: "kyocera-a4",
          data: {
            name: "A4",
            widthMm: 210,
            heightMm: 297,
            rotation: 0,
            validated: true,
          },
        },
      ],
    }),
  );
  await openProduct(page);
  await expect(
    page.getByLabel("Εκτυπωτής", { exact: true }).locator('option[value="s"]'),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Μικρή 100 × 80 mm", exact: true })
    .click();
  await expect(
    page.getByLabel("Βάρος προϊόντος (kg)", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Βάρος κιβωτίου (kg)")).toBeVisible();
  await expect(page.getByLabel("Τεμάχια / κιβώτιο")).toHaveCount(0);
  await expect(page.getByLabel("Εκτυπωτής", { exact: true })).toHaveValue("s");
  await page
    .getByRole("button", { name: "Παλέτα Α4 297 × 210 mm", exact: true })
    .click();
  await expect(page.getByLabel("Εκτυπωτής", { exact: true })).toHaveValue("a");
  await expect(
    page.getByLabel("Εκτυπωτής", { exact: true }).locator("option"),
  ).toHaveCount(2);
});

test("invalid dates and fractional carton counts are explained before preview", async ({
  page,
}) => {
  await openProduct(page);
  await page.getByLabel("Χειροκίνητη ημερομηνία λήξης").fill("2020-01-01");
  await expect(
    page.getByText("Η λήξη δεν μπορεί να προηγείται της παραγωγής."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Προεπισκόπηση", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Χειροκίνητη ημερομηνία λήξης").fill("");
  await page
    .getByRole("button", { name: "Κιβώτιο 148 × 100 mm", exact: true })
    .click();
  await page.getByLabel("Τεμάχια / κιβώτιο").fill("1.5");
  await expect(
    page.getByText("Τα τεμάχια πρέπει να είναι ακέραιος αριθμός."),
  ).toBeVisible();
  await page.getByLabel("Τεμάχια / κιβώτιο").fill("2");
  await expect(
    page.getByRole("button", { name: "Προεπισκόπηση", exact: true }),
  ).toBeEnabled();
});

test("product workspace and catalog editor fit a narrow viewport", async ({
  page,
}) => {
  await allFormats(page);
  await openProduct(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Μικρή 100 × 80 mm", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Μορφές ετικέτας" })
      .getByRole("button", { pressed: true }),
  ).toHaveCSS("background-color", "rgb(244, 229, 208)");
  await page.screenshot({
    path: "../../artifacts/ux-workspace-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Εταιρείες & επωνυμίες", exact: true })
    .click();
  await page.getByRole("button", { name: "Επεξεργασία", exact: true }).click();
  await expect(
    page.getByLabel("Περιγραφή εταιρείας & στοιχεία επικοινωνίας"),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("label workspace aligns format and preview and removes source-edit links", async ({
  page,
}) => {
  await allFormats(page);
  await page.route("**/api/records/draft", (r) =>
    r.fulfill({
      json: [
        {
          id: "saved",
          key: "saved",
          kind: "draft",
          data: { name: "Προετοιμασία 24/09" },
        },
      ],
    }),
  );
  await page.setViewportSize({ width: 2000, height: 1250 });
  await openProduct(page);
  await expect(page.getByText("Από πού έρχεται το κείμενο;")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Εταιρεία, λογότυπο & κείμενα επωνυμίας",
    }),
  ).toHaveCount(0);
  const format = await page
    .getByRole("region", { name: "Μορφές ετικέτας" })
    .boundingBox();
  const preview = await page
    .getByRole("heading", { name: "Προεπισκόπηση & εκτύπωση" })
    .locator("..")
    .locator("..")
    .boundingBox();
  expect(Math.abs(format!.y - preview!.y)).toBeLessThan(2);
  expect(format!.y).toBeLessThan(320);
  const choices = page
    .getByRole("region", { name: "Μορφές ετικέτας" })
    .getByRole("button");
  await expect(choices.nth(0)).toHaveText(/Μεγάλη/);
  await expect(choices.nth(1)).toHaveText(/Κιβώτιο/);
  await expect(choices.nth(2)).toHaveText(/Μικρή/);
  await page.screenshot({
    path: "../../artifacts/ui-clean-production.png",
    fullPage: true,
  });
});

test("settings tabs have a visible selected state and work with keyboard navigation", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Ρυθμίσεις", exact: true }).click();
  const printers = page.getByRole("tab", { name: "Εκτυπωτές", exact: true });
  const languages = page.getByRole("tab", { name: "Γλώσσες", exact: true });
  await expect(printers).toHaveCSS("background-color", "rgb(74, 29, 27)");
  await expect(languages).not.toHaveCSS("background-color", "rgb(74, 29, 27)");
  await expect(languages).toHaveCSS("cursor", "pointer");
  await printers.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(languages).toHaveAttribute("aria-selected", "true");
  await expect(languages).toHaveCSS("background-color", "rgb(74, 29, 27)");
  await page.screenshot({
    path: "../../artifacts/ui-clean-settings.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "../../artifacts/ui-clean-settings-mobile.png",
    fullPage: true,
  });
});
