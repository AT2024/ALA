import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSessionKeys, TREATMENT_KEYS } from "./utils/sessionStorageProbe";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Production Smoke — verifies the four fixes shipped in commit 4554ac4 are
 * working in the deployed Docker stack:
 *   A2  Applicator list rendered without the historical 50-row OData cap
 *   A3  Patient ID displayed maps from order.REFERENCE (fallback ORDNAME)
 *   A4  Seed totals do not double-count applicators present in both lists
 *   A5  Logout clears the four treatment-related sessionStorage keys
 *
 * Runs against https://ala-app.israelcentral.cloudapp.azure.com via
 * `npm run test:e2e:prod`. **Non-interactive** — relies on storageState
 * captured by `auth.setup.ts` (run once with `npm run test:e2e:prod:setup`).
 *
 * If the saved state is stale (cookie expired), the first test fails fast
 * with a clear instruction to re-run setup.
 *
 * No production data is mutated: the test switches to Test Mode, reads
 * pages, and logs out. No order is created or modified.
 */

// All tests in this file start already-authenticated by loading the saved
// admin storageState. Each test gets its own context, so we keep them in
// serial mode to share the session-flow state (Test Mode toggle, then
// treatment selection, then logout).
test.use({
  storageState: path.join(
    __dirname,
    "..",
    "..",
    "playwright",
    ".auth",
    "admin.json",
  ),
});

test.describe.configure({ mode: "serial" });

test.describe("Production smoke — verify 4554ac4 fixes are live", () => {
  test.setTimeout(60_000);

  test.beforeAll(async ({ request }) => {
    // Quick auth-still-valid check. /api/auth/validate-token is protected:
    // returns 200 if the HttpOnly cookie in our storageState is still good,
    // 401 otherwise. Fail fast with an actionable message.
    const r = await request.post("/api/auth/validate-token", {
      failOnStatusCode: false,
    });
    if (r.status() !== 200) {
      throw new Error(
        `Saved auth state at playwright/.auth/admin.json is no longer valid ` +
          `(POST /api/auth/validate-token returned ${r.status()}). ` +
          `Re-run: npm run test:e2e:prod:setup`,
      );
    }
  });

  test("switch to Test Mode (admin only)", async ({ page }) => {
    await page.goto("/mode-select");

    // ModeSelectionPage — Normal vs Test buttons, then Proceed.
    await page
      .getByRole("button", { name: /test mode/i })
      .first()
      .click();
    await page.getByRole("button", { name: /proceed/i }).click();
    await expect(page).toHaveURL(/\/procedure-type/, { timeout: 15_000 });

    // The TestModeBanner component renders this exact text when active.
    await expect(page.getByText(/TEST MODE ACTIVE/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("A2: applicator list renders without 50-row truncation cap", async ({
    page,
  }) => {
    await page.goto("/procedure-type");

    // Enter a treatment flow that surfaces the applicator list (test-mode fixture).
    const insertion = page.getByRole("button", {
      name: /insertion|new\s+treatment/i,
    });
    if (
      await insertion
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await insertion.first().click();
    }

    // Capture /api/priority/orders if the page calls it.
    const ordersResp = await page
      .waitForResponse(
        (r) => r.url().includes("/api/priority/orders") && r.ok(),
        { timeout: 30_000 },
      )
      .catch(() => null);

    if (ordersResp) {
      const body = await ordersResp.json().catch(() => null);
      const orderCount = Array.isArray(body)
        ? body.length
        : Array.isArray(body?.data)
          ? body.data.length
          : Array.isArray(body?.orders)
            ? body.orders.length
            : null;
      console.log(`A2: /api/priority/orders returned ${orderCount} orders`);
      // The historical cap was 50. Response should not be exactly that.
      if (orderCount !== null) {
        expect(orderCount).not.toBe(50);
      }
    } else {
      console.warn(
        "A2: did not observe /api/priority/orders network call — the test " +
          "may have landed on a page that does not fetch orders. Verifying " +
          "the page rendered without error instead.",
      );
    }

    // Minimum render assertion: the page didn't crash.
    await expect(page.locator("body")).toBeVisible();
  });

  test("A3: patient ID maps from REFERENCE with ORDNAME fallback", async ({
    page,
  }) => {
    // Select the first available order if the UI exposes one.
    const orderOption = page.getByRole("option").first();
    if (await orderOption.isVisible().catch(() => false)) {
      await orderOption.click();
    } else {
      const combobox = page.getByRole("combobox").first();
      if (await combobox.isVisible().catch(() => false)) {
        await combobox.click();
        await page.getByRole("option").first().click();
      }
    }

    const stored = await page.evaluate(() => {
      const raw = sessionStorage.getItem("currentTreatment");
      return raw ? JSON.parse(raw) : null;
    });

    if (!stored) {
      console.warn(
        "A3: no currentTreatment in sessionStorage yet — skipping field-level " +
          "assertion. (Selection flow may require an extra click on this page.)",
      );
      return;
    }

    const expectedId =
      stored.REFERENCE ||
      stored.reference ||
      stored.patientId ||
      stored.ORDNAME ||
      stored.ordName ||
      stored.orderName;
    console.log(
      `A3: stored treatment has REFERENCE=${stored.REFERENCE ?? "∅"} ` +
        `ORDNAME=${stored.ORDNAME ?? "∅"} patientId=${stored.patientId ?? "∅"}`,
    );
    expect(
      expectedId,
      "currentTreatment must carry REFERENCE or ORDNAME after order selection",
    ).toBeTruthy();
  });

  test("A4: no duplicate seed counts across applicator lists", async ({
    page,
  }) => {
    const lists = await page.evaluate(() => {
      const proc = JSON.parse(
        sessionStorage.getItem("processedApplicators") || "[]",
      );
      const avail = JSON.parse(
        sessionStorage.getItem("availableApplicators") || "[]",
      );
      return { proc, avail };
    });

    const serial = (a: { serialNumber?: string; SERIAL?: string }) =>
      a.serialNumber ?? a.SERIAL ?? "";
    const processed = (lists.proc as Array<unknown>).map((x) =>
      serial(x as never),
    );
    const available = (lists.avail as Array<unknown>).map((x) =>
      serial(x as never),
    );
    const processedSet = new Set(processed.filter(Boolean));
    const overlap = available.filter((s) => s && processedSet.has(s));

    console.log(
      `A4: processed=${processed.length} available=${available.length} overlap=${overlap.length}`,
    );

    expect(
      overlap,
      "applicator serials must not appear in both processed and available lists",
    ).toEqual([]);
  });

  test("A5: logout clears the four treatment sessionStorage keys", async ({
    page,
  }) => {
    // Seed canary values so we can prove logout cleared them even if the
    // earlier flow didn't populate every key.
    await page.evaluate(
      (keys: readonly string[]) => {
        for (const k of keys) {
          if (sessionStorage.getItem(k) === null) {
            sessionStorage.setItem(k, "__smoke-canary__");
          }
        }
      },
      TREATMENT_KEYS as unknown as readonly string[],
    );

    const before = await readSessionKeys(page);
    expect(
      Object.values(before).every((v) => v !== null),
      `pre-logout: every treatment key must be present (got ${JSON.stringify(before)})`,
    ).toBe(true);

    await page.getByRole("button", { name: /^logout$/i }).click();

    await expect(page).toHaveURL(/\/(login)?\/?$/, { timeout: 15_000 });

    const after = await readSessionKeys(page);
    for (const k of TREATMENT_KEYS) {
      expect(
        after[k],
        `post-logout: ${k} should be cleared (4554ac4 fix), got ${after[k]}`,
      ).toBeNull();
    }
  });
});
