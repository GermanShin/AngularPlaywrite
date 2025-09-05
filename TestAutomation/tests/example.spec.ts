import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    // await page.goto('https://playwright.dev/');

    // // This will fail and trigger video recording
    // await expect(page).toHaveTitle(/Playwright/);
    await page.goto('https://example.com');

    // This will fail and trigger video recording
    await expect(page.locator('#non-existent-element')).toBeVisible();
});

test('get started link', async ({ page }) => {
    await page.goto('https://playwright.dev/');

    // Click the get started link.
    await page.getByRole('link', { name: 'Get started' }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(
        page.getByRole('heading', { name: 'Installation' })
    ).toBeVisible();
});
