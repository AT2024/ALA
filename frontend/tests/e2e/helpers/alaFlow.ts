/**
 * Reusable ALA end-to-end flow helpers — drive the REAL app against the REAL
 * backend (dev bypass = positionCode-99 admin, simulated test-data.json; no
 * Priority ERP, no mocking).
 *
 * Extracted from the falsifiability-proven QA specs so future specs do not
 * re-discover the flow. Uses the Playwright config baseURL — never hardcode a
 * port (the app runs on :3000; stale specs that say :5173 are wrong). The auth
 * limiter is 10 logins/IP/15min with no dev bypass: run `--workers=1` and
 * restart the backend to reset if you hit HTTP 429.
 */
import { Page, expect } from "@playwright/test";
import { DEV_LOGIN, MAIN_015 } from "./alaTestData";

/** /login → /verify → /mode-select using the dev bypass credentials. */
export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#identifier").fill(DEV_LOGIN.email);
  await page.getByRole("button", { name: "Send Verification Code" }).click();
  await page.waitForURL("**/verify");
  await page.locator("#code").fill(DEV_LOGIN.code);
  await page.getByRole("button", { name: "Verify Code" }).click();
  await page.waitForURL("**/mode-select");
}

/** Pick a mode on /mode-select and continue to /procedure-type. */
export async function chooseMode(
  page: Page,
  mode: "Test Mode" | "Normal Mode",
): Promise<void> {
  await page.getByRole("button", { name: new RegExp(mode) }).click();
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await page.waitForURL("**/procedure-type");
}

/**
 * From /procedure-type, create an insertion treatment for the given test
 * patient and land on the scan screen with applicators loaded.
 */
export async function startInsertion(
  page: Page,
  patient: {
    siteQuery: string;
    date: "Yesterday" | "Today" | "Tomorrow";
    patientLabel: string;
  } = MAIN_015,
): Promise<void> {
  await page.getByRole("button", { name: /New treatment insertion/ }).click();
  await page.getByRole("button", { name: /^Proceed$/ }).click();
  await page.waitForURL("**/treatment/select");

  const site = page.getByPlaceholder("Search sites...");
  await site.click();
  await site.fill(patient.siteQuery);
  await page.locator('ul[role="listbox"] li, [role="option"]').first().click();
  await page
    .getByRole("button", { name: new RegExp(`^${patient.date}$`) })
    .click();
  await page
    .locator("#patientId")
    .selectOption({ label: patient.patientLabel });
  await page.locator("#surgeon").fill("Dr Test");
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await page.waitForURL("**/treatment/scan");

  // Scanner mode is the default; manual controls (incl. "Choose from List")
  // only appear after this. Applicators then load lazily.
  await page.getByText("Enter Manually", { exact: false }).first().click();
  await page
    .getByText(/Choose from List \([1-9]/)
    .first()
    .waitFor({ timeout: 30000 });
}

/** Open an applicator's detail form from the "Choose from List" panel. */
export async function selectApplicator(
  page: Page,
  serial: string,
): Promise<void> {
  await page
    .getByRole("button", { name: /Choose from List/ })
    .first()
    .click();
  await page.locator("button", { hasText: serial }).first().click();
  await expect(page.locator("#status")).toBeVisible();
}

/**
 * Apply one workflow step to the open applicator. Terminal statuses
 * (INSERTED/FAULTY/...) raise a permanent-status confirmation that is accepted
 * here. Saves via "Insert" and waits for the list to refresh. Pancreas orders
 * need OPENED→LOADED→INSERTED (re-select between steps); skin goes direct.
 */
export async function applyStatusStep(
  page: Page,
  status: string,
  opts: { qty?: number; comment?: string } = {},
): Promise<void> {
  await page.locator("#status").selectOption(status);
  const confirm = page.getByRole("button", {
    name: new RegExp(`Yes, Mark as ${status}`),
  });
  if (await confirm.count()) await confirm.click();
  if (opts.qty != null) {
    await page.locator("#insertedSeedsQty").fill(String(opts.qty));
  }
  if (opts.comment) {
    await page.locator("#comments").fill(opts.comment);
  }
  await page.getByRole("button", { name: /^Insert$/ }).click();
  await expect(
    page.getByText(/Choose from List \(\d+\)/).first(),
  ).toBeVisible();
}

/** Drive an applicator SEALED→…→target in one call (handles 3-stage). */
export async function processApplicator(
  page: Page,
  serial: string,
  target: "INSERTED" | "FAULTY",
  opts: { qty?: number; comment?: string } = {},
): Promise<void> {
  const path =
    target === "INSERTED"
      ? ["OPENED", "LOADED", "INSERTED"]
      : ["OPENED", "FAULTY"];
  for (let i = 0; i < path.length; i++) {
    await selectApplicator(page, serial);
    const last = i === path.length - 1;
    await applyStatusStep(page, path[i], last ? opts : {});
  }
}

/** "Finalize / Use List" → confirm → /treatment/list (UseList). */
export async function finalizeToUseList(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Finalize \/ Use List/ }).click();
  await page.getByRole("button", { name: /^Yes$/ }).click();
  await page.waitForURL("**/treatment/list");
}

/** UseList "Total DaRT Sources Inserted" value (trimmed string). */
export async function summaryTotal(page: Page): Promise<string> {
  const txt = await page
    .locator('p:has-text("Total DaRT Sources Inserted") + p')
    .innerText();
  return txt.trim();
}
