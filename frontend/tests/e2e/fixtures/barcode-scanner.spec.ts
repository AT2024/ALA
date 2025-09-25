import { test, expect } from '@playwright/test';
import { MockDataGenerator, APIMockHelper, WaitHelpers } from '../utils/test-helpers';

/**
 * Barcode Scanner Simulation Tests
 * Tests the barcode scanning functionality and manual entry modes
 */

test.describe('Barcode Scanner Functionality', () => {
  let mockHelper: APIMockHelper;
  const testData = MockDataGenerator.generateRemovalScenario();

  test.beforeEach(async ({ page }) => {
    mockHelper = new APIMockHelper(page);

    // Setup mocks
    await mockHelper.mockSuccessfulAuthentication();
    await mockHelper.mockTreatmentAPIs(testData.treatment, testData.applicators);
    await mockHelper.mockPriorityAPI(testData.applicators);

    // Navigate to treatment page
    await page.goto('/treatment/seed-removal');
    await WaitHelpers.waitForTreatmentLoad(page, testData.treatment.id);
  });

  test('should simulate barcode scanning successfully', async ({ page }) => {
    // Verify scanner is active by default
    await expect(page.locator('[data-testid="qr-reader"]')).toBeVisible();
    await expect(page.locator('text=Position the barcode inside the scan area')).toBeVisible();

    // Simulate successful barcode scan
    const testApplicator = testData.applicators[0];

    // Mock the scanner's success callback
    await page.evaluate((serialNumber) => {
      // Simulate the Html5QrcodeScanner success callback
      const scannerDiv = document.getElementById('qr-reader');
      if (scannerDiv) {
        // Trigger the same event flow as real scanner
        window.dispatchEvent(new CustomEvent('barcode-scanned', {
          detail: {
            decodedText: serialNumber,
            result: {
              text: serialNumber,
              format: 'CODE_128'
            }
          }
        }));
      }
    }, testApplicator.serialNumber);

    // Verify applicator data is filled in form
    await expect(page.locator('[data-testid="applicator-serial"]')).toHaveValue(testApplicator.serialNumber);
    await expect(page.locator('[data-testid="applicator-type"]')).toHaveValue(testApplicator.applicatorType);
    await expect(page.locator('[data-testid="seed-quantity"]')).toHaveValue(testApplicator.seedQuantity.toString());

    // Verify success message
    await expect(page.locator('text=Applicator validated successfully')).toBeVisible();
  });

  test('should handle scanner initialization errors gracefully', async ({ page }) => {
    // Mock scanner initialization failure
    await page.addInitScript(() => {
      // Override Html5QrcodeScanner to simulate camera access failure
      window.Html5QrcodeScanner = class {
        constructor() {}
        render(successCallback: any, errorCallback: any) {
          // Simulate camera permission denied
          setTimeout(() => {
            errorCallback({
              type: 'CAMERA_PERMISSION_DENIED',
              message: 'Camera permission denied'
            });
          }, 100);
        }
        clear() {}
      };
    });

    await page.reload();

    // Verify error handling
    await expect(page.locator('text=Camera permission denied')).toBeVisible();
    await expect(page.locator('[data-testid="manual-entry-fallback"]')).toBeVisible();
  });

  test('should support multiple barcode formats', async ({ page }) => {
    const barcodeFormats = [
      { format: 'QR_CODE', text: testData.applicators[0].serialNumber },
      { format: 'CODE_128', text: testData.applicators[1].serialNumber },
      { format: 'CODE_39', text: testData.applicators[2].serialNumber }
    ];

    for (const barcode of barcodeFormats) {
      // Simulate scanning different barcode formats
      await page.evaluate((data) => {
        window.dispatchEvent(new CustomEvent('barcode-scanned', {
          detail: {
            decodedText: data.text,
            result: {
              text: data.text,
              format: data.format
            }
          }
        }));
      }, barcode);

      // Verify each format is processed correctly
      await expect(page.locator('[data-testid="applicator-serial"]')).toHaveValue(barcode.text);

      // Process the applicator
      await page.click('[data-testid="process-applicator-button"]');

      // Wait for processing to complete before next scan
      await expect(page.locator('text=Applicator processed successfully')).toBeVisible();
    }
  });

  test('should toggle between scanner and manual entry modes', async ({ page }) => {
    // Start in scanner mode
    await expect(page.locator('[data-testid="qr-reader"]')).toBeVisible();
    await expect(page.locator('[data-testid="manual-entry-form"]')).not.toBeVisible();

    // Switch to manual entry
    await page.click('[data-testid="toggle-entry-mode"]');

    // Verify mode switch
    await expect(page.locator('[data-testid="qr-reader"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="manual-entry-form"]')).toBeVisible();
    await expect(page.locator('text=Enter Manually')).toBeVisible();

    // Switch back to scanner
    await page.click('[data-testid="toggle-entry-mode"]');

    // Verify scanner is active again
    await expect(page.locator('[data-testid="qr-reader"]')).toBeVisible();
    await expect(page.locator('[data-testid="manual-entry-form"]')).not.toBeVisible();
    await expect(page.locator('text=Switch to Scanner')).toBeVisible();
  });

  test('should handle invalid barcode scanning', async ({ page }) => {
    // Simulate scanning invalid/malformed barcode
    const invalidBarcodes = [
      '', // Empty string
      'INVALID-FORMAT-123', // Invalid format
      '   ', // Whitespace only
      testData.applicators[0].serialNumber.repeat(10) // Too long
    ];

    for (const invalidBarcode of invalidBarcodes) {
      await page.evaluate((serial) => {
        window.dispatchEvent(new CustomEvent('barcode-scanned', {
          detail: {
            decodedText: serial,
            result: { text: serial, format: 'UNKNOWN' }
          }
        }));
      }, invalidBarcode);

      // Verify appropriate error handling
      if (invalidBarcode.trim() === '') {
        await expect(page.locator('text=Invalid barcode: empty or whitespace')).toBeVisible();
      } else if (invalidBarcode.length > 50) {
        await expect(page.locator('text=Barcode too long')).toBeVisible();
      } else {
        await expect(page.locator('text=Applicator not found')).toBeVisible();
      }
    }
  });

  test('should handle rapid successive scans', async ({ page }) => {
    // Simulate rapid scanning (users accidentally scanning multiple times)
    const testApplicator = testData.applicators[0];

    // Rapidly trigger the same barcode scan 3 times
    for (let i = 0; i < 3; i++) {
      await page.evaluate((serialNumber) => {
        window.dispatchEvent(new CustomEvent('barcode-scanned', {
          detail: {
            decodedText: serialNumber,
            result: { text: serialNumber, format: 'CODE_128' }
          }
        }));
      }, testApplicator.serialNumber);

      // Small delay to simulate rapid scanning
      await page.waitForTimeout(50);
    }

    // Verify only one applicator is processed (debouncing)
    await expect(page.locator('[data-testid="applicator-serial"]')).toHaveValue(testApplicator.serialNumber);

    // Should not show multiple processing messages
    const processingMessages = await page.locator('text=Processing applicator').count();
    expect(processingMessages).toBeLessThanOrEqual(1);
  });

  test('should maintain scanner state during validation', async ({ page }) => {
    const testApplicator = testData.applicators[0];

    // Simulate barcode scan
    await page.evaluate((serialNumber) => {
      window.dispatchEvent(new CustomEvent('barcode-scanned', {
        detail: {
          decodedText: serialNumber,
          result: { text: serialNumber, format: 'CODE_128' }
        }
      }));
    }, testApplicator.serialNumber);

    // Verify scanner shows loading state during validation
    await expect(page.locator('text=Validating applicator')).toBeVisible();
    await expect(page.locator('[data-testid="scanner-loading"]')).toBeVisible();

    // Wait for validation to complete
    await expect(page.locator('text=Applicator validated successfully')).toBeVisible();

    // Verify scanner returns to ready state
    await expect(page.locator('[data-testid="scanner-loading"]')).not.toBeVisible();
    await expect(page.locator('text=Position the barcode inside the scan area')).toBeVisible();
  });

  test('should support barcode scanning workflow integration', async ({ page }) => {
    // Complete end-to-end workflow starting with barcode scanning
    let processedCount = 0;

    for (const applicator of testData.applicators) {
      // Scan barcode
      await page.evaluate((serialNumber) => {
        window.dispatchEvent(new CustomEvent('barcode-scanned', {
          detail: {
            decodedText: serialNumber,
            result: { text: serialNumber, format: 'CODE_128' }
          }
        }));
      }, applicator.serialNumber);

      // Verify applicator details are filled
      await expect(page.locator('[data-testid="applicator-serial"]')).toHaveValue(applicator.serialNumber);

      // Set usage type
      await page.selectOption('[data-testid="usage-type-select"]', 'Full use');

      // Add removal comment
      await page.fill('[data-testid="removal-comments"]', `Removed via barcode scan - ${applicator.serialNumber}`);

      // Mark as removed
      await page.check('[data-testid="mark-removed-checkbox"]');

      // Process applicator
      await page.click('[data-testid="process-applicator-button"]');

      processedCount++;

      // Verify progress update
      await WaitHelpers.waitForProgressUpdate(page, processedCount * applicator.seedQuantity);
    }

    // Verify complete workflow
    const totalSeeds = testData.applicators.reduce((sum, app) => sum + app.seedQuantity, 0);
    await expect(page.locator(`text=Removed: ${totalSeeds} / ${totalSeeds}`)).toBeVisible();
    await expect(page.locator('[data-testid="complete-treatment-button"]')).toBeEnabled();
  });

  test('should handle camera focus and blur events', async ({ page }) => {
    // Mock camera focus/blur events that occur when user switches tabs or minimizes window
    await page.evaluate(() => {
      // Simulate losing camera focus
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true
      });
    });

    // Verify scanner handles focus loss gracefully
    await expect(page.locator('text=Scanner paused')).toBeVisible();

    // Simulate regaining focus
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Verify scanner resumes
    await expect(page.locator('text=Position the barcode inside the scan area')).toBeVisible();
  });
});

test.describe('Manual Entry Mode', () => {
  let mockHelper: APIMockHelper;
  const testData = MockDataGenerator.generateRemovalScenario();

  test.beforeEach(async ({ page }) => {
    mockHelper = new APIMockHelper(page);

    await mockHelper.mockSuccessfulAuthentication();
    await mockHelper.mockTreatmentAPIs(testData.treatment, testData.applicators);
    await mockHelper.mockPriorityAPI(testData.applicators);

    await page.goto('/treatment/seed-removal');
    await WaitHelpers.waitForTreatmentLoad(page, testData.treatment.id);

    // Switch to manual entry mode
    await page.click('[data-testid="toggle-entry-mode"]');
    await expect(page.locator('[data-testid="manual-entry-form"]')).toBeVisible();
  });

  test('should validate manual entry with fuzzy matching', async ({ page }) => {
    const testApplicator = testData.applicators[0];

    // Test fuzzy matching with slight variations
    const variations = [
      testApplicator.serialNumber.toLowerCase(),
      testApplicator.serialNumber.replace('-', ''),
      testApplicator.serialNumber + ' ', // Extra whitespace
      testApplicator.serialNumber.substring(0, testApplicator.serialNumber.length - 1) // Missing last character
    ];

    for (const variation of variations) {
      await page.fill('[data-testid="manual-serial-input"]', variation);
      await page.click('[data-testid="validate-serial-button"]');

      if (variation === testApplicator.serialNumber.substring(0, testApplicator.serialNumber.length - 1)) {
        // Should show suggestions for partial match
        await expect(page.locator('text=Did you mean:')).toBeVisible();
        await expect(page.locator(`text=${testApplicator.serialNumber}`)).toBeVisible();
      } else {
        // Should find exact or fuzzy match
        await expect(page.locator('text=Applicator validated successfully')).toBeVisible();
      }

      // Clear form for next iteration
      await page.fill('[data-testid="manual-serial-input"]', '');
    }
  });

  test('should show applicator suggestions list', async ({ page }) => {
    // Click "Choose from List" button
    await page.click('[data-testid="choose-from-list-button"]');

    // Verify applicator list is displayed
    await expect(page.locator('[data-testid="applicator-list"]')).toBeVisible();

    // Verify all test applicators are listed
    for (const applicator of testData.applicators) {
      await expect(page.locator(`text=${applicator.serialNumber}`)).toBeVisible();
      await expect(page.locator(`text=${applicator.seedQuantity} seeds`)).toBeVisible();
    }

    // Test A-suffix filtering
    await page.fill('[data-testid="a-suffix-filter"]', '1');
    await expect(page.locator('text=ending with "-A1"')).toBeVisible();

    // Clear filter
    await page.click('[data-testid="clear-filter-button"]');

    // Select an applicator from list
    await page.click(`[data-testid="select-applicator-${testData.applicators[0].serialNumber}"]`);

    // Verify applicator details are filled
    await expect(page.locator('[data-testid="applicator-serial"]')).toHaveValue(testData.applicators[0].serialNumber);
  });

  test('should handle keyboard shortcuts in manual mode', async ({ page }) => {
    const testApplicator = testData.applicators[0];

    // Focus on serial number input
    await page.focus('[data-testid="manual-serial-input"]');

    // Type serial number
    await page.keyboard.type(testApplicator.serialNumber);

    // Press Enter to validate (keyboard shortcut)
    await page.keyboard.press('Enter');

    // Verify validation triggered
    await expect(page.locator('text=Validating applicator')).toBeVisible();
    await expect(page.locator('[data-testid="applicator-serial"]')).toHaveValue(testApplicator.serialNumber);

    // Use Tab to navigate through form fields
    await page.keyboard.press('Tab'); // Move to usage type
    await page.keyboard.press('ArrowDown'); // Select usage type
    await page.keyboard.press('Tab'); // Move to comments
    await page.keyboard.type('Keyboard entry test');

    // Use keyboard shortcut to submit
    await page.keyboard.press('Control+Enter');

    // Verify processing
    await expect(page.locator('text=Applicator processed successfully')).toBeVisible();
  });
});