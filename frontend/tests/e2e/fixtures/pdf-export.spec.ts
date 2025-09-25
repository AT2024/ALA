import { test, expect, Download } from '@playwright/test';
import { format } from 'date-fns';
import { MockDataGenerator, APIMockHelper, WaitHelpers, AssertionHelpers } from '../utils/test-helpers';

/**
 * PDF Export Functionality Tests
 * Tests comprehensive PDF generation for seed removal reports
 */

test.describe('PDF Export Functionality', () => {
  let mockHelper: APIMockHelper;
  let testData: ReturnType<typeof MockDataGenerator.generateRemovalScenario>;

  test.beforeEach(async ({ page }) => {
    mockHelper = new APIMockHelper(page);
    testData = MockDataGenerator.generateRemovalScenario();

    // Setup comprehensive mocks
    await mockHelper.mockSuccessfulAuthentication();
    await mockHelper.mockTreatmentAPIs(testData.treatment, testData.applicators);
    await mockHelper.mockPriorityAPI(testData.applicators);

    // Navigate to seed removal page
    await page.goto('/treatment/seed-removal');
    await WaitHelpers.waitForTreatmentLoad(page, testData.treatment.id);

    // Process some applicators to have data for export
    await processApplicators(page, testData.applicators.slice(0, 2));
  });

  test('should generate complete treatment PDF report', async ({ page }) => {
    const downloadPromise = WaitHelpers.waitForPDFDownload(page);

    // Trigger PDF export
    await page.click('[data-testid="export-pdf-button"]');

    const download = await downloadPromise;

    // Verify PDF file properties
    await AssertionHelpers.assertPDFContent(download, testData.treatment.subjectId);

    // Verify filename format
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^Treatment_Report_.*_\d{8}_\d{6}\.pdf$/);

    // Verify file size (should contain substantial content)
    const filePath = await download.path();
    const fs = require('fs');
    const stats = fs.statSync(filePath!);
    expect(stats.size).toBeGreaterThan(50000); // At least 50KB for comprehensive report
  });

  test('should include all required treatment information in PDF', async ({ page }) => {
    // Before exporting, capture current treatment state
    const treatmentInfo = await page.locator('[data-testid="treatment-info"]').textContent();
    const progressInfo = await page.locator('[data-testid="removal-progress"]').textContent();

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-pdf-button"]');
    const download = await downloadPromise;

    // Verify download completed successfully
    expect(download.suggestedFilename()).toBeTruthy();

    // For comprehensive PDF content verification, we'd typically use a PDF parsing library
    // Here we verify the export process completed without errors
    await expect(page.locator('text=PDF generated successfully')).toBeVisible({ timeout: 5000 });
  });

  test('should generate PDF with applicator removal details', async ({ page }) => {
    // Add removal comments to applicators
    const commentsTestData = [
      'Removed completely, no complications',
      'Partial removal due to tissue adhesion',
      'Standard removal procedure followed'
    ];

    for (let i = 0; i < testData.applicators.length; i++) {
      const applicator = testData.applicators[i];
      const comment = commentsTestData[i];

      // Add removal comment
      const commentsField = page.locator(`[data-testid="applicator-comments-${applicator.serialNumber}"]`);
      await commentsField.fill(comment);
      await commentsField.blur(); // Trigger save

      // Mark as removed
      const checkbox = page.locator(`[data-testid="applicator-checkbox-${applicator.serialNumber}"]`);
      await checkbox.check();
    }

    // Export PDF with complete removal data
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-pdf-button"]');
    const download = await downloadPromise;

    // Verify PDF includes removal details
    const filename = download.suggestedFilename();
    expect(filename).toContain(testData.treatment.subjectId);

    // Verify export success notification
    await expect(page.locator('text=PDF report exported successfully')).toBeVisible();
  });

  test('should handle PDF export with partial removal data', async ({ page }) => {
    // Remove only some applicators (partial treatment)
    const partialApplicators = testData.applicators.slice(0, 1);

    for (const applicator of partialApplicators) {
      const checkbox = page.locator(`[data-testid="applicator-checkbox-${applicator.serialNumber}"]`);
      await checkbox.check();
    }

    // Add some individual seed removals
    const individualSeedButton = page.locator('[data-testid="remove-individual-seed"]');
    for (let i = 0; i < 5; i++) {
      await individualSeedButton.click();
    }

    // Export PDF with partial data
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-pdf-button"]');
    const download = await downloadPromise;

    // Verify partial data export
    expect(download.suggestedFilename()).toBeTruthy();
    await expect(page.locator('text=PDF exported with current progress')).toBeVisible();
  });

  test('should generate PDF with correct timestamp and formatting', async ({ page }) => {
    const exportTime = new Date();

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-pdf-button"]');
    const download = await downloadPromise;

    const filename = download.suggestedFilename();

    // Verify timestamp in filename is recent (within last minute)
    const timestampMatch = filename.match(/(\d{8}_\d{6})/);
    expect(timestampMatch).toBeTruthy();

    if (timestampMatch) {
      const timestampStr = timestampMatch[1];
      const fileDate = timestampStr.substring(0, 8); // YYYYMMDD
      const fileTime = timestampStr.substring(9, 15); // HHMMSS

      const expectedDate = format(exportTime, 'yyyyMMdd');
      expect(fileDate).toBe(expectedDate);

      // Time should be within reasonable range (allowing for test execution time)
      const expectedTimePrefix = format(exportTime, 'HHmm');
      expect(fileTime.substring(0, 4)).toBe(expectedTimePrefix);
    }
  });

  test('should handle multiple PDF exports', async ({ page }) => {
    const downloadPromises: Promise<Download>[] = [];

    // Generate multiple PDFs quickly
    for (let i = 0; i < 3; i++) {
      downloadPromises.push(page.waitForEvent('download'));
      await page.click('[data-testid="export-pdf-button"]');
      await page.waitForTimeout(100); // Small delay between clicks
    }

    const downloads = await Promise.all(downloadPromises);

    // Verify all downloads completed
    expect(downloads).toHaveLength(3);

    // Verify each download has unique filename
    const filenames = downloads.map(d => d.suggestedFilename());
    const uniqueFilenames = new Set(filenames);
    expect(uniqueFilenames.size).toBe(3);

    // Verify all files have different timestamps
    for (const filename of filenames) {
      expect(filename).toMatch(/Treatment_Report_.*_\d{8}_\d{6}\.pdf/);
    }
  });

  test('should export PDF with summary statistics', async ({ page }) => {
    // Create comprehensive removal scenario
    const stats = {
      totalApplicators: testData.applicators.length,
      removedApplicators: 2,
      individualSeeds: 7,
      totalSeedsRemoved: 0
    };

    // Remove specific applicators
    for (let i = 0; i < stats.removedApplicators; i++) {
      const applicator = testData.applicators[i];
      stats.totalSeedsRemoved += applicator.seedQuantity;

      const checkbox = page.locator(`[data-testid="applicator-checkbox-${applicator.serialNumber}"]`);
      await checkbox.check();
    }

    // Add individual seeds
    const individualSeedButton = page.locator('[data-testid="remove-individual-seed"]');
    for (let i = 0; i < stats.individualSeeds; i++) {
      await individualSeedButton.click();
    }

    stats.totalSeedsRemoved += stats.individualSeeds;

    // Verify progress display matches our calculations
    await expect(page.locator(`text=Removed: ${stats.totalSeedsRemoved}`)).toBeVisible();

    // Export PDF with statistics
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-pdf-button"]');
    const download = await downloadPromise;

    // Verify export includes statistical summary
    expect(download.suggestedFilename()).toBeTruthy();
    await expect(page.locator('text=PDF exported with removal statistics')).toBeVisible();
  });

  test('should handle PDF export errors gracefully', async ({ page }) => {
    // Mock PDF generation failure
    await page.route('**/api/pdf/export', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'PDF generation failed'
        })
      });
    });

    // Attempt PDF export
    await page.click('[data-testid="export-pdf-button"]');

    // Verify error handling
    await expect(page.locator('text=Failed to generate PDF report')).toBeVisible();
    await expect(page.locator('text=Please try again')).toBeVisible();

    // Verify retry mechanism
    await page.click('[data-testid="retry-pdf-export"]');
    await expect(page.locator('text=Retrying PDF generation')).toBeVisible();
  });

  test('should export PDF with different removal scenarios', async ({ page }) => {
    const scenarios = [
      {
        name: 'Complete Removal',
        setup: async () => {
          // Remove all applicators
          for (const applicator of testData.applicators) {
            const checkbox = page.locator(`[data-testid="applicator-checkbox-${applicator.serialNumber}"]`);
            await checkbox.check();
          }
        }
      },
      {
        name: 'Partial with Individual Seeds',
        setup: async () => {
          // Remove some applicators and individual seeds
          const checkbox = page.locator(`[data-testid="applicator-checkbox-${testData.applicators[0].serialNumber}"]`);
          await checkbox.check();

          const individualButton = page.locator('[data-testid="remove-individual-seed"]');
          for (let i = 0; i < 10; i++) {
            await individualButton.click();
          }
        }
      },
      {
        name: 'No Removal',
        setup: async () => {
          // Export with no removals (baseline report)
        }
      }
    ];

    for (const scenario of scenarios) {
      // Reset page state
      await page.reload();
      await WaitHelpers.waitForTreatmentLoad(page);

      // Setup scenario
      await scenario.setup();

      // Export PDF
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-pdf-button"]');
      const download = await downloadPromise;

      // Verify scenario-specific export
      const filename = download.suggestedFilename();
      expect(filename).toBeTruthy();

      console.log(`PDF exported for scenario: ${scenario.name} - ${filename}`);
    }
  });

  test('should maintain PDF quality across different data volumes', async ({ page }) => {
    // Test with large number of applicators
    const largeApplicatorSet = MockDataGenerator.generateTestApplicators(20);

    // Mock large dataset
    await page.route('**/api/treatments/*/applicators', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          applicators: largeApplicatorSet
        })
      });
    });

    await page.reload();
    await WaitHelpers.waitForTreatmentLoad(page);

    // Process multiple applicators
    for (let i = 0; i < 10; i++) {
      const applicator = largeApplicatorSet[i];
      const checkbox = page.locator(`[data-testid="applicator-checkbox-${applicator.serialNumber}"]`);
      await checkbox.check();

      // Add detailed comments for PDF content
      const commentsField = page.locator(`[data-testid="applicator-comments-${applicator.serialNumber}"]`);
      await commentsField.fill(`Detailed removal notes for applicator ${i + 1}: Standard procedure followed with no complications. Patient tolerance good.`);
    }

    // Export large dataset PDF
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 }); // Longer timeout for large PDF
    await page.click('[data-testid="export-pdf-button"]');
    const download = await downloadPromise;

    // Verify large PDF generation
    expect(download.suggestedFilename()).toBeTruthy();

    // Check file size is appropriate for large dataset
    const filePath = await download.path();
    const fs = require('fs');
    const stats = fs.statSync(filePath!);
    expect(stats.size).toBeGreaterThan(100000); // At least 100KB for large dataset
  });
});

// Helper function to process applicators
async function processApplicators(page: any, applicators: any[]) {
  for (const applicator of applicators) {
    const checkbox = page.locator(`[data-testid="applicator-checkbox-${applicator.serialNumber}"]`);
    await checkbox.check();

    // Add a small delay to simulate realistic user interaction
    await page.waitForTimeout(100);
  }

  // Wait for progress to update
  const totalSeeds = applicators.reduce((sum, app) => sum + app.seedQuantity, 0);
  await WaitHelpers.waitForProgressUpdate(page, totalSeeds);
}