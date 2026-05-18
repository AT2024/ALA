import { test, expect } from "@playwright/test";
import {
  login,
  chooseMode,
  startInsertion,
  processApplicator,
  finalizeToUseList,
  summaryTotal,
} from "./helpers/alaFlow";
import { MAIN_015 } from "./helpers/alaTestData";

/**
 * Group B — Treatment Summary seed-count reconciliation
 * (branch `fix/test-mode-per-session`, `applicatorStatus.ts` /
 * `TreatmentContext.getActualInsertedSeeds`).
 *
 * Real app + backend (dev bypass = admin, simulated test-data.json).
 * Safety-critical contract: "Total DaRT Sources Inserted" must equal the
 * sources actually deployed — a partial INSERTED contributes its entered qty
 * (not full seedQuantity) and a FAULTY contributes only what it deployed
 * (the original bug counted FAULTY at full seedQuantity). Scenario on order
 * SO25000015 ("Patient Main-015", pancreas, 3-stage):
 *   A2 INSERTED 2 of 3  → 2
 *   A1 FAULTY    1 of 2  → 1
 *   Expected total = 3 (NOT 5 if over-counted). Falsifiability-proven.
 */

const [A1, A2] = MAIN_015.applicators;

test.describe("Group B — seed-count reconciliation (real app, real backend)", () => {
  test("Treatment Summary counts partial INSERTED + partial FAULTY without over-counting", async ({
    page,
  }) => {
    await login(page);
    await chooseMode(page, "Test Mode");
    await startInsertion(page, MAIN_015);

    await processApplicator(page, A2.serial, "INSERTED", { qty: 2 });
    await processApplicator(page, A1.serial, "FAULTY", {
      qty: 1,
      comment: "Equipment fault after partial deployment",
    });

    await finalizeToUseList(page);

    await expect(page.getByText("Treatment Summary")).toBeVisible();
    expect(await summaryTotal(page)).toBe("3");

    await expect(page.locator("tr", { hasText: A2.serial })).toBeVisible();
    await expect(page.locator("tr", { hasText: A1.serial })).toBeVisible();
  });
});
