import { test, expect } from "@playwright/test";
import { login, chooseMode, startInsertion } from "./helpers/alaFlow";
import { MAIN_015, TEST_MODE_BANNER } from "./helpers/alaTestData";

/**
 * Harness smoke test — authored using ONLY the committed helpers + test-data
 * map (no browser exploration), to prove the institutionalized knowledge lets a
 * new spec be written immediately. Asserts the documented worked example holds:
 * Test Mode insertion for "Patient Main-015" exposes its 3 applicators.
 */
test.describe("E2E harness smoke (real app, real backend)", () => {
  test("Test Mode insertion for the documented test patient loads its applicators", async ({
    page,
  }) => {
    await login(page);
    await chooseMode(page, "Test Mode");
    await startInsertion(page, MAIN_015);

    await expect(page.getByText(TEST_MODE_BANNER)).toBeVisible();
    // MAIN_015 (order SO25000015) has 3 applicators per the test-data map.
    await expect(
      page
        .getByText(
          new RegExp(`Choose from List \\(${MAIN_015.applicators.length}\\)`),
        )
        .first(),
    ).toBeVisible();
  });
});
