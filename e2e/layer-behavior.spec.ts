import { expect, test } from '@playwright/test';
import { canvasNode, connectLayers, createDiagramPng, openEditor, waitForSaved } from './helpers';

test('double-click edits a canvas concept and cancel is a clean no-op', async ({ page }) => {
  await openEditor(page);
  const research = canvasNode(page, 'Research');
  const originalStyle = await research.getAttribute('style');
  const originalTransform = originalStyle?.match(/transform:\s*[^;]+/)?.[0];
  expect(originalTransform).toBeTruthy();
  const originalNodeCount = await page.locator('.react-flow__node').count();
  const originalEdgeCount = await page.locator('.react-flow__edge').count();

  await research.locator('.concept-node').dblclick();
  await expect(page.getByLabel('Concept title')).toBeVisible();
  await page.getByLabel('Concept title').fill('Temporary double-click edit');
  await page.getByRole('button', { name: 'Cancel editing', exact: true }).click();

  await expect(research.getByText('Research', { exact: true })).toBeVisible();
  await expect(research).toBeFocused();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.locator('.react-flow__node')).toHaveCount(originalNodeCount);
  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount);
  expect(await research.getAttribute('style')).toContain(originalTransform!);
});

test('double-click and F2 rename a layer with commit, cancel, undo, and redo', async ({ page }) => {
  await openEditor(page);
  const researchLayer = page.getByRole('button', { name: 'Research', exact: true });

  await researchLayer.dblclick();
  const nameEditor = page.getByLabel('Layer name');
  await expect(nameEditor).toBeFocused();
  await nameEditor.fill('Discovery');
  await nameEditor.press('Enter');
  await expect(page.getByRole('button', { name: 'Discovery', exact: true })).toBeFocused();

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Research', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const discoveryLayer = page.getByRole('button', { name: 'Discovery', exact: true });
  await expect(discoveryLayer).toBeVisible();

  await discoveryLayer.focus();
  await discoveryLayer.press('F2');
  await page.getByLabel('Layer name').fill('Discarded rename');
  await page.getByLabel('Layer name').press('Escape');
  await expect(page.getByRole('button', { name: 'Discovery', exact: true })).toBeFocused();
});

test('double-click rename behaves consistently for raster and vector layers', async ({ page }) => {
  await openEditor(page);
  await page.getByLabel('Choose images to add to the canvas').setInputFiles({
    name: 'double-click-map.png',
    mimeType: 'image/png',
    buffer: await createDiagramPng(page),
  });
  const rasterLayer = page.getByRole('button', { name: 'double-click-map.png', exact: true });
  await rasterLayer.dblclick();
  await page.getByLabel('Layer name').fill('Raster evidence');
  await page.getByLabel('Layer name').press('Enter');
  await expect(page.getByRole('button', { name: 'Raster evidence', exact: true })).toBeFocused();

  await page.getByRole('button', { name: 'Vectorize', exact: true }).last().click();
  const vectorLayer = page.getByRole('button', { name: 'Raster evidence vector', exact: true });
  await expect(vectorLayer).toBeVisible({ timeout: 45_000 });
  await vectorLayer.dblclick();
  await page.getByLabel('Layer name').fill('Vector evidence');
  await page.getByLabel('Layer name').press('Escape');
  await expect(page.getByRole('button', { name: 'Raster evidence vector', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Raster evidence vector', exact: true }).dblclick();
  await page.getByLabel('Layer name').fill('Vector evidence');
  await page.getByLabel('Layer name').press('Enter');
  await expect(page.getByRole('button', { name: 'Vector evidence', exact: true })).toBeFocused();
});

test('locked layers reject canvas editing, renaming, and new connections', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Lock Explore tools', exact: true }).click();
  const explore = canvasNode(page, 'Explore tools');

  await explore.locator('.concept-node').dblclick();
  await expect(page.getByLabel('Concept title')).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore tools', exact: true }).dblclick();
  await expect(page.getByLabel('Layer name')).toHaveCount(0);

  const edgeCount = await page.locator('.react-flow__edge').count();
  await connectLayers(page, 'Editable layers', 'Explore tools');
  await expect(page.locator('.react-flow__edge')).toHaveCount(edgeCount);
});

test('connection rules reject self and duplicate edges but allow reverse cycles', async ({ page }) => {
  await openEditor(page);
  const originalEdgeCount = await page.locator('.react-flow__edge').count();

  await connectLayers(page, 'Research', 'Research');
  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount);
  await connectLayers(page, 'Research', 'Explore tools');
  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount);

  await connectLayers(page, 'Explore tools', 'Research');
  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount + 1);
  await expect(page.getByLabel('Connector from Explore tools to Research')).toBeVisible();

  await page.getByRole('button', { name: 'Tidy diagram layout' }).click();
  await expect(page.getByText('Diagram layout tidied.')).toBeVisible();
});

test('reconnects a connector endpoint as one undoable operation', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add concept layer' }).click();
  const originalEdge = page.getByLabel('Connector from Research to Explore tools');
  await originalEdge.locator('.react-flow__edge-path').click({ force: true });
  const updater = originalEdge.locator('.react-flow__edgeupdater-target');
  const targetHandle = canvasNode(page, 'New concept').locator('.react-flow__handle.target').first();
  const updaterBox = await updater.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  expect(updaterBox).toBeTruthy();
  expect(targetBox).toBeTruthy();

  await page.mouse.move(updaterBox!.x + updaterBox!.width / 2, updaterBox!.y + updaterBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByLabel('Connector from Research to New concept')).toBeVisible();
  await expect(page.getByLabel('Connector from Research to Explore tools')).toHaveCount(0);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const restoredOriginalEdge = page.getByLabel('Connector from Research to Explore tools');
  await expect(restoredOriginalEdge).toBeVisible();
  await restoredOriginalEdge.locator('.react-flow__edge-path').click({ force: true });
  const duplicateUpdater = restoredOriginalEdge.locator('.react-flow__edgeupdater-target');
  const duplicateTarget = canvasNode(page, 'Editable layers').locator('.react-flow__handle.target').first();
  const duplicateUpdaterBox = await duplicateUpdater.boundingBox();
  const duplicateTargetBox = await duplicateTarget.boundingBox();
  expect(duplicateUpdaterBox).toBeTruthy();
  expect(duplicateTargetBox).toBeTruthy();
  await page.mouse.move(duplicateUpdaterBox!.x + duplicateUpdaterBox!.width / 2, duplicateUpdaterBox!.y + duplicateUpdaterBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(duplicateTargetBox!.x + duplicateTargetBox!.width / 2, duplicateTargetBox!.y + duplicateTargetBox!.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByLabel('Connector from Research to Explore tools')).toBeVisible();
  await expect(page.getByLabel('Connector from Research to Editable layers')).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByLabel('Connector from Research to New concept')).toBeVisible();
});

test('connector deletion and layer deletion cascade through undo and redo', async ({ page }) => {
  await openEditor(page);
  const originalEdgeCount = await page.locator('.react-flow__edge').count();
  await connectLayers(page, 'Explore tools', 'Research');
  const reverseEdge = page.getByLabel('Connector from Explore tools to Research');
  await reverseEdge.click();
  await page.getByRole('button', { name: 'Delete connector', exact: true }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const restoredReverseEdge = page.getByLabel('Connector from Explore tools to Research');
  await expect(restoredReverseEdge).toBeVisible();
  await restoredReverseEdge.focus();
  await restoredReverseEdge.press('Delete');
  await expect(page.getByLabel('Connector from Explore tools to Research')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Connector from Explore tools to Research')).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByLabel('Connector from Explore tools to Research')).toHaveCount(0);

  await page.getByRole('button', { name: 'Add concept layer' }).click();
  await connectLayers(page, 'Editable layers', 'New concept');
  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount + 1);
  const newConceptNode = canvasNode(page, 'New concept');
  await newConceptNode.focus();
  await newConceptNode.press('Delete');
  await expect(page.getByRole('button', { name: 'New concept', exact: true })).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New concept', exact: true })).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount + 1);
  await page.getByRole('button', { name: 'New concept', exact: true }).click();
  await page.locator('.inspector-panel').getByRole('button', { name: 'Delete layer' }).click();
  await expect(page.getByRole('button', { name: 'New concept', exact: true })).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New concept', exact: true })).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount + 1);
});

test('mixed locked selection changes and deletes only unlocked layers', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Lock Explore tools', exact: true }).click();
  await page.getByRole('button', { name: 'Explore tools', exact: true }).click();
  await page.getByRole('button', { name: 'Editable layers', exact: true }).click({ modifiers: ['Meta'] });
  await expect(page.locator('.inspector-panel').getByText('2 layers selected', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Indigo', exact: true }).click();
  await expect(canvasNode(page, 'Explore tools').locator('.concept-node')).toHaveClass(/tone-ink/);
  await expect(canvasNode(page, 'Editable layers').locator('.concept-node')).toHaveClass(/tone-indigo/);

  await page.getByRole('button', { name: 'Delete unlocked layers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Explore tools', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editable layers', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editable layers', exact: true })).toBeVisible();
});

test('layer ordering is deterministic and undoable', async ({ page }) => {
  await openEditor(page);
  const layerNames = () => page.locator('.layer-list > li .layer-main').allTextContents();
  expect(await layerNames()).toEqual(['Editable layers', 'Explore tools', 'Research']);
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByRole('button', { name: 'Move layer up', exact: true }).click();
  expect(await layerNames()).toEqual(['Editable layers', 'Research', 'Explore tools']);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await layerNames()).toEqual(['Editable layers', 'Explore tools', 'Research']);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await layerNames()).toEqual(['Editable layers', 'Research', 'Explore tools']);
});

test('dragged layer position survives undo, redo, autosave, and reload', async ({ page }) => {
  await openEditor(page);
  const research = canvasNode(page, 'Research');
  await research.click();
  const xInput = page.locator('.inspector-panel').getByRole('spinbutton', { name: 'X', exact: true });
  const yInput = page.locator('.inspector-panel').getByRole('spinbutton', { name: 'Y', exact: true });
  const originalX = Number(await xInput.inputValue());
  const originalY = Number(await yInput.inputValue());
  const box = await research.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 90, box!.y + box!.height / 2 + 55, { steps: 12 });
  await page.mouse.up();
  const movedX = Number(await xInput.inputValue());
  const movedY = Number(await yInput.inputValue());
  expect(movedX).not.toBe(originalX);
  expect(movedY).not.toBe(originalY);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(xInput).toHaveValue(String(originalX));
  await expect(yInput).toHaveValue(String(originalY));
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(xInput).toHaveValue(String(movedX));
  await expect(yInput).toHaveValue(String(movedY));
  await waitForSaved(page);

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await expect(page.locator('.inspector-panel').getByRole('spinbutton', { name: 'X', exact: true })).toHaveValue(String(movedX));
  await expect(page.locator('.inspector-panel').getByRole('spinbutton', { name: 'Y', exact: true })).toHaveValue(String(movedY));
});

test('resized layer dimensions are undoable and persist after reload', async ({ page }) => {
  await openEditor(page);
  const research = canvasNode(page, 'Research');
  await research.click();
  const originalBox = await research.boundingBox();
  const resizeHandle = research.locator('.react-flow__resize-control.handle.bottom.right');
  const handleBox = await resizeHandle.boundingBox();
  expect(originalBox).toBeTruthy();
  expect(handleBox).toBeTruthy();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 70, handleBox!.y + handleBox!.height / 2 + 45, { steps: 10 });
  await page.mouse.up();
  const resizedBox = await research.boundingBox();
  expect(resizedBox!.width).toBeGreaterThan(originalBox!.width + 30);
  expect(resizedBox!.height).toBeGreaterThan(originalBox!.height + 20);
  const resizedStyle = await research.getAttribute('style');
  const width = resizedStyle?.match(/width:\s*([^;]+)/)?.[1];
  const height = resizedStyle?.match(/height:\s*([^;]+)/)?.[1];
  expect(width).toBeTruthy();
  expect(height).toBeTruthy();

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const undoneBox = await research.boundingBox();
  expect(Math.abs(undoneBox!.width - originalBox!.width)).toBeLessThan(2);
  expect(Math.abs(undoneBox!.height - originalBox!.height)).toBeLessThan(2);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await research.getAttribute('style')).toContain(`width: ${width}`);
  await waitForSaved(page);

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const restoredStyle = await canvasNode(page, 'Research').getAttribute('style');
  expect(restoredStyle).toContain(`width: ${width}`);
  expect(restoredStyle).toContain(`height: ${height}`);
});
