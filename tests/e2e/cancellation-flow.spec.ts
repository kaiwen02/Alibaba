import { test, expect } from '@playwright/test';

test.describe('Cancellation to Ticketed Flow', () => {
  test('should complete full disruption and recovery cycle', async ({ page }) => {
    // Step 1: Login
    await page.goto('/');
    
    // Wait for login form to appear
    await page.waitForSelector('input[type="email"]');
    
    // Fill in credentials (pre-filled in demo mode)
    await page.fill('input[type="email"]', 'demo@pathfinder.dev');
    await page.fill('input[type="password"]', 'demo123');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Step 2: Wait for dashboard
    await page.waitForURL('**/dashboard');
    await page.waitForSelector('text=My Bookings');
    
    // Verify bookings are displayed
    const bookings = page.locator('text=PNR:');
    await expect(bookings.first()).toBeVisible();

    // Step 3: Navigate to admin panel
    await page.click('text=Admin');
    await page.waitForURL('**/admin');
    
    // Step 4: Select first booking
    await page.waitForSelector('select');
    await page.selectOption('select', { index: 1 });
    
    // Step 5: Trigger webhook (this will also trigger prediction)
    await page.click('text=Send Webhook Event');
    
    // Wait for webhook to process
    await page.waitForTimeout(2000);
    
    // Step 6: Check activity log for success
    const activityLog = page.locator('.bg-gray-900').first();
    await expect(activityLog).toContainText('Webhook sent');
    
    // Step 7: Navigate back to dashboard
    await page.click('a[href="/dashboard"]');
    await page.waitForURL('**/dashboard');
    
    // Step 8: Check for disrupted booking with review button
    await page.waitForTimeout(1000);
    const reviewButton = page.locator('text=Review Options');
    
    if (await reviewButton.count() > 0) {
      // Click the review button
      await reviewButton.first().click();
      
      // Step 9: Wait for recovery page
      await page.waitForURL('**/recovery/**');
      
      // Step 10: Verify packages are displayed
      await page.waitForSelector('text=Choose Your Alternative');
      
      // Step 11: Select a package (click first one)
      const packages = page.locator('.cursor-pointer').filter({ hasText: 'Fastest' }).first();
      await packages.click();
      
      // Step 12: Confirm and rebook
      await page.click('text=Confirm & Rebook');
      
      // Step 13: Wait for success message
      await page.waitForSelector('text=Rebooking Successful', { timeout: 30000 });
      
      // Verify success state
      await expect(page.locator('text=Rebooking Successful')).toBeVisible();
    }
  });

  test('should show notification after disruption', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.waitForSelector('input[type="email"]');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Go to admin and trigger disruption
    await page.click('text=Admin');
    await page.waitForURL('**/admin');
    await page.waitForSelector('select');
    await page.selectOption('select', { index: 1 });
    await page.click('text=Send Webhook Event');
    await page.waitForTimeout(2000);
    
    // Go back to dashboard
    await page.click('a[href="/dashboard"]');
    await page.waitForURL('**/dashboard');
    await page.waitForTimeout(1000);
    
    // Check notification bell
    const bellButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await bellButton.click();
    
    // Notification dropdown should be visible
    await expect(page.locator('text=Notifications')).toBeVisible();
  });
});
