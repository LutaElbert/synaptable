import { expect, type Locator, type Page } from '@playwright/test';

export async function openEditor(page: Page) {
  await page.goto('/');
  // The first request can include a cold Vinext compile on CI. Give the app
  // time to hydrate before asserting the already-rendered document shape.
  await expect(page.locator('main[data-ready="true"]')).toBeVisible({ timeout: 20_000 });
  const onboarding = page.getByRole('dialog', { name: 'Move ideas between canvas and table' });
  await onboarding.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined);
  if (await onboarding.isVisible()) {
    await onboarding.getByRole('button', { name: 'Got it' }).click();
    await expect(onboarding).not.toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  }
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  // React Flow measures node handles before it can paint edges. Cold WebKit
  // workers can finish document hydration several seconds before that pass.
  await expect(page.locator('.react-flow__edge')).toHaveCount(2, { timeout: 15_000 });
}

export async function addDefaultTable(page: Page) {
  await page.getByRole('button', { name: 'Add table layer' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a table size' })).toBeVisible();
  await page.getByRole('button', { name: '3 rows by 3 columns' }).click();
}

export function canvasNode(page: Page, name: string): Locator {
  return page.locator('.react-flow__node').filter({ hasText: name }).first();
}

export async function connectLayers(page: Page, sourceName: string, targetName: string) {
  const sourceHandle = canvasNode(page, sourceName).locator('.react-flow__handle.source').first();
  const targetHandle = canvasNode(page, targetName).locator('.react-flow__handle.target').first();
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  expect(sourceBox).toBeTruthy();
  expect(targetBox).toBeTruthy();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 10 },
  );
  await page.mouse.up();
}

export async function waitForSaved(page: Page) {
  const workspace = page.locator('main[data-ready="true"]');
  // Let React flush the mutation and autosave scheduling work. The save can
  // already be complete for large renders, so "saving" is not a required
  // intermediate assertion; callers reload to verify persistence.
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(workspace).toHaveAttribute('data-save-state', 'saved');
}

export async function createDiagramPng(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate<number[]>(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 160;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#1f2937';
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(75, 80);
    context.lineTo(165, 80);
    context.stroke();
    context.fillStyle = '#635bff';
    context.fillRect(20, 45, 70, 70);
    context.fillStyle = '#22a06b';
    context.beginPath();
    context.arc(190, 80, 35, 0, Math.PI * 2);
    context.fill();
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG encoding failed.')), 'image/png');
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  return Buffer.from(bytes);
}
