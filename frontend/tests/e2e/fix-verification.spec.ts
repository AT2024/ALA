/**
 * Visual proof of the date and comment fixes against the locally-running dev
 * server. Captures to ./test-results-fix-screenshots/.
 *
 * What this verifies in the browser:
 *  - 01-scan-sidebar.png   — /treatment/scan: the sidebar "Applicator Summary"
 *    renders upfront and the page contains no raw ISO date strings (Fix #1, #4
 *    structural wiring).
 *  - 02-uselist-header-date.png — /treatment/list: the Treatment Date header
 *    is formatted as `dd.MMM.yyyy` (Fix #1 primary user complaint).
 *
 * The unit tests in tests/unit/utils/ cover the cell-level behaviour of
 * formatTreatmentDate and buildApplicatorSummary that depends on data the test
 * fixture does not propagate (per-patient applicator pool).
 */
import { test, expect, type Page } from "@playwright/test";
import { DEV_LOGIN, MAIN_015 } from "./helpers/alaTestData";

const BASE = process.env.ALA_BASE_URL || "http://localhost:3002";
const OUT = "test-results-fix-screenshots";

test.use({ baseURL: BASE });

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#identifier").fill(DEV_LOGIN.email);
  await page.getByRole("button", { name: "Send Verification Code" }).click();
  await page.waitForURL("**/verify");
  await page.locator("#code").fill(DEV_LOGIN.code);
  await page.getByRole("button", { name: "Verify Code" }).click();
  await page.waitForURL("**/mode-select");
}

async function gotoScan(page: Page) {
  await page.getByRole("button", { name: /Test Mode/ }).click();
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await page.waitForURL("**/procedure-type");
  await page.getByRole("button", { name: /New treatment insertion/ }).click();
  await page.getByRole("button", { name: /^Proceed$/ }).click();
  await page.waitForURL("**/treatment/select");

  const site = page.getByPlaceholder("Search sites...");
  await site.click();
  await site.fill(MAIN_015.siteQuery);
  await page.locator('ul[role="listbox"] li, [role="option"]').first().click();
  await page
    .getByRole("button", { name: new RegExp(`^${MAIN_015.date}$`) })
    .click();
  await page
    .locator("#patientId")
    .selectOption({ label: MAIN_015.patientLabel });
  await page.locator("#surgeon").fill("Dr Test");
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await page.waitForURL("**/treatment/scan");
  // Wait for the Manual Entry tab to be reachable.
  await page.getByText("Enter Manually", { exact: false }).first().click();
}

test("fix verification — formatted dates", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await gotoScan(page);

  // Sidebar must be visible on /treatment/scan.
  await expect(
    page.getByRole("heading", { name: "Treatment Progress" }),
  ).toBeVisible();

  // No raw-ISO date anywhere on the page.
  await expect(page.locator("body")).not.toContainText(/T\d{2}:\d{2}:\d{2}/);

  await page.screenshot({
    path: `${OUT}/01-scan-sidebar.png`,
    fullPage: true,
  });

  // Advance to UseList via the header "Next" navigation. /treatment/list is
  // guarded by an active treatment, so a direct goto rebounds to mode-select.
  await page.getByRole("button", { name: "Next" }).click();
  // A confirmation dialog may appear when no applicators were processed.
  const yes = page.getByRole("button", { name: /^Yes$/ });
  try {
    await yes.click({ timeout: 3000 });
  } catch {
    /* no dialog */
  }
  await expect(page.getByRole("heading", { name: "Use List" })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("Treatment Information")).toBeVisible();

  // The treatment-info "Date" value must be formatted as dd.MMM.yyyy and must
  // not contain the raw ISO marker.
  const dateText = (
    await page.locator('p:has-text("Date") + p').first().innerText()
  ).trim();
  expect(dateText).toMatch(/^\d{2}\.[A-Z][a-z]{2}\.\d{4}$/);
  expect(dateText).not.toContain("T00:00:00");

  await page.screenshot({
    path: `${OUT}/02-uselist-header-date.png`,
    fullPage: true,
  });
});
