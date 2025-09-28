const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testLoginBypass() {
  console.log('🎭 Starting Playwright login bypass test...');
  
  // Create screenshots directory
  const screenshotsDir = path.join(__dirname, 'test-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }

  const browser = await chromium.launch({ 
    headless: false, // Keep visible for debugging
    slowMo: 1000 // Slow down for observation
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Capture console messages and network requests
  const consoleMessages = [];
  const networkRequests = [];
  const networkResponses = [];
  
  page.on('console', msg => {
    const message = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(message);
    console.log('🖥️  Console:', message);
  });
  
  page.on('request', request => {
    networkRequests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers()
    });
    console.log('📤 Request:', request.method(), request.url());
  });
  
  page.on('response', response => {
    networkResponses.push({
      url: response.url(),
      status: response.status(),
      statusText: response.statusText()
    });
    console.log('📥 Response:', response.status(), response.url());
  });

  try {
    console.log('🌐 Navigating to production login page...');
    await page.goto('http://20.217.84.100:3000/login', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Take initial screenshot
    await page.screenshot({ path: path.join(screenshotsDir, '01-login-page-loaded.png') });
    console.log('📸 Screenshot saved: 01-login-page-loaded.png');
    
    // Wait for page to be fully loaded
    await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
    console.log('✅ Login page loaded successfully');
    
    // Check if email tab is selected (should be by default)
    const emailTab = page.locator('button:has-text("Email")');
    const isEmailSelected = await emailTab.evaluate(el => el.classList.contains('bg-primary'));
    console.log('📧 Email tab selected:', isEmailSelected);
    
    if (!isEmailSelected) {
      await emailTab.click();
      console.log('🔄 Clicked email tab');
      await page.screenshot({ path: path.join(screenshotsDir, '02-email-tab-selected.png') });
    }
    
    // Enter the test email address
    console.log('⌨️  Entering email: alexs@alphatau.com');
    await page.fill('input[name="identifier"]', 'alexs@alphatau.com');
    await page.screenshot({ path: path.join(screenshotsDir, '03-email-entered.png') });
    
    // Click the submit button
    console.log('🔘 Clicking "Send Verification Code" button...');
    const submitButton = page.locator('button[type="submit"]');
    
    // Check if button is enabled
    const isButtonEnabled = await submitButton.isEnabled();
    console.log('🔘 Submit button enabled:', isButtonEnabled);
    
    await submitButton.click();
    console.log('✅ Submit button clicked');
    
    // Wait for response (either success or error)
    await page.waitForTimeout(3000); // Give time for API call
    
    // Take screenshot after clicking submit
    await page.screenshot({ path: path.join(screenshotsDir, '04-after-submit-click.png') });
    
    // Check for success message
    const successMessage = await page.locator('.bg-green-50').textContent().catch(() => null);
    if (successMessage) {
      console.log('✅ Success message found:', successMessage.trim());
    }
    
    // Check for error message
    const errorMessage = await page.locator('.bg-red-50').textContent().catch(() => null);
    if (errorMessage) {
      console.log('❌ Error message found:', errorMessage.trim());
      await page.screenshot({ path: path.join(screenshotsDir, '05-error-state.png') });
    }
    
    // Check for loading state
    const isLoading = await page.locator('button:has-text("Validating Email...")').isVisible().catch(() => false);
    if (isLoading) {
      console.log('⏳ Loading state detected');
      await page.screenshot({ path: path.join(screenshotsDir, '06-loading-state.png') });
      
      // Wait for loading to complete
      await page.waitForSelector('button:has-text("Validating Email...")', { state: 'hidden', timeout: 30000 });
      console.log('✅ Loading completed');
      
      // Take screenshot after loading completes
      await page.screenshot({ path: path.join(screenshotsDir, '07-after-loading.png') });
    }
    
    // Check final state
    const finalSuccessMessage = await page.locator('.bg-green-50').textContent().catch(() => null);
    const finalErrorMessage = await page.locator('.bg-red-50').textContent().catch(() => null);
    
    if (finalSuccessMessage) {
      console.log('🎉 Final success message:', finalSuccessMessage.trim());
    }
    
    if (finalErrorMessage) {
      console.log('🚨 Final error message:', finalErrorMessage.trim());
    }
    
    // Check if we navigated to verification page
    const currentUrl = page.url();
    console.log('🌍 Current URL:', currentUrl);
    
    if (currentUrl.includes('/verify')) {
      console.log('✅ Successfully navigated to verification page');
      await page.screenshot({ path: path.join(screenshotsDir, '08-verification-page.png') });
    }
    
    // Wait a bit more to capture any final state changes
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotsDir, '09-final-state.png') });
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ path: path.join(screenshotsDir, 'ERROR-state.png') });
  } finally {
    // Generate test report
    const report = {
      timestamp: new Date().toISOString(),
      testEmail: 'alexs@alphatau.com',
      finalUrl: page.url(),
      consoleMessages: consoleMessages,
      networkRequests: networkRequests.filter(req => req.url.includes('api') || req.url.includes('priority')),
      networkResponses: networkResponses.filter(resp => resp.url.includes('api') || resp.url.includes('priority')),
      screenshots: fs.readdirSync(screenshotsDir).filter(file => file.endsWith('.png'))
    };
    
    fs.writeFileSync(
      path.join(screenshotsDir, 'test-report.json'), 
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    console.log('Final URL:', page.url());
    console.log('Console messages:', consoleMessages.length);
    console.log('Network requests:', networkRequests.length);
    console.log('Screenshots saved:', report.screenshots.length);
    console.log('Report saved to: test-screenshots/test-report.json');
    
    await browser.close();
    console.log('🎭 Playwright test completed');
  }
}

// Run the test
testLoginBypass().catch(console.error);