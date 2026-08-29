import { expect, test } from '@playwright/test';
import { canvasNode, openEditor } from './helpers';

test('canvas selection, hand mode, zoom controls, dragging, and pane deselection stay coherent', async ({ page }) => {
  await openEditor(page);
  const viewport = page.locator('.react-flow__viewport');
  const selectTool = page.getByRole('button', { name: 'Select tool, V' });
  const handTool = page.getByRole('button', { name: 'Hand tool, H' });
  const initialViewport = await viewport.getAttribute('style');

  await page.keyboard.press('h');
  await expect(handTool).toHaveAttribute('aria-pressed', 'true');
  const pane = page.locator('.react-flow__pane');
  const paneBox = await pane.boundingBox();
  expect(paneBox).toBeTruthy();
  const panStart = { x: paneBox!.x + 90, y: paneBox!.y + 145 };
  await page.mouse.move(panStart.x, panStart.y);
  await page.mouse.down();
  await page.mouse.move(panStart.x + 80, panStart.y + 35, { steps: 8 });
  await page.mouse.up();
  expect(await viewport.getAttribute('style')).not.toBe(initialViewport);

  await page.keyboard.press('v');
  await expect(selectTool).toHaveAttribute('aria-pressed', 'true');
  const beforeZoom = await viewport.getAttribute('style');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  expect(await viewport.getAttribute('style')).not.toBe(beforeZoom);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Fit view' }).click();
  await expect(page.getByLabel('Diagram overview')).toBeVisible();

  const research = canvasNode(page, 'Research');
  await research.click();
  await expect(research).toHaveClass(/selected/);
  await pane.click({ position: { x: 25, y: 25 } });
  await expect(research).not.toHaveClass(/selected/);

  await research.click();
  const beforeDrag = await research.boundingBox();
  await research.hover();
  await page.mouse.down();
  await page.mouse.move(beforeDrag!.x + beforeDrag!.width / 2 + 45, beforeDrag!.y + beforeDrag!.height / 2 + 20, { steps: 8 });
  await page.mouse.up();
  const afterDrag = await research.boundingBox();
  expect(Math.abs(afterDrag!.x - beforeDrag!.x)).toBeGreaterThan(20);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const restored = await research.boundingBox();
  expect(Math.abs(restored!.x - beforeDrag!.x)).toBeLessThan(2);
});
