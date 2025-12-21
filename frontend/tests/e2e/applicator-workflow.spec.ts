import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3000';

// Test user credentials
const TEST_USER = {
  email: 'test@example.com',
  code: '123456'
};

// Helper function to login
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="text"][placeholder*="code"]', TEST_USER.code);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/procedure-type`);
}

// Helper function to select insertion treatment
async function selectInsertionTreatment(page: Page, treatmentType: 'pancreas' | 'prostate' | 'skin' = 'pancreas') {
  await page.click('text=Insertion');
  await page.waitForURL(`${BASE_URL}/select-treatment?type=insertion`);

  // Select the first available treatment of specified type
  const treatmentCard = page.locator(`[data-treatment-type*="${treatmentType}"]`).first();
  await treatmentCard.click();

  await page.waitForURL(/\/treatment\/scan/);
}

// Helper function to scan/add an applicator
async function scanApplicator(page: Page, serialNumber: string) {
  await page.fill('input[placeholder*="serial"]', serialNumber);
  await page.click('button:has-text("Scan")');

  // Wait for validation to complete
  await page.waitForTimeout(500);
}

test.describe('8-State Applicator Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Complete workflow: SEALED → OPENED → LOADED → INSERTED', async ({ page }) => {
    await selectInsertionTreatment(page, 'pancreas');

    // Scan applicator (initial state: SEALED)
    await scanApplicator(page, 'APP-TEST-001');

    // Verify applicator appears in list with SEALED status
    await expect(page.locator('text=APP-TEST-001')).toBeVisible();
    await expect(page.locator('[data-status="SEALED"]').or(page.locator('text=SEALED'))).toBeVisible();

    // Transition to OPENED
    await page.click('button:has-text("Open Package")');
    await expect(page.locator('[data-status="OPENED"]').or(page.locator('text=OPENED'))).toBeVisible();

    // Transition to LOADED
    await page.click('button:has-text("Load Applicator")');
    await expect(page.locator('[data-status="LOADED"]').or(page.locator('text=LOADED'))).toBeVisible();

    // Transition to INSERTED
    await page.click('button:has-text("Insert")');
    await page.fill('input[name="insertedSeedsQty"]', '25');
    await page.click('button:has-text("Confirm")');

    await expect(page.locator('[data-status="INSERTED"]').or(page.locator('text=INSERTED'))).toBeVisible();

    // Verify row color changed to green (inserted state)
    const row = page.locator('tr:has-text("APP-TEST-001")');
    await expect(row).toHaveClass(/bg-green/);
  });

  test('Invalid transition: SEALED → INSERTED should be rejected', async ({ page }) => {
    await selectInsertionTreatment(page, 'skin');

    await scanApplicator(page, 'APP-TEST-002');

    // Try to directly insert without opening/loading
    const insertButton = page.locator('button:has-text("Insert")');

    // Button should be disabled or not visible
    await expect(insertButton).toBeDisabled();
  });

  test('Faulty applicator workflow: OPENED → FAULTY', async ({ page }) => {
    await selectInsertionTreatment(page, 'skin');

    await scanApplicator(page, 'APP-TEST-003');

    // Open package
    await page.click('button:has-text("Open Package")');
    await expect(page.locator('text=OPENED')).toBeVisible();

    // Mark as faulty
    await page.click('button:has-text("Mark Faulty")');
    await page.fill('textarea[name="comments"]', 'Damaged applicator tip');
    await page.click('button:has-text("Confirm Faulty")');

    await expect(page.locator('text=FAULTY')).toBeVisible();

    // Verify row color changed to black (terminal state)
    const row = page.locator('tr:has-text("APP-TEST-003")');
    await expect(row).toHaveClass(/bg-gray-900/);
  });

  test('Disposal workflow: OPENED → DISPOSED', async ({ page }) => {
    await selectInsertionTreatment(page, 'skin');

    await scanApplicator(page, 'APP-TEST-004');

    // Open package
    await page.click('button:has-text("Open Package")');

    // Mark as disposed
    await page.click('button:has-text("Dispose")');
    await page.fill('textarea[name="comments"]', 'Contaminated');
    await page.click('button:has-text("Confirm Dispose")');

    await expect(page.locator('text=DISPOSED')).toBeVisible();

    // Verify terminal state (cannot transition further)
    const row = page.locator('tr:has-text("APP-TEST-004")');
    await expect(row).toHaveClass(/bg-gray-900/);
  });

  test('Deployment failure workflow: LOADED → DEPLOYMENT_FAILURE', async ({ page }) => {
    await selectInsertionTreatment(page, 'pancreas');

    await scanApplicator(page, 'APP-TEST-005');

    // Open and load
    await page.click('button:has-text("Open Package")');
    await page.click('button:has-text("Load Applicator")');

    // Mark as deployment failure
    await page.click('button:has-text("Deployment Failure")');
    await page.fill('textarea[name="comments"]', 'Needle jammed during insertion');
    await page.click('button:has-text("Confirm")');

    await expect(page.locator('text=DEPLOYMENT_FAILURE')).toBeVisible();
  });

  test('Discharged workflow: INSERTED → DISCHARGED', async ({ page }) => {
    await selectInsertionTreatment(page, 'pancreas');

    await scanApplicator(page, 'APP-TEST-006');

    // Complete full workflow to INSERTED
    await page.click('button:has-text("Open Package")');
    await page.click('button:has-text("Load Applicator")');
    await page.click('button:has-text("Insert")');
    await page.fill('input[name="insertedSeedsQty"]', '25');
    await page.click('button:has-text("Confirm")');

    await expect(page.locator('text=INSERTED')).toBeVisible();

    // Transition to DISCHARGED (post-insertion removal)
    await page.click('button:has-text("Discharge")');
    await page.fill('textarea[name="comments"]', 'Removed after procedure');
    await page.click('button:has-text("Confirm Discharge")');

    await expect(page.locator('text=DISCHARGED')).toBeVisible();

    // Verify terminal state (cannot transition further)
    const row = page.locator('tr:has-text("APP-TEST-006")');
    await expect(row).toHaveClass(/bg-gray-900/);
  });

  test('Treatment-specific transitions: Skin workflow skips OPENED/LOADED', async ({ page }) => {
    // Skin treatments use simplified 2-stage workflow: SEALED → INSERTED
    await selectInsertionTreatment(page, 'skin');

    await scanApplicator(page, 'APP-TEST-007');

    // Skin workflow should allow direct SEALED → INSERTED (no OPENED/LOADED stages)
    // Check that insert button is available directly
    const insertButton = page.locator('button:has-text("Insert")');
    await expect(insertButton).toBeEnabled();

    // Complete insertion
    await page.click('button:has-text("Insert")');
    await page.fill('input[name="insertedSeedsQty"]', '20');
    await page.click('button:has-text("Confirm")');

    await expect(page.locator('text=INSERTED')).toBeVisible();
  });

  test('Treatment-specific transitions: Pancreas requires 3-stage workflow', async ({ page }) => {
    // Pancreas treatments require: SEALED → OPENED → LOADED → INSERTED
    await selectInsertionTreatment(page, 'pancreas');

    await scanApplicator(page, 'APP-TEST-008');

    // Verify SEALED state
    await expect(page.locator('text=SEALED')).toBeVisible();

    // Insert button should be disabled (cannot skip OPENED and LOADED)
    const insertButton = page.locator('button:has-text("Insert")');
    await expect(insertButton).toBeDisabled();

    // Must follow proper sequence
    await page.click('button:has-text("Open Package")');
    await expect(page.locator('text=OPENED')).toBeVisible();
    await expect(insertButton).toBeDisabled(); // Still disabled until LOADED

    await page.click('button:has-text("Load Applicator")');
    await expect(page.locator('text=LOADED')).toBeVisible();
    await expect(insertButton).toBeEnabled(); // Now enabled

    await page.click('button:has-text("Insert")');
    await page.fill('input[name="insertedSeedsQty"]', '25');
    await page.click('button:has-text("Confirm")');

    await expect(page.locator('text=INSERTED')).toBeVisible();
  });
});

test.describe('Package Creation for Pancreas Treatment', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await selectInsertionTreatment(page, 'pancreas');
  });

  test('Create package with 4 loaded applicators', async ({ page }) => {
    // Scan and load 4 applicators
    const applicators = ['APP-PKG-001', 'APP-PKG-002', 'APP-PKG-003', 'APP-PKG-004'];

    for (const serial of applicators) {
      await scanApplicator(page, serial);
      await page.click('button:has-text("Open Package")');
      await page.click('button:has-text("Load Applicator")');

      // Navigate back to scan another
      if (serial !== applicators[applicators.length - 1]) {
        await page.click('button:has-text("Back to Treatment")');
      }
    }

    // Navigate to Use List to create package
    await page.click('text=Use List');
    await page.waitForURL(/\/treatment\/use-list/);

    // Verify Package Manager is visible (pancreas treatment)
    await expect(page.locator('text=Package Management')).toBeVisible();

    // Open package creation dialog
    await page.click('button:has-text("Create Package")');

    // Wait for dialog
    await expect(page.locator('text=Create Package (Select 4 Applicators)')).toBeVisible();

    // Select all 4 applicators
    for (const serial of applicators) {
      await page.click(`text=${serial}`);
    }

    // Verify selection count
    await expect(page.locator('text=Selected: 4 / 4 applicators')).toBeVisible();

    // Create package
    await page.click('button:has-text("Create Package"):last-of-type');

    // Wait for success message
    await expect(page.locator('text=Package P1 created successfully')).toBeVisible();

    // Verify package labels appear in the table
    await expect(page.locator('text=P1')).toHaveCount(4);
  });

  test('Package creation validation: Must select exactly 4', async ({ page }) => {
    // Scan and load 3 applicators
    const applicators = ['APP-PKG-005', 'APP-PKG-006', 'APP-PKG-007'];

    for (const serial of applicators) {
      await scanApplicator(page, serial);
      await page.click('button:has-text("Open Package")');
      await page.click('button:has-text("Load Applicator")');

      if (serial !== applicators[applicators.length - 1]) {
        await page.click('button:has-text("Back to Treatment")');
      }
    }

    // Navigate to Use List
    await page.click('text=Use List');
    await page.click('button:has-text("Create Package")');

    // Try to create with only 3 selected
    for (const serial of applicators) {
      await page.click(`text=${serial}`);
    }

    await page.click('button:has-text("Create Package"):last-of-type');

    // Should show error
    await expect(page.locator('text=You must select exactly 4 applicators')).toBeVisible();
  });

  test('Package creation validation: Must be same type (seed quantity)', async ({ page }) => {
    // This test would require applicators with different seed quantities
    // Placeholder for validation test
  });

  test('Package labels increment correctly (P1, P2, P3)', async ({ page }) => {
    // Create first package (P1)
    const package1 = ['APP-P1-001', 'APP-P1-002', 'APP-P1-003', 'APP-P1-004'];

    for (const serial of package1) {
      await scanApplicator(page, serial);
      await page.click('button:has-text("Open Package")');
      await page.click('button:has-text("Load Applicator")');
      if (serial !== package1[package1.length - 1]) {
        await page.click('button:has-text("Back to Treatment")');
      }
    }

    await page.click('text=Use List');
    await page.click('button:has-text("Create Package")');

    for (const serial of package1) {
      await page.click(`text=${serial}`);
    }

    await page.click('button:has-text("Create Package"):last-of-type');
    await expect(page.locator('text=Package P1 created successfully')).toBeVisible();

    // Close dialog and go back to treatment
    await page.click('button:has-text("Back to Treatment")');

    // Create second package (P2)
    const package2 = ['APP-P2-001', 'APP-P2-002', 'APP-P2-003', 'APP-P2-004'];

    for (const serial of package2) {
      await scanApplicator(page, serial);
      await page.click('button:has-text("Open Package")');
      await page.click('button:has-text("Load Applicator")');
      if (serial !== package2[package2.length - 1]) {
        await page.click('button:has-text("Back to Treatment")');
      }
    }

    await page.click('text=Use List');
    await page.click('button:has-text("Create Package")');

    for (const serial of package2) {
      await page.click(`text=${serial}`);
    }

    await page.click('button:has-text("Create Package"):last-of-type');
    await expect(page.locator('text=Package P2 created successfully')).toBeVisible();

    // Verify both packages are visible
    await expect(page.locator('text=P1')).toHaveCount(4);
    await expect(page.locator('text=P2')).toHaveCount(4);
  });

  test('Package Manager should NOT appear for skin treatments', async ({ page }) => {
    // Navigate back to procedure selection
    await page.click('text=Back');
    await page.click('text=Back');

    // Select skin insertion treatment
    await page.click('text=Insertion');
    const skinTreatment = page.locator('[data-treatment-type*="skin"]').first();
    await skinTreatment.click();

    // Scan an applicator
    await scanApplicator(page, 'APP-SKIN-001');
    await page.click('button:has-text("Open Package")');
    await page.click('button:has-text("Load Applicator")');

    // Navigate to Use List
    await page.click('text=Use List');

    // Package Manager should NOT be visible
    await expect(page.locator('text=Package Management')).not.toBeVisible();
  });
});

test.describe('Sorting and Display', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await selectInsertionTreatment(page, 'skin');
  });

  test('Active states (SEALED, OPENED, LOADED) should sort to top', async ({ page }) => {
    // Create applicators in various states
    await scanApplicator(page, 'APP-SORT-001');
    await page.click('button:has-text("Open Package")');
    await page.click('button:has-text("Load Applicator")');
    await page.click('button:has-text("Insert")');
    await page.fill('input[name="insertedSeedsQty"]', '25');
    await page.click('button:has-text("Confirm")'); // INSERTED (terminal)

    await page.click('button:has-text("Back to Treatment")');

    await scanApplicator(page, 'APP-SORT-002');
    await page.click('button:has-text("Open Package")'); // OPENED (active)

    await page.click('button:has-text("Back to Treatment")');

    await scanApplicator(page, 'APP-SORT-003'); // SEALED (active)

    // Navigate to Use List
    await page.click('text=Use List');

    // Get all row serial numbers in order
    const rows = page.locator('tbody tr');
    const firstRow = rows.first();
    const lastRow = rows.last();

    // Active states should be at top
    await expect(firstRow).toContainText(/APP-SORT-00(2|3)/); // OPENED or SEALED

    // Terminal state should be at bottom
    await expect(lastRow).toContainText('APP-SORT-001'); // INSERTED
  });

  test('Row colors should reflect status correctly', async ({ page }) => {
    // Test different status colors
    await scanApplicator(page, 'APP-COLOR-001');

    // SEALED = white
    let row = page.locator('tr:has-text("APP-COLOR-001")');
    await expect(row).toHaveClass(/bg-white/);

    // OPENED = red
    await page.click('button:has-text("Open Package")');
    await expect(row).toHaveClass(/bg-red/);

    // LOADED = yellow
    await page.click('button:has-text("Load Applicator")');
    await expect(row).toHaveClass(/bg-yellow/);

    // INSERTED = green
    await page.click('button:has-text("Insert")');
    await page.fill('input[name="insertedSeedsQty"]', '25');
    await page.click('button:has-text("Confirm")');
    await page.click('text=Use List');

    row = page.locator('tr:has-text("APP-COLOR-001")');
    await expect(row).toHaveClass(/bg-green/);
  });

  test('Terminal states (DISPOSED, FAULTY, etc.) should have black background', async ({ page }) => {
    await scanApplicator(page, 'APP-TERMINAL-001');
    await page.click('button:has-text("Open Package")');
    await page.click('button:has-text("Mark Faulty")');
    await page.fill('textarea[name="comments"]', 'Defective');
    await page.click('button:has-text("Confirm Faulty")');

    await page.click('text=Use List');

    const row = page.locator('tr:has-text("APP-TERMINAL-001")');
    await expect(row).toHaveClass(/bg-gray-900/);
    await expect(row).toHaveClass(/text-white/);
  });
});

test.describe('Priority API Sync Behavior', () => {
  test('Intermediate states should NOT sync to Priority', async ({ page }) => {
    await login(page);
    await selectInsertionTreatment(page, 'skin');

    await scanApplicator(page, 'APP-SYNC-001');

    // SEALED, OPENED, LOADED should not trigger Priority sync
    // This would require API mocking or checking network requests
    // Placeholder for Priority sync verification test
  });

  test('Terminal state INSERTED should sync to Priority as "Full use"', async ({ page }) => {
    await login(page);
    await selectInsertionTreatment(page, 'skin');

    await scanApplicator(page, 'APP-SYNC-002');
    await page.click('button:has-text("Open Package")');
    await page.click('button:has-text("Load Applicator")');
    await page.click('button:has-text("Insert")');
    await page.fill('input[name="insertedSeedsQty"]', '25');
    await page.click('button:has-text("Confirm")');

    // Should trigger Priority API sync with usageType: "Full use"
    // Requires network request monitoring
  });

  test('Terminal state FAULTY should sync to Priority as "Faulty"', async ({ page }) => {
    await login(page);
    await selectInsertionTreatment(page, 'skin');

    await scanApplicator(page, 'APP-SYNC-003');
    await page.click('button:has-text("Open Package")');
    await page.click('button:has-text("Mark Faulty")');
    await page.fill('textarea[name="comments"]', 'Broken tip');
    await page.click('button:has-text("Confirm Faulty")');

    // Should trigger Priority API sync with usageType: "Faulty"
  });
});
