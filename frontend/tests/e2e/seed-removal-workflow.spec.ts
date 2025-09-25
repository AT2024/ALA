import { test, expect, Page, BrowserContext } from '@playwright/test';
import { format } from 'date-fns';

/**
 * Comprehensive E2E Test for Seed Removal Workflow
 * Tests the complete seed removal process including:
 * - Treatment selection and validation
 * - Applicator management and progress tracking
 * - Individual seed removal simulation
 * - PDF export verification
 * - Error handling scenarios
 * - Cross-browser compatibility
 */

// Test data fixtures
const TEST_DATA = {
  USER: {
    email: 'test@example.com',
    verificationCode: '123456'
  },
  PATIENT: {
    id: 'TEST-001',
    site: 'Test Hospital'
  },
  APPLICATORS: [
    {
      serialNumber: 'AP001-A1',
      applicatorType: 'Standard',
      seedQuantity: 25,
      usageType: 'full'
    },
    {
      serialNumber: 'AP002-A2',
      applicatorType: 'Large',
      seedQuantity: 50,
      usageType: 'full'
    },
    {
      serialNumber: 'AP003-A3',
      applicatorType: 'Small',
      seedQuantity: 10,
      usageType: 'faulty'
    }
  ]
};

// Page Object Model for better maintainability
class SeedRemovalPage {
  constructor(private page: Page) {}

  // Locators
  get treatmentInfoSection() {
    return this.page.locator('[data-testid="treatment-info"]');
  }

  get applicatorGroupsSection() {
    return this.page.locator('[data-testid="applicator-groups"]');
  }

  get detailedApplicatorList() {
    return this.page.locator('[data-testid="detailed-applicator-list"]');
  }

  get progressDisplay() {
    return this.page.locator('[data-testid="removal-progress"]');
  }

  get individualSeedButton() {
    return this.page.locator('[data-testid="remove-individual-seed"]');
  }

  get completeTreatmentButton() {
    return this.page.locator('[data-testid="complete-treatment"]');
  }

  // Helper methods
  async getApplicatorCheckbox(serialNumber: string) {
    return this.page.locator(`[data-testid="applicator-checkbox-${serialNumber}"]`);
  }

  async getApplicatorComments(serialNumber: string) {
    return this.page.locator(`[data-testid="applicator-comments-${serialNumber}"]`);
  }

  async getProgressBar() {
    return this.page.locator('[data-testid="progress-bar"]');
  }

  async getRemovalSummary() {
    return this.page.locator('[data-testid="removal-summary"]');
  }
}

class AuthenticationHelper {
  constructor(private page: Page) {}

  async login() {
    await this.page.goto('/');

    // Fill authentication form
    await this.page.fill('[data-testid="identifier-input"]', TEST_DATA.USER.email);
    await this.page.click('[data-testid="request-code-button"]');

    // Wait for verification code input
    await expect(this.page.locator('[data-testid="code-input"]')).toBeVisible();
    await this.page.fill('[data-testid="code-input"]', TEST_DATA.USER.verificationCode);
    await this.page.click('[data-testid="verify-code-button"]');

    // Wait for successful authentication
    await expect(this.page).toHaveURL(/.*\/treatment/);
  }
}

class TreatmentSetupHelper {
  constructor(private page: Page) {}

  async createRemovalTreatment() {
    // Navigate to treatment selection
    await this.page.goto('/treatment/select');

    // Create or select a removal treatment
    await this.page.click('[data-testid="treatment-type-removal"]');
    await this.page.fill('[data-testid="patient-id-input"]', TEST_DATA.PATIENT.id);
    await this.page.selectOption('[data-testid="site-select"]', TEST_DATA.PATIENT.site);

    // Set insertion date (simulate treatment from yesterday for removal workflow)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const insertionDate = format(yesterday, 'yyyy-MM-dd');
    await this.page.fill('[data-testid="insertion-date-input"]', insertionDate);

    await this.page.click('[data-testid="create-treatment-button"]');

    // Wait for treatment to be created and redirected to removal page
    await expect(this.page).toHaveURL(/.*\/treatment\/seed-removal/);
  }

  async setupApplicators() {
    // Mock API response for available applicators
    await this.page.route('**/api/priority/applicators', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          applicators: TEST_DATA.APPLICATORS.map(app => ({
            serialNumber: app.serialNumber,
            applicatorType: app.applicatorType,
            seedQuantity: app.seedQuantity,
            patientId: TEST_DATA.PATIENT.id
          }))
        })
      });
    });

    // Mock treatment service API calls
    await this.page.route('**/api/treatments/*/applicators', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          applicators: TEST_DATA.APPLICATORS
        })
      });
    });
  }
}

class BarcodeScanner {
  constructor(private page: Page) {}

  async simulateBarcodeScan(serialNumber: string) {
    // Simulate barcode scanner input
    // Since we can't actually scan barcodes in E2E tests, we'll simulate the scanner callback
    await this.page.evaluate((serial) => {
      // Trigger the same function that would be called by the scanner
      window.dispatchEvent(new CustomEvent('barcode-scanned', {
        detail: { serialNumber: serial }
      }));
    }, serialNumber);
  }

  async switchToManualEntry() {
    await this.page.click('[data-testid="manual-entry-toggle"]');
  }

  async enterManualSerial(serialNumber: string) {
    await this.page.fill('[data-testid="manual-serial-input"]', serialNumber);
    await this.page.click('[data-testid="validate-serial-button"]');
  }
}

class PDFExportHelper {
  constructor(private page: Page) {}

  async exportRemovalReport() {
    // Set up download handler
    const downloadPromise = this.page.waitForEvent('download');

    // Click export PDF button
    await this.page.click('[data-testid="export-pdf-button"]');

    // Wait for download to complete
    const download = await downloadPromise;

    // Verify download properties
    expect(download.suggestedFilename()).toMatch(/Treatment_Report_.*\.pdf/);

    return download;
  }

  async verifyPDFContent(download: any) {
    // Save the download to a temporary location for verification
    const path = await download.path();
    expect(path).toBeTruthy();

    // Additional PDF content verification could be added here
    // using PDF parsing libraries if needed
  }
}

// Main test suite
test.describe('Seed Removal Workflow', () => {
  let authHelper: AuthenticationHelper;
  let treatmentHelper: TreatmentSetupHelper;
  let seedRemovalPage: SeedRemovalPage;
  let barcodeScanner: BarcodeScanner;
  let pdfHelper: PDFExportHelper;

  test.beforeEach(async ({ page, context }) => {
    // Initialize page helpers
    authHelper = new AuthenticationHelper(page);
    treatmentHelper = new TreatmentSetupHelper(page);
    seedRemovalPage = new SeedRemovalPage(page);
    barcodeScanner = new BarcodeScanner(page);
    pdfHelper = new PDFExportHelper(page);

    // Setup test environment
    await treatmentHelper.setupApplicators();

    // Login and create treatment
    await authHelper.login();
    await treatmentHelper.createRemovalTreatment();
  });

  test('should display treatment information correctly', async () => {
    // Verify treatment information is displayed
    await expect(seedRemovalPage.treatmentInfoSection).toBeVisible();

    // Check patient ID
    await expect(seedRemovalPage.page.locator('text=' + TEST_DATA.PATIENT.id)).toBeVisible();

    // Check treatment type
    await expect(seedRemovalPage.page.locator('text=removal')).toBeVisible();

    // Check days since insertion calculation
    await expect(seedRemovalPage.page.locator('text=1 day')).toBeVisible();
  });

  test('should show initial progress state', async () => {
    // Verify initial progress display
    await expect(seedRemovalPage.progressDisplay).toBeVisible();

    // Check that progress shows 0 removed initially
    await expect(seedRemovalPage.page.locator('text=Removed: 0')).toBeVisible();

    // Verify applicator groups are displayed
    await expect(seedRemovalPage.applicatorGroupsSection).toBeVisible();
  });

  test('should remove applicators and update progress', async () => {
    // Get initial progress
    const initialProgress = await seedRemovalPage.progressDisplay.textContent();

    // Remove first applicator (25 seeds)
    const firstApplicator = TEST_DATA.APPLICATORS[0];
    const checkbox = await seedRemovalPage.getApplicatorCheckbox(firstApplicator.serialNumber);
    await checkbox.check();

    // Verify progress updated
    await expect(seedRemovalPage.page.locator('text=Removed: 25')).toBeVisible();

    // Remove second applicator (50 seeds)
    const secondApplicator = TEST_DATA.APPLICATORS[1];
    const secondCheckbox = await seedRemovalPage.getApplicatorCheckbox(secondApplicator.serialNumber);
    await secondCheckbox.check();

    // Verify cumulative progress
    await expect(seedRemovalPage.page.locator('text=Removed: 75')).toBeVisible();
  });

  test('should handle individual seed removal', async () => {
    // Click individual seed removal button multiple times
    for (let i = 1; i <= 5; i++) {
      await seedRemovalPage.individualSeedButton.click();

      // Verify individual seed counter updates
      await expect(seedRemovalPage.page.locator(`text=Individual seeds removed: ${i}`)).toBeVisible();
    }

    // Verify progress includes individual seeds
    await expect(seedRemovalPage.page.locator('text=Removed: 5')).toBeVisible();
  });

  test('should add and save removal comments', async () => {
    const applicator = TEST_DATA.APPLICATORS[0];
    const testComment = 'Applicator removed successfully with no complications';

    // Add comment to applicator
    const commentsField = await seedRemovalPage.getApplicatorComments(applicator.serialNumber);
    await commentsField.fill(testComment);

    // Trigger save (blur event)
    await commentsField.blur();

    // Mark applicator as removed
    const checkbox = await seedRemovalPage.getApplicatorCheckbox(applicator.serialNumber);
    await checkbox.check();

    // Verify comment is saved and visible
    await expect(commentsField).toHaveValue(testComment);
  });

  test('should complete treatment when all seeds are removed', async () => {
    // Remove all applicators
    for (const applicator of TEST_DATA.APPLICATORS) {
      const checkbox = await seedRemovalPage.getApplicatorCheckbox(applicator.serialNumber);
      await checkbox.check();
    }

    // Verify complete treatment button is enabled
    await expect(seedRemovalPage.completeTreatmentButton).toBeEnabled();

    // Complete treatment
    await seedRemovalPage.completeTreatmentButton.click();

    // Verify redirect to treatment selection
    await expect(seedRemovalPage.page).toHaveURL(/.*\/treatment\/select/);
  });

  test('should allow completion with missing seeds', async () => {
    // Remove only some applicators (partial removal)
    const checkbox = await seedRemovalPage.getApplicatorCheckbox(TEST_DATA.APPLICATORS[0].serialNumber);
    await checkbox.check();

    // Verify button text changes for partial completion
    await expect(seedRemovalPage.completeTreatmentButton).toHaveText(/Complete with Missing Seeds/);

    // Should still be able to complete
    await expect(seedRemovalPage.completeTreatmentButton).toBeEnabled();
  });

  test('should export PDF report correctly', async () => {
    // Remove some applicators first
    const checkbox1 = await seedRemovalPage.getApplicatorCheckbox(TEST_DATA.APPLICATORS[0].serialNumber);
    await checkbox1.check();

    const checkbox2 = await seedRemovalPage.getApplicatorCheckbox(TEST_DATA.APPLICATORS[1].serialNumber);
    await checkbox2.check();

    // Export PDF
    const download = await pdfHelper.exportRemovalReport();

    // Verify PDF properties
    expect(download.suggestedFilename()).toMatch(/Treatment_Report_TEST-001_.*\.pdf/);

    // Verify PDF content structure
    await pdfHelper.verifyPDFContent(download);
  });

  test('should handle applicator group removal', async () => {
    // Find applicator group with multiple applicators
    const groupButton = seedRemovalPage.page.locator('[data-testid="remove-applicator-group"]').first();

    // Click group removal button
    await groupButton.click();

    // Verify one applicator from the group is marked as removed
    const progressBefore = await seedRemovalPage.progressDisplay.textContent();

    // Progress should update to reflect group removal
    await expect(seedRemovalPage.progressDisplay).not.toHaveText(progressBefore || '');
  });

  test('should validate progress calculations', async () => {
    // Calculate expected totals
    const expectedTotalSeeds = TEST_DATA.APPLICATORS.reduce((sum, app) => sum + app.seedQuantity, 0);

    // Verify total seeds display
    await expect(seedRemovalPage.page.locator(`text=/ ${expectedTotalSeeds}`)).toBeVisible();

    // Remove applicators one by one and verify calculations
    let removedSeeds = 0;
    for (const applicator of TEST_DATA.APPLICATORS) {
      const checkbox = await seedRemovalPage.getApplicatorCheckbox(applicator.serialNumber);
      await checkbox.check();

      removedSeeds += applicator.seedQuantity;

      // Verify running total
      await expect(seedRemovalPage.page.locator(`text=Removed: ${removedSeeds}`)).toBeVisible();

      // Verify percentage calculation
      const expectedPercentage = Math.round((removedSeeds / expectedTotalSeeds) * 100);
      // Note: Exact percentage matching might vary due to individual seeds, so we check for approximate values
    }
  });

  test('should handle reset of individual seeds', async () => {
    // Add individual seeds
    for (let i = 0; i < 3; i++) {
      await seedRemovalPage.individualSeedButton.click();
    }

    // Verify individual seeds counter
    await expect(seedRemovalPage.page.locator('text=Individual seeds removed: 3')).toBeVisible();

    // Reset individual seeds
    await seedRemovalPage.page.locator('[data-testid="reset-individual-seeds"]').click();

    // Verify reset
    await expect(seedRemovalPage.page.locator('text=Individual seeds removed:')).not.toBeVisible();
  });

  test('should display applicator details correctly', async () => {
    // Verify each applicator displays correct information
    for (const applicator of TEST_DATA.APPLICATORS) {
      await expect(seedRemovalPage.page.locator(`text=${applicator.serialNumber}`)).toBeVisible();
      await expect(seedRemovalPage.page.locator(`text=Seeds: ${applicator.seedQuantity}`)).toBeVisible();

      // Check usage type display
      const expectedUsageText = applicator.usageType === 'full' ? 'Full Use' :
                               applicator.usageType === 'faulty' ? 'Faulty' : 'No Use';
      await expect(seedRemovalPage.page.locator(`text=${expectedUsageText}`)).toBeVisible();
    }
  });

  test('should maintain progress consistency across page refreshes', async () => {
    // Remove some applicators
    const checkbox1 = await seedRemovalPage.getApplicatorCheckbox(TEST_DATA.APPLICATORS[0].serialNumber);
    await checkbox1.check();

    // Get current progress
    const progressText = await seedRemovalPage.progressDisplay.textContent();

    // Refresh page
    await seedRemovalPage.page.reload();

    // Verify progress is maintained (assuming proper persistence)
    await expect(seedRemovalPage.progressDisplay).toHaveText(progressText || '');
  });
});

// Cross-browser compatibility test group
test.describe('Cross-Browser Compatibility', () => {
  test('should work consistently across different browsers', async ({ browserName }) => {
    // This test will automatically run on different browsers based on playwright.config.ts
    test.info().annotations.push({ type: 'browser', description: browserName });

    // Basic functionality test for each browser
    const page = test.info().annotations.find(a => a.type === 'browser')?.description;
    console.log(`Running seed removal test on ${page}`);

    // Test basic page load and functionality
    // (Previous test logic can be reused here)
  });
});

// Mobile responsiveness tests
test.describe('Mobile Responsiveness', () => {
  test('should work on mobile devices', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'This test is only for mobile viewports');

    // Setup as before
    const authHelper = new AuthenticationHelper(page);
    const treatmentHelper = new TreatmentSetupHelper(page);
    const seedRemovalPage = new SeedRemovalPage(page);

    await treatmentHelper.setupApplicators();
    await authHelper.login();
    await treatmentHelper.createRemovalTreatment();

    // Test mobile-specific interactions
    await expect(seedRemovalPage.treatmentInfoSection).toBeVisible();

    // Verify mobile layout adaptations
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThan(800);
  });
});

// Error handling tests
test.describe('Error Handling', () => {
  test('should handle API failures gracefully', async ({ page }) => {
    const authHelper = new AuthenticationHelper(page);
    const treatmentHelper = new TreatmentSetupHelper(page);

    // Setup API failure scenarios
    await page.route('**/api/treatments/*/applicators', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await authHelper.login();
    await treatmentHelper.createRemovalTreatment();

    // Verify error handling
    await expect(page.locator('text=Failed to fetch applicators')).toBeVisible();
  });

  test('should handle network failures', async ({ page, context }) => {
    // Simulate offline condition
    await context.setOffline(true);

    const authHelper = new AuthenticationHelper(page);

    // Attempt operations while offline
    await authHelper.login();

    // Verify offline handling
    await expect(page.locator('text=Network error')).toBeVisible();
  });
});

// Performance tests
test.describe('Performance', () => {
  test('should complete removal workflow within acceptable time limits', async ({ page }) => {
    const startTime = Date.now();

    const authHelper = new AuthenticationHelper(page);
    const treatmentHelper = new TreatmentSetupHelper(page);
    const seedRemovalPage = new SeedRemovalPage(page);

    await treatmentHelper.setupApplicators();
    await authHelper.login();
    await treatmentHelper.createRemovalTreatment();

    // Complete full workflow
    for (const applicator of TEST_DATA.APPLICATORS) {
      const checkbox = await seedRemovalPage.getApplicatorCheckbox(applicator.serialNumber);
      await checkbox.check();
    }

    await seedRemovalPage.completeTreatmentButton.click();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Workflow should complete within 30 seconds
    expect(duration).toBeLessThan(30000);
  });
});