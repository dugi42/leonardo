import { expect, test } from '@playwright/test';

test('works on a phone', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'Spectrum' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/mobile-refine.png' });
  await page.getByRole('tab', { name: 'Explore' }).click();
  await expect(page.getByRole('button', { name: /^Design \d+/ })).toHaveCount(9);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/mobile-explore.png' });
});
