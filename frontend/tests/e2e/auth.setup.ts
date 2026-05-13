import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * One-time interactive admin login. Captures cookies + localStorage +
 * sessionStorage after a human verifies the 6-digit email code, then writes
 * the state to playwright/.auth/admin.json. Subsequent test runs reuse that
 * file via `test.use({ storageState })` and skip the login entirely.
 *
 * Run via: `npm run test:e2e:prod:setup`
 *
 * The setup logs every `/api/auth/*` response so any Priority-side rejection
 * (404 user-not-found, 401, 403, 500) is visible in the terminal instead of
 * appearing as a silent "still on login page" timeout.
 */

const AUTH_FILE = path.join(
  __dirname,
  "..",
  "..",
  "playwright",
  ".auth",
  "admin.json",
);
const ADMIN_EMAIL = "amitaik@alphatau.com";

setup(
  "authenticate as admin (interactive — enter email code)",
  async ({ page }) => {
    setup.setTimeout(5 * 60 * 1000); // human-in-the-loop

    // Diagnostics: surface auth-API responses so the operator sees what Priority said.
    page.on("response", async (resp) => {
      const u = resp.url();
      if (!u.includes("/api/auth/")) return;
      const status = resp.status();
      let body = "";
      try {
        body = await resp.text();
      } catch {
        // binary or no body — fine
      }
      // Trim long bodies; the first 200 chars contain enough signal.
      const preview = body.replace(/\s+/g, " ").slice(0, 200);
      console.log(
        `[auth] ${resp.request().method()} ${u} -> ${status}  ${preview}`,
      );
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`[browser-console-error] ${msg.text()}`);
      }
    });

    await page.goto("/");
    await page.getByTestId("identifier-input").fill(ADMIN_EMAIL);
    await page.getByTestId("request-code-button").click();

    // LoginPage shows a 1.5 s success message then navigates to /verify. If the
    // backend rejected the email, navigation never happens — surface that with
    // a clear error instead of a generic timeout.
    try {
      await page.waitForURL(/\/verify/, { timeout: 25_000 });
    } catch {
      const visibleText = (
        await page
          .locator("body")
          .innerText()
          .catch(() => "")
      ).slice(0, 500);
      throw new Error(
        `Did not navigate to /verify within 25 s. Check the [auth] log lines\n` +
          `above for the actual API response. Visible page text:\n${visibleText}`,
      );
    }
    await expect(page.getByTestId("code-input")).toBeVisible({
      timeout: 10_000,
    });

    console.log("\n========================================");
    console.log("  AUTH SETUP: 6-digit code sent to");
    console.log(`  ${ADMIN_EMAIL}`);
    console.log("");
    console.log("  Browser is on the Verification page.");
    console.log("  1) Check your email for the 6-digit code.");
    console.log("  2) Type it into the 'Verification Code' field");
    console.log("     in the browser, then click 'Verify Code'.");
    console.log("");
    console.log("  That's it. No Inspector click needed —");
    console.log("  the test auto-detects post-login navigation");
    console.log("  and saves the auth state automatically.");
    console.log("========================================\n");

    // Admin (Position 99) is routed to /mode-select after a successful verify;
    // non-admin users would land on /procedure-type. Either signals login OK.
    // Generous 5-minute timeout while the operator pulls the code from email.
    await page.waitForURL(/\/(mode-select|procedure-type)/, {
      timeout: 5 * 60 * 1000,
    });

    await page.context().storageState({ path: AUTH_FILE });
    console.log(`\n[auth] saved storageState -> ${AUTH_FILE}\n`);
  },
);
