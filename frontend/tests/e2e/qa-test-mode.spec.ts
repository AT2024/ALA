import { test, expect, Page, Request } from "@playwright/test";
import { login, chooseMode } from "./helpers/alaFlow";
import { TEST_MODE_BANNER } from "./helpers/alaTestData";

/**
 * Group A — Test Mode is a per-session, admin-only choice that is NEVER
 * persisted (branch `fix/test-mode-per-session`).
 *
 * Drives the REAL running app against the REAL backend (dev bypass = admin,
 * simulated `test-data.json`, no mocking). Assertions target observable
 * contract: the Test Mode banner, the actual `X-Test-Mode` request header on a
 * real orders fetch, and the post-reload reset that no unit test can cover.
 */

const BANNER = TEST_MODE_BANNER;
const ORDERS_URL = /\/proxy\/priority\/orders/;

/**
 * Drive from /procedure-type to the treatment-selection screen and select the
 * seeded test site, which triggers the real POST /api/proxy/priority/orders.
 * Returns that captured request so the caller can inspect its headers.
 */
async function selectSiteAndCaptureOrdersRequest(page: Page): Promise<Request> {
  await page.getByRole("button", { name: /New treatment insertion/ }).click();
  await page.getByRole("button", { name: /^Proceed$/ }).click();
  await page.waitForURL("**/treatment/select");

  const combo = page.getByPlaceholder("Search sites...");
  await combo.click();
  await combo.fill("Main Test");
  const ordersRequest = page.waitForRequest(ORDERS_URL);
  await page.locator('ul[role="listbox"] li, [role="option"]').first().click();
  return ordersRequest;
}

test.describe("Group A — per-session Test Mode (real app, real backend)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Test Mode shows the banner and sends X-Test-Mode:true on the real orders request", async ({
    page,
  }) => {
    await chooseMode(page, "Test Mode");

    await expect(page.getByText(BANNER)).toBeVisible();

    const ordersRequest = await selectSiteAndCaptureOrdersRequest(page);
    expect(ordersRequest.headers()["x-test-mode"]).toBe("true");
  });

  test("Normal Mode shows no banner and sends no X-Test-Mode header", async ({
    page,
  }) => {
    await chooseMode(page, "Normal Mode");

    await expect(page.getByText(BANNER)).toHaveCount(0);

    const ordersRequest = await selectSiteAndCaptureOrdersRequest(page);
    expect(ordersRequest.headers()["x-test-mode"]).toBeUndefined();
  });

  test("Reloading in Test Mode resets to normal: admin re-asked, banner gone, nothing persisted", async ({
    page,
  }) => {
    await chooseMode(page, "Test Mode");
    await expect(page.getByText(BANNER)).toBeVisible();

    await page.reload();

    // Per-session, not persisted: a fresh JS context drops back to the mode
    // screen so the admin must choose again.
    await page.waitForURL("**/mode-select");
    await expect(page.getByText(BANNER)).toHaveCount(0);
    const persistedTestMode = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("user") || "{}").testModeEnabled;
      } catch {
        return "unparseable";
      }
    });
    expect(persistedTestMode).toBe(false);
  });

  test("Logout then re-login starts clean in normal mode", async ({ page }) => {
    await chooseMode(page, "Test Mode");
    await expect(page.getByText(BANNER)).toBeVisible();

    await page.getByRole("button", { name: /Logout/ }).click();
    await page.waitForURL("**/login");

    await login(page);
    await expect(page).toHaveURL(/mode-select/);
    await expect(page.getByText(BANNER)).toHaveCount(0);
  });
});
