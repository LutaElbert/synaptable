import { expect, test } from '@playwright/test';
import { canvasNode, openEditor } from './helpers';

async function dragBox(
  page: import('@playwright/test').Page,
  bounds: { x: number; y: number; width: number; height: number },
) {
  await page.mouse.move(bounds.x, bounds.y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width, bounds.y + bounds.height, { steps: 12 });
  await page.mouse.up();
}

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

test('select all, marquee modifiers, escape, and layer ranges stay synchronized', async ({ page }) => {
  await openEditor(page);
  const layerButton = (name: string) => page.getByRole('button', { name, exact: true });
  const research = canvasNode(page, 'Research');
  const explore = canvasNode(page, 'Explore tools');
  const editable = canvasNode(page, 'Editable layers');

  await page.waitForTimeout(550);
  await expect(page.locator('main[data-save-state="saved"]')).toBeVisible();
  await page.keyboard.press('Meta+a');
  await page.waitForTimeout(550);
  await expect(page.locator('main[data-save-state="saved"]')).toBeVisible();
  await expect(page.locator('.inspector-panel').getByText('3 layers selected', { exact: true }).first()).toBeVisible();
  await expect(layerButton('Research')).toHaveAttribute('aria-pressed', 'true');
  await expect(layerButton('Explore tools')).toHaveAttribute('aria-pressed', 'true');
  await expect(layerButton('Editable layers')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(3);
  const keyboardGroupActions = page.getByRole('group', { name: '3 selected layer actions' });
  await expect(keyboardGroupActions).toBeVisible();
  await expect(page.locator('.node-actionbar')).toHaveCount(0);
  await expect(page.locator('.react-flow__resize-control')).toHaveCount(0);
  await expect(page.locator('.react-flow__node.selected .react-flow__handle').first()).toHaveCSS('opacity', '0');
  await expect(page.locator('.react-flow__node.selected .react-flow__handle').first()).toHaveCSS('pointer-events', 'none');
  await expect(keyboardGroupActions.getByRole('button', { name: 'Align selected layers left' })).toBeEnabled();
  await expect(keyboardGroupActions.getByRole('button', { name: 'Distribute selected layers horizontally' })).toBeEnabled();

  await page.keyboard.press('Escape');
  await expect(keyboardGroupActions).toBeHidden();
  await expect(research).not.toHaveClass(/selected/);
  await expect(explore).not.toHaveClass(/selected/);
  await expect(editable).not.toHaveClass(/selected/);

  const exploreBox = await explore.boundingBox();
  const editableBox = await editable.boundingBox();
  expect(exploreBox).toBeTruthy();
  expect(editableBox).toBeTruthy();
  const right = Math.max(exploreBox!.x + exploreBox!.width, editableBox!.x + editableBox!.width);
  const bottom = Math.max(exploreBox!.y + exploreBox!.height, editableBox!.y + editableBox!.height);
  await dragBox(page, {
    x: Math.min(exploreBox!.x, editableBox!.x) - 14,
    y: Math.min(exploreBox!.y, editableBox!.y) - 14,
    width: right - Math.min(exploreBox!.x, editableBox!.x) + 28,
    height: bottom - Math.min(exploreBox!.y, editableBox!.y) + 28,
  });
  await expect(explore).toHaveClass(/selected/);
  await expect(editable).toHaveClass(/selected/);
  await expect(research).not.toHaveClass(/selected/);
  const groupSelection = page.locator('.react-flow__nodesselection-rect');
  await expect(groupSelection).toBeVisible();
  await expect(groupSelection).toHaveCSS('border-top-width', '0px');
  await expect(groupSelection).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);
  const marqueeGroupActions = page.getByRole('group', { name: '2 selected layer actions' });
  await expect(marqueeGroupActions).toBeVisible();
  await expect(marqueeGroupActions.getByRole('button', { name: 'Distribute selected layers horizontally' })).toBeDisabled();
  const groupBox = await groupSelection.boundingBox();
  const exploreBeforeGroupDrag = await explore.boundingBox();
  const editableBeforeGroupDrag = await editable.boundingBox();
  expect(groupBox).toBeTruthy();
  await page.mouse.move(groupBox!.x + groupBox!.width / 2, groupBox!.y + groupBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(groupBox!.x + groupBox!.width / 2 + 32, groupBox!.y + groupBox!.height / 2 + 18, { steps: 8 });
  await page.mouse.up();
  const exploreAfterGroupDrag = await explore.boundingBox();
  const editableAfterGroupDrag = await editable.boundingBox();
  expect(Math.abs(exploreAfterGroupDrag!.x - exploreBeforeGroupDrag!.x)).toBeGreaterThan(20);
  expect(Math.abs(editableAfterGroupDrag!.x - editableBeforeGroupDrag!.x)).toBeGreaterThan(20);

  const researchBox = await research.boundingBox();
  expect(researchBox).toBeTruthy();
  await page.keyboard.down('Shift');
  await dragBox(page, {
    x: researchBox!.x - 12,
    y: researchBox!.y - 12,
    width: researchBox!.width + 24,
    height: researchBox!.height + 24,
  });
  await page.keyboard.up('Shift');
  await expect(page.locator('.inspector-panel').getByText('3 layers selected', { exact: true }).first()).toBeVisible();

  const currentExploreBox = await explore.boundingBox();
  expect(currentExploreBox).toBeTruthy();
  await page.keyboard.down('Alt');
  await dragBox(page, {
    x: currentExploreBox!.x - 12,
    y: currentExploreBox!.y - 12,
    width: currentExploreBox!.width + 24,
    height: currentExploreBox!.height + 24,
  });
  await page.keyboard.up('Alt');
  await expect(explore).not.toHaveClass(/selected/);
  await expect(research).toHaveClass(/selected/);
  await expect(editable).toHaveClass(/selected/);

  await layerButton('Editable layers').click();
  await layerButton('Research').click({ modifiers: ['Shift'] });
  await expect(page.locator('.inspector-panel').getByText('3 layers selected', { exact: true }).first()).toBeVisible();
  await layerButton('Explore tools').click({ modifiers: ['Meta'] });
  await expect(explore).not.toHaveClass(/selected/);
  await expect(research).toHaveClass(/selected/);
  await expect(editable).toHaveClass(/selected/);
});

test('space, middle mouse, and trackpad navigation do not disturb layer selection', async ({ page }) => {
  await openEditor(page);
  const pane = page.locator('.react-flow__pane');
  const viewport = page.locator('.react-flow__viewport');
  const handTool = page.getByRole('button', { name: 'Hand tool, H' });
  const paneBox = await pane.boundingBox();
  expect(paneBox).toBeTruthy();
  const start = { x: paneBox!.x + 55, y: paneBox!.y + 75 };

  await canvasNode(page, 'Research').click();
  const beforeSpacePan = await viewport.getAttribute('style');
  await page.keyboard.down('Space');
  await expect(handTool).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 70, start.y + 36, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  expect(await viewport.getAttribute('style')).not.toBe(beforeSpacePan);
  await expect(canvasNode(page, 'Research')).toHaveClass(/selected/);

  const beforeMiddlePan = await viewport.getAttribute('style');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(start.x - 45, start.y + 28, { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  expect(await viewport.getAttribute('style')).not.toBe(beforeMiddlePan);
  await expect(canvasNode(page, 'Research')).toHaveClass(/selected/);

  const beforeScroll = await viewport.getAttribute('style');
  await page.mouse.move(start.x, start.y);
  await page.mouse.wheel(0, 180);
  expect(await viewport.getAttribute('style')).not.toBe(beforeScroll);
  await expect(canvasNode(page, 'Research')).toHaveClass(/selected/);
});

test('select all respects editing and locked layers and supports bulk actions', async ({ page }) => {
  await openEditor(page);
  const title = page.locator('.document-title input');
  await title.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type('Selection-safe title');
  await expect(title).toHaveValue('Selection-safe title');
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0);

  await page.getByRole('button', { name: 'Lock Research', exact: true }).click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await expect(page.locator('.inspector-panel').getByText('2 layers selected', { exact: true }).first()).toBeVisible();
  await expect(canvasNode(page, 'Research')).not.toHaveClass(/selected/);

  const originalLayerCount = await page.locator('.layer-list > li').count();
  const originalEdgeCount = await page.locator('.react-flow__edge').count();
  await page.getByRole('button', { name: 'Duplicate selected layers', exact: true }).click();
  await expect(page.locator('.layer-list > li')).toHaveCount(originalLayerCount + 2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount);
  await expect(page.locator('.inspector-panel').getByText('2 layers selected', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Lock selected layers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unlock selected layers', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlock Editable layers copy', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Unlock selected layers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lock Editable layers copy', exact: true })).toBeVisible();
});

test('double-clicking one layer drills from multi-selection into editing', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.press('Meta+a');
  await expect(page.getByRole('group', { name: '3 selected layer actions' })).toBeVisible();
  await expect(page.locator('.node-actionbar')).toHaveCount(0);
  await expect(page.locator('.react-flow__resize-control')).toHaveCount(0);

  await canvasNode(page, 'Research').dblclick();
  await expect(page.getByRole('group', { name: '3 selected layer actions' })).toBeHidden();
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);
  await expect(page.getByLabel('Concept title')).toBeVisible();
  await expect(page.locator('.react-flow__resize-control')).toHaveCount(0);
});

test('double-clicking empty canvas creates and edits a concept while zoom recovery remains available', async ({ page }) => {
  await openEditor(page);
  const pane = page.locator('.react-flow__pane');
  const originalCount = await page.locator('.layer-list > li').count();
  const zoomReset = page.getByRole('button', { name: /Reset zoom to 100%/ });
  await expect(zoomReset).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoomReset).not.toHaveText('100%');
  await zoomReset.click();
  await expect(zoomReset).toHaveText('100%');

  await pane.dblclick({ position: { x: 35, y: 35 } });
  await expect(page.locator('.layer-list > li')).toHaveCount(originalCount + 1);
  await expect(page.getByLabel('Concept title')).toBeVisible();
});
