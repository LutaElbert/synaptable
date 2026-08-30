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

test('outside-click commits concept text and only grows geometry when committed content needs it', async ({ page }) => {
  await openEditor(page);
  const research = canvasNode(page, 'Research');
  const originalBox = await research.boundingBox();
  const originalStyle = await research.getAttribute('style');
  const originalTransform = originalStyle?.match(/transform:\s*[^;]+/)?.[0];
  expect(originalBox).toBeTruthy();
  expect(originalTransform).toBeTruthy();

  await research.locator('.concept-node').dblclick();
  await expect(page.getByLabel('Concept title')).toBeFocused();
  const editingBox = await research.boundingBox();
  expect(editingBox!.height).toBeGreaterThan(originalBox!.height + 40);
  await page.getByLabel('Concept title').fill('Outside click commit');

  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } });
  await expect(page.getByLabel('Concept title')).toHaveCount(0);
  const committed = canvasNode(page, 'Outside click commit');
  await expect(committed.getByText('Outside click commit', { exact: true })).toBeVisible();
  const committedBox = await committed.boundingBox();
  expect(Math.abs(committedBox!.width - originalBox!.width)).toBeLessThan(2);
  expect(committedBox!.height).toBeGreaterThanOrEqual(originalBox!.height - 2);
  const cardBox = await committed.locator('.concept-node').boundingBox();
  const titleBox = await committed.locator('.concept-title-rich-text').boundingBox();
  expect(cardBox).toBeTruthy();
  expect(titleBox).toBeTruthy();
  expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height);
  expect(await committed.getAttribute('style')).toContain(originalTransform!);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(canvasNode(page, 'Research').getByText('Research', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const restored = canvasNode(page, 'Outside click commit');
  const restoredBox = await restored.boundingBox();
  expect(Math.abs(restoredBox!.width - originalBox!.width)).toBeLessThan(2);
  expect(Math.abs(restoredBox!.height - committedBox!.height)).toBeLessThan(2);
});

test('all formatting tools target the active title or body and can be toggled off', async ({ page }) => {
  await openEditor(page);
  const research = canvasNode(page, 'Research');
  await research.locator('.concept-node').dblclick();
  const title = page.getByLabel('Concept title');
  const body = page.getByLabel('Concept body');
  const bold = page.getByRole('button', { name: 'Bold', exact: true });
  const italic = page.getByRole('button', { name: 'Italic', exact: true });
  const underline = page.getByRole('button', { name: 'Underline', exact: true });
  const strike = page.getByRole('button', { name: 'Strikethrough', exact: true });
  const bullets = page.getByRole('button', { name: 'Bulleted list', exact: true });
  const numbers = page.getByRole('button', { name: 'Numbered list', exact: true });
  const checklist = page.getByRole('button', { name: 'Checklist', exact: true });
  const addLink = page.getByRole('button', { name: 'Add or edit link', exact: true });
  const removeLink = page.getByRole('button', { name: 'Remove link', exact: true });

  await expect(page.locator('.formatting-context')).toHaveText('Title');
  await expect(bold).toHaveAttribute('aria-pressed', 'true');
  await expect(bullets).toBeDisabled();
  await expect(numbers).toBeDisabled();
  await expect(checklist).toBeDisabled();
  await bold.click();
  await italic.click();
  await underline.click();
  await strike.click();
  await expect(bold).toHaveAttribute('aria-pressed', 'false');
  await expect(italic).toHaveAttribute('aria-pressed', 'true');
  await expect(underline).toHaveAttribute('aria-pressed', 'true');
  await expect(strike).toHaveAttribute('aria-pressed', 'true');

  await addLink.click();
  await expect(page.getByLabel('Link URL')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(title).toBeVisible();
  await expect(page.getByLabel('Link URL')).toHaveCount(0);
  await addLink.click();
  await page.getByLabel('Link URL').fill('https://example.com/title');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(removeLink).toBeEnabled();
  await removeLink.click();
  await expect(removeLink).toBeDisabled();

  await body.fill('Canvas behavior');
  await body.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await expect(page.locator('.formatting-context')).toHaveText('Body');
  await expect(bullets).toBeEnabled();
  await bullets.click();
  await expect(body.locator('ul:not([data-type="taskList"])')).toBeVisible();
  await bullets.click();
  await numbers.click();
  await expect(body.locator('ol')).toBeVisible();
  await numbers.click();
  await checklist.click();
  await expect(body.locator('ul[data-type="taskList"]')).toBeVisible();
  await checklist.click();

  await body.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await addLink.click();
  await page.getByLabel('Link URL').fill('https://example.com/body');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(removeLink).toBeEnabled();
  await removeLink.click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();

  const renderedTitle = research.locator('.concept-title-rich-text');
  await expect(renderedTitle.locator('strong')).toHaveCount(0);
  await expect(renderedTitle.locator('em')).toHaveCount(1);
  await expect(renderedTitle.locator('u')).toHaveCount(1);
  await expect(renderedTitle.locator('s')).toHaveCount(1);
  await expect(research.getByText('Canvas behavior', { exact: true })).toBeVisible();

  await research.locator('.concept-node').dblclick();
  await expect(title).toBeFocused();
  await expect(bold).toHaveAttribute('aria-pressed', 'false');
  await expect(italic).toHaveAttribute('aria-pressed', 'true');
  await italic.click();
  await underline.click();
  await strike.click();
  await bold.click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await expect(research.locator('.concept-title-rich-text strong')).toHaveCount(1);
  await expect(research.locator('.concept-title-rich-text em')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(research.locator('.concept-title-rich-text em')).toHaveCount(1);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(research.locator('.concept-title-rich-text strong')).toHaveCount(1);
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(canvasNode(page, 'Research').locator('.concept-title-rich-text strong')).toHaveCount(1);
});

test('checklist content auto-sizes its layer and removes the trailing empty row on commit', async ({ page }) => {
  await openEditor(page);
  const research = canvasNode(page, 'Research');
  const originalBox = await research.boundingBox();
  expect(originalBox).toBeTruthy();

  await research.locator('.concept-node').dblclick();
  const title = page.getByLabel('Concept title');
  const body = page.getByLabel('Concept body');
  await title.fill('Checklist sizing');
  const items = [
    'First action item',
    'Second action item with enough detail to wrap inside a narrow concept layer',
    'Third action item',
    'Fourth action item',
    'Fifth action item',
    'Sixth action item',
    'Seventh action item',
    'Eighth action item',
  ];
  await body.fill(items[0]);
  for (const item of items.slice(1)) {
    await page.keyboard.press('Enter');
    await page.keyboard.type(item);
  }
  await body.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.getByRole('button', { name: 'Checklist', exact: true }).click();
  const editingTaskItems = body.locator('ul[data-type="taskList"] > li[data-checked]');
  await expect(editingTaskItems).toHaveCount(items.length);
  await body.evaluate((editor) => {
    const paragraph = editor.querySelector('ul[data-type="taskList"] > li[data-checked]:last-child p');
    if (!paragraph) throw new Error('The final checklist paragraph is missing.');
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.keyboard.press('Enter');
  await expect(editingTaskItems).toHaveCount(items.length + 1);

  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  const committed = canvasNode(page, 'Checklist sizing');
  const renderedItems = committed.locator('.concept-task-item');
  await expect(renderedItems).toHaveCount(items.length);
  await expect(renderedItems.last()).toContainText('Eighth action item');

  const committedBox = await committed.boundingBox();
  const cardBox = await committed.locator('.concept-node').boundingBox();
  const bodyBox = await committed.locator('.concept-rich-text').boundingBox();
  expect(committedBox).toBeTruthy();
  expect(cardBox).toBeTruthy();
  expect(bodyBox).toBeTruthy();
  expect(Math.abs(committedBox!.width - originalBox!.width)).toBeLessThan(2);
  expect(committedBox!.height).toBeGreaterThan(originalBox!.height + 80);
  expect(bodyBox!.y + bodyBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height + 1);

  const sourceHandle = committed.locator('.react-flow__handle.source').first();
  const handleBox = await sourceHandle.boundingBox();
  expect(handleBox).toBeTruthy();
  const handleCenter = handleBox!.y + handleBox!.height / 2;
  const cardCenter = cardBox!.y + cardBox!.height / 2;
  expect(Math.abs(handleCenter - cardCenter)).toBeLessThan(3);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(canvasNode(page, 'Research').locator('.concept-task-item')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(canvasNode(page, 'Checklist sizing').locator('.concept-task-item')).toHaveCount(items.length);
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const restored = canvasNode(page, 'Checklist sizing');
  await expect(restored.locator('.concept-task-item')).toHaveCount(items.length);
  const restoredCardBox = await restored.locator('.concept-node').boundingBox();
  const restoredBodyBox = await restored.locator('.concept-rich-text').boundingBox();
  expect(restoredCardBox).toBeTruthy();
  expect(restoredBodyBox).toBeTruthy();
  expect(restoredBodyBox!.y + restoredBodyBox!.height).toBeLessThanOrEqual(restoredCardBox!.y + restoredCardBox!.height + 1);
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
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
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
  const unexpectedErrors = pageErrors.filter((message) => ![
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
  ].includes(message));
  expect(unexpectedErrors).toEqual([]);
});
