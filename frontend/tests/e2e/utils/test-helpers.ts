/**
 * Test Utilities and Helpers for E2E Tests
 * Provides reusable functions for common testing patterns
 */

import { Page, expect, Locator } from '@playwright/test';
import { format, addDays, subDays } from 'date-fns';

export interface TestApplicator {
  serialNumber: string;
  applicatorType: string;
  seedQuantity: number;
  usageType: 'full' | 'faulty' | 'none';
  insertedSeedsQty?: number;
  comments?: string;
  isRemoved?: boolean;
  removalComments?: string;
}

export interface TestTreatment {
  id: string;
  type: 'insertion' | 'removal';
  subjectId: string;
  patientName?: string;
  site: string;
  date: string;
  seedQuantity?: number;
  activityPerSeed?: number;
  surgeon?: string;
  daysSinceInsertion?: number;
}

export interface TestUser {
  email: string;
  verificationCode: string;
  sites: string[];
  positionCode?: string;
}

/**
 * Mock Data Generator
 * Creates realistic test data for different scenarios
 */
export class MockDataGenerator {
  static generateTestUser(overrides: Partial<TestUser> = {}): TestUser {
    return {
      email: 'test@example.com',
      verificationCode: '123456',
      sites: ['Test Hospital A', 'Test Hospital B', 'Test Medical Center'],
      positionCode: '99', // Full admin access
      ...overrides
    };
  }

  static generateTestTreatment(overrides: Partial<TestTreatment> = {}): TestTreatment {
    const yesterday = subDays(new Date(), 1);
    const patNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return {
      id: `TREAT-${Date.now()}`,
      type: 'removal',
      subjectId: `PAT-${patNum}`,
      patientName: `Patient Test-${patNum}`,
      site: 'Test Hospital A',
      date: format(yesterday, 'yyyy-MM-dd'),
      seedQuantity: 85,
      activityPerSeed: 1.5,
      surgeon: 'Dr. Test Surgeon',
      daysSinceInsertion: 1,
      ...overrides
    };
  }

  static generateTestApplicators(count: number = 3): TestApplicator[] {
    const applicators: TestApplicator[] = [];
    const types = ['Standard', 'Large', 'Small', 'XL'];
    const seedCounts = [10, 15, 20, 25, 30, 50];

    for (let i = 1; i <= count; i++) {
      applicators.push({
        serialNumber: `AP${i.toString().padStart(3, '0')}-A${i}`,
        applicatorType: types[Math.floor(Math.random() * types.length)],
        seedQuantity: seedCounts[Math.floor(Math.random() * seedCounts.length)],
        usageType: 'full',
        insertedSeedsQty: undefined,
        comments: '',
        isRemoved: false,
        removalComments: ''
      });
    }

    return applicators;
  }

  static generateRemovalScenario(): {
    treatment: TestTreatment;
    applicators: TestApplicator[];
    expectedProgress: {
      totalSeeds: number;
      initialRemoved: number;
      finalRemoved: number;
    };
  } {
    const applicators = this.generateTestApplicators(4);
    const totalSeeds = applicators.reduce((sum, app) => sum + app.seedQuantity, 0);

    return {
      treatment: this.generateTestTreatment({ seedQuantity: totalSeeds }),
      applicators,
      expectedProgress: {
        totalSeeds,
        initialRemoved: 0,
        finalRemoved: totalSeeds
      }
    };
  }
}

/**
 * API Mock Helper
 * Provides consistent API mocking patterns
 */
export class APIMockHelper {
  constructor(private page: Page) {}

  async mockSuccessfulAuthentication(user: TestUser = MockDataGenerator.generateTestUser()) {
    // Mock authentication request
    await this.page.route('**/api/auth/request-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            email: user.email,
            sites: user.sites,
            positionCode: user.positionCode
          }
        })
      });
    });

    // Mock verification
    await this.page.route('**/api/auth/verify', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'mock-jwt-token',
          user: {
            email: user.email,
            sites: user.sites,
            positionCode: user.positionCode
          }
        })
      });
    });
  }

  async mockTreatmentAPIs(treatment: TestTreatment, applicators: TestApplicator[]) {
    // Mock treatment creation
    await this.page.route('**/api/treatments', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            treatment
          })
        });
      }
    });

    // Mock applicator fetching
    await this.page.route(`**/api/treatments/${treatment.id}/applicators`, async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            applicators
          })
        });
      }
    });

    // Mock applicator updates
    await this.page.route(`**/api/treatments/${treatment.id}/applicators/*`, async route => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            applicator: { /* updated applicator data */ }
          })
        });
      }
    });

    // Mock treatment completion
    await this.page.route(`**/api/treatments/${treatment.id}/complete`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Treatment completed successfully'
        })
      });
    });
  }

  async mockPriorityAPI(applicators: TestApplicator[]) {
    // Mock Priority API applicator search
    await this.page.route('**/api/priority/applicators', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          applicators: applicators.map(app => ({
            serialNumber: app.serialNumber,
            applicatorType: app.applicatorType,
            seedQuantity: app.seedQuantity,
            patientId: 'TEST-PATIENT'
          }))
        })
      });
    });

    // Mock Priority API health check
    await this.page.route('**/api/priority/health', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          connected: true
        })
      });
    });
  }

  async mockAPIFailures() {
    // Mock various API failure scenarios
    await this.page.route('**/api/treatments/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Internal server error'
        })
      });
    });
  }
}

/**
 * Wait Helpers
 * Custom waiting functions for specific application states
 */
export class WaitHelpers {
  static async waitForTreatmentLoad(page: Page, treatmentId?: string) {
    // Wait for treatment data to load
    await page.waitForLoadState('networkidle');

    if (treatmentId) {
      await expect(page.locator(`[data-treatment-id="${treatmentId}"]`)).toBeVisible();
    }
  }

  static async waitForProgressUpdate(page: Page, expectedRemoved: number) {
    // Wait for progress display to update
    await expect(page.locator(`text=Removed: ${expectedRemoved}`)).toBeVisible({ timeout: 5000 });
  }

  static async waitForPDFDownload(page: Page): Promise<any> {
    // Wait for PDF download to start
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    return downloadPromise;
  }

  static async waitForApplicatorUpdate(page: Page, serialNumber: string) {
    // Wait for specific applicator to update
    await page.waitForFunction(
      (serial) => {
        const checkbox = document.querySelector(`[data-testid="applicator-checkbox-${serial}"]`) as HTMLInputElement;
        return checkbox && checkbox.checked;
      },
      serialNumber,
      { timeout: 5000 }
    );
  }
}

/**
 * Assertion Helpers
 * Custom assertions for domain-specific validations
 */
export class AssertionHelpers {
  static async assertProgressCalculation(page: Page, expectedRemoved: number, expectedTotal: number) {
    const expectedPercentage = Math.round((expectedRemoved / expectedTotal) * 100);

    await expect(page.locator(`text=Removed: ${expectedRemoved} / ${expectedTotal}`)).toBeVisible();

    // Check progress bar width (if implemented)
    const progressBar = page.locator('[data-testid="progress-bar-fill"]');
    if (await progressBar.count() > 0) {
      const width = await progressBar.getAttribute('style');
      expect(width).toContain(`width: ${expectedPercentage}%`);
    }
  }

  static async assertApplicatorState(page: Page, serialNumber: string, isRemoved: boolean) {
    const checkbox = page.locator(`[data-testid="applicator-checkbox-${serialNumber}"]`);

    if (isRemoved) {
      await expect(checkbox).toBeChecked();
      // Verify visual state changes (green background, etc.)
      const applicatorCard = page.locator(`[data-testid="applicator-card-${serialNumber}"]`);
      await expect(applicatorCard).toHaveClass(/removed|completed|success/);
    } else {
      await expect(checkbox).not.toBeChecked();
    }
  }

  static async assertTreatmentCompletion(page: Page) {
    // Verify treatment completion state
    await expect(page.locator('text=Treatment completed successfully')).toBeVisible();
    await expect(page).toHaveURL(/.*\/treatment\/select/);
  }

  static async assertPDFContent(download: any, expectedPatientId: string) {
    // Verify PDF file properties
    expect(download.suggestedFilename()).toMatch(new RegExp(`Treatment_Report_${expectedPatientId}_.*\\.pdf`));

    // Additional PDF content validation could be implemented here
    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    // Could use PDF parsing libraries to verify actual content
    // For now, we verify the file was created successfully
  }
}

/**
 * Keyboard and Interaction Helpers
 */
export class InteractionHelpers {
  static async simulateQuickKeyboardEntry(page: Page, applicatorSerials: string[]) {
    // Simulate rapid keyboard entry of multiple applicators
    for (const serial of applicatorSerials) {
      await page.keyboard.type(serial);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100); // Small delay between entries
    }
  }

  static async simulateMobileTouch(page: Page, selector: string) {
    // Simulate mobile touch interactions
    const element = page.locator(selector);
    await element.tap();
  }

  static async scrollToElement(page: Page, selector: string) {
    // Ensure element is in viewport before interaction
    const element = page.locator(selector);
    await element.scrollIntoViewIfNeeded();
  }
}

/**
 * Test Data Cleanup
 */
export class TestCleanup {
  static async cleanupTestData(page: Page, treatmentIds: string[]) {
    // Clean up test data after test completion
    for (const treatmentId of treatmentIds) {
      await page.route(`**/api/treatments/${treatmentId}`, route => {
        if (route.request().method() === 'DELETE') {
          route.fulfill({ status: 204 });
        }
      });
    }
  }
}

/**
 * Performance Measurement
 */
export class PerformanceHelper {
  static measureOperationTime<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    return new Promise(async (resolve) => {
      const startTime = Date.now();
      const result = await operation();
      const endTime = Date.now();
      const duration = endTime - startTime;

      resolve({ result, duration });
    });
  }

  static async measurePageLoadTime(page: Page): Promise<number> {
    const startTime = Date.now();
    await page.waitForLoadState('networkidle');
    return Date.now() - startTime;
  }
}