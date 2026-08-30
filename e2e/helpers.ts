import { expect, type Locator, type Page } from '@playwright/test';

export async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
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
  // Observe the save cycle triggered by the latest mutation. Checking only for
  // "saved" can accidentally accept the previous revision before React has
  // scheduled the 450 ms autosave debounce.
  await expect(workspace).toHaveAttribute('data-save-state', 'saving');
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
