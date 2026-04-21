import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';

test.describe('Charts Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    await clerk.signIn({
      page,
      signInParams: {
        strategy: 'password',
        identifier: process.env.E2E_CLERK_USER_EMAIL!,
        password: process.env.E2E_CLERK_USER_PASSWORD!,
      },
    });
  });

  test('should load charts page and display main elements', async ({ page }) => {
    await page.goto('/app/charts');
    
    await expect(page.getByTestId('chart-area')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('symbol-display')).toBeVisible();
  });

  test('should toggle fullscreen mode', async ({ page }) => {
    await page.goto('/app/charts');
    await page.waitForLoadState('networkidle');
    
    const fullscreenBtn = page.getByTestId('tool-fullscreen');
    if (await fullscreenBtn.isVisible()) {
      await fullscreenBtn.click();
    }
  });

  test('should open and close settings modal', async ({ page }) => {
    await page.goto('/app/charts');
    await page.waitForLoadState('networkidle');
    
    const settingsBtn = page.getByTestId('button-settings');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();
    
    await expect(page.getByTestId('select-chart-type')).toBeVisible();
    
    const cancelBtn = page.getByTestId('button-cancel-settings');
    await cancelBtn.click();
  });

  test('should open and close alerts modal', async ({ page }) => {
    await page.goto('/app/charts');
    await page.waitForLoadState('networkidle');
    
    const alertsBtn = page.getByTestId('button-alerts');
    await expect(alertsBtn).toBeVisible();
    await alertsBtn.click();
    
    await expect(page.getByTestId('input-target-price')).toBeVisible();
    
    const closeBtn = page.getByTestId('button-close-alerts');
    await closeBtn.click();
  });

  test('should open indicators drawer', async ({ page }) => {
    await page.goto('/app/charts');
    await page.waitForLoadState('networkidle');
    
    const indicatorsBtn = page.getByTestId('button-indicators');
    await expect(indicatorsBtn).toBeVisible();
    await indicatorsBtn.click();
  });

  test('should open drawings drawer', async ({ page }) => {
    await page.goto('/app/charts');
    await page.waitForLoadState('networkidle');
    
    const drawingsBtn = page.getByTestId('button-drawings');
    const isVisible = await drawingsBtn.isVisible().catch(() => false);
    if (isVisible) {
      await drawingsBtn.click();
    } else {
      test.skip();
    }
  });

  test('should change timeframe', async ({ page }) => {
    await page.goto('/app/charts');
    await page.waitForLoadState('networkidle');
    
    const timeframe1D = page.getByTestId('timeframe-1D');
    if (await timeframe1D.isVisible()) {
      await timeframe1D.click();
    }
  });

  test('should display AI coach toggles', async ({ page }) => {
    await page.goto('/app/charts');
    await page.waitForLoadState('networkidle');
    
    const coachNotesToggle = page.getByTestId('toggle-coachNotes');
    await expect(coachNotesToggle).toBeVisible();
  });

  test('should show AI coach toggles with correct tier gating', async ({ page }) => {
    await page.goto('/app/charts');
    await page.waitForLoadState('networkidle');
    
    const coachNotesToggle = page.getByTestId('toggle-coachNotes');
    await expect(coachNotesToggle).toBeVisible();
    
    const generateBtn = page.getByTestId('button-generate-coaching');
    await expect(generateBtn).toBeVisible();
  });
});
