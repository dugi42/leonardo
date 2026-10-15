import { expect, test, type Download } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';

test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'desktop flow');

async function bytes(download: Download): Promise<Uint8Array> {
  return new Uint8Array(await readFile((await download.path())!));
}

test('explore, refine, print and download watertight files', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Explore' }).click();
  const tiles = page.getByRole('button', { name: /^Design \d+/ });
  await expect(tiles).toHaveCount(9);

  await page.getByRole('button', { name: 'Shuffle' }).click();
  await tiles.nth(2).click();
  await page.getByRole('button', { name: 'Variations' }).click();
  await expect(tiles.nth(4)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Refine this design' }).click();

  await expect(page.getByRole('img', { name: 'Spectrum' })).toBeVisible();
  const bulge = page.getByLabel('Bulge');
  await bulge.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');

  await page.getByRole('tab', { name: 'Print' }).click();
  await page.getByText('Hollow', { exact: true }).click();
  await expect(page.getByLabel('Wall')).toBeVisible();

  const [threeMf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /3MF/ }).click()]);
  expect(threeMf.suggestedFilename()).toMatch(/^leonardo-\d+-hollow\.3mf$/);
  const files = unzipSync(await bytes(threeMf));
  const model = strFromU8(files['3D/3dmodel.model']);
  expect(model).toContain('unit="millimeter"');
  expect(model.match(/<triangle /g)!.length).toBeGreaterThan(100_000);

  const [stl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'STL', exact: true }).click()]);
  const data = await bytes(stl);
  const faces = new DataView(data.buffer, data.byteOffset).getUint32(80, true);
  expect(data.byteLength).toBe(84 + 50 * faces);

  await expect(page.getByText(/downloaded/)).toBeVisible();
});

test('the address bar reproduces the design after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New design' }).click();
  await expect(page).toHaveURL(/#d=/);
  const seed = await page.locator('.seed').textContent();
  const url = page.url();
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.locator('.seed')).toHaveText(seed!);
});

test('history keeps saved designs', async ({ page }) => {
  await page.goto('/');
  const seed = (await page.locator('.seed').textContent())!.slice(1);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved to history')).toBeVisible();
  await page.getByRole('button', { name: 'New design' }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await page.getByRole('button', { name: `Open #${seed}` }).click();
  await expect(page.locator('.seed')).toHaveText(`#${seed}`);
});

test('switches the interface to German', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Deutsch' }).click();
  await expect(page.getByRole('tab', { name: 'Entdecken' })).toBeVisible();
});
