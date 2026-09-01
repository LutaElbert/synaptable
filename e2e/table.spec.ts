import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvasNode, openEditor, waitForSaved } from './helpers';

async function dragBetween(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).toBeTruthy();
  expect(targetBox).toBeTruthy();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
}

async function dragResizeControl(
  page: Page,
  node: Locator,
  selector: string,
  deltaX: number,
  deltaY: number,
) {
  const handle = node.locator(selector);
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 12 });
  await page.mouse.up();
}

async function flowNodeSize(node: Locator) {
  return node.evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: Number.parseFloat(style.width), height: Number.parseFloat(style.height) };
  });
}

async function viewportTransform(viewport: Locator) {
  return viewport.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, zoom: matrix.a };
  });
}

function expectSizeClose(actual: { width: number; height: number }, expected: { width: number; height: number }) {
  expect(Math.abs(actual.width - expected.width)).toBeLessThan(2);
  expect(Math.abs(actual.height - expected.height)).toBeLessThan(2);
}

async function expectSvgCentered(button: Locator, tolerance = 0.6) {
  const offset = await button.evaluate((element) => {
    const icon = element.querySelector('svg');
    if (!icon) throw new Error('Expected the button to contain an SVG icon.');
    const buttonBox = element.getBoundingClientRect();
    const iconBox = icon.getBoundingClientRect();
    return {
      x: (iconBox.left + iconBox.width / 2) - (buttonBox.left + buttonBox.width / 2),
      y: (iconBox.top + iconBox.height / 2) - (buttonBox.top + buttonBox.height / 2),
    };
  });
  expect(Math.abs(offset.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(offset.y)).toBeLessThanOrEqual(tolerance);
}

test('creates, edits, pastes, restructures, searches, undoes, and persists a table layer', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await openEditor(page);

  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const tableSurface = tableNode.locator('.table-node');
  const table = tableNode.getByRole('table');
  await expect(table).toBeVisible();
  await expect(tableNode.locator('.table-cell')).toHaveCount(9);
  await expect(table.getByRole('columnheader')).toHaveCount(3);
  await expect(table.getByRole('cell')).toHaveCount(6);
  await expect(tableSurface).toHaveAttribute('data-table-interaction', 'table');
  await expect(tableNode.locator('.table-cell[tabindex="0"]')).toHaveCount(0);
  await expect(page.locator('.inspector-panel').getByText('3 rows × 3 columns')).toBeVisible();

  const firstBodyCell = tableNode.locator('.table-cell').nth(3);
  await firstBodyCell.dblclick();
  const editor = tableNode.getByRole('textbox', { name: /Edit New table, row 2, column 1/ });
  await editor.fill('Scene 1');
  await editor.press('Tab');
  await expect(firstBodyCell).toContainText('Scene 1');
  await expect(tableNode.locator('.table-cell').nth(4)).toBeFocused();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(firstBodyCell).not.toContainText('Scene 1');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(firstBodyCell).toContainText('Scene 1');

  await tableNode.locator('.table-cell').nth(4).evaluate((cell) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'Draft\tMonday\nReady\tTuesday');
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: clipboardData });
    cell.dispatchEvent(paste);
  });
  await expect(tableNode.getByText('Draft', { exact: true })).toBeVisible();
  await expect(tableNode.getByText('Tuesday', { exact: true })).toBeVisible();

  const inspector = page.locator('.inspector-panel');
  await inspector.getByRole('button', { name: 'Below', exact: true }).click();
  await expect(inspector.getByText('4 rows × 3 columns')).toBeVisible();
  await inspector.getByRole('button', { name: 'Right', exact: true }).click();
  await expect(inspector.getByText('4 rows × 4 columns')).toBeVisible();
  await inspector.getByLabel('Background').selectOption('mint');
  await expect(tableNode.locator('.table-cell.is-active')).toHaveClass(/cell-tone-mint/);

  await page.getByPlaceholder('Search layers and notes').fill('Tuesday');
  await expect(page.getByRole('button', { name: 'New table', exact: true })).toBeVisible();
  await page.getByPlaceholder('Search layers and notes').fill('');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(inspector.getByText('4 rows × 3 columns')).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(inspector.getByText('4 rows × 4 columns')).toBeVisible();

  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const restored = page.locator('.react-flow__node-table');
  await expect(restored.getByText('Scene 1', { exact: true })).toBeVisible();
  await expect(restored.getByText('Tuesday', { exact: true })).toBeVisible();
  await expect(restored.locator('.table-cell')).toHaveCount(16);
  expect(runtimeErrors).toEqual([]);
});

test('pans and zooms over a static table like existing layer surfaces', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const tableSurface = tableNode.locator('.table-node');
  const viewport = page.locator('.react-flow__viewport');
  const bodyCell = tableNode.locator('.table-cell').nth(4);
  const caption = tableNode.locator('caption');

  await expect(tableNode).toHaveClass(/selected/);
  await expect(tableSurface).toHaveAttribute('data-table-interaction', 'table');

  const beforeCellPan = await viewportTransform(viewport);
  await bodyCell.hover({ position: { x: 24, y: 16 } });
  await page.mouse.wheel(0, 180);
  await expect.poll(async () => {
    const current = await viewportTransform(viewport);
    return Math.hypot(current.x - beforeCellPan.x, current.y - beforeCellPan.y);
  }).toBeGreaterThan(1);
  expect((await viewportTransform(viewport)).zoom).toBeCloseTo(beforeCellPan.zoom, 4);

  const beforeCaptionPan = await viewportTransform(viewport);
  await caption.hover({ position: { x: 36, y: 16 } });
  await page.mouse.wheel(80, 0);
  await expect.poll(async () => {
    const current = await viewportTransform(viewport);
    return Math.hypot(current.x - beforeCaptionPan.x, current.y - beforeCaptionPan.y);
  }).toBeGreaterThan(1);

  await bodyCell.hover({ position: { x: 24, y: 16 } });
  const beforeWheelZoom = await viewportTransform(viewport);
  await page.keyboard.down('Control');
  try {
    // WebKit applies a larger multiplier to modifier-wheel deltas. A small
    // zoom-out gesture proves the path without saturating either zoom limit.
    await page.mouse.wheel(0, 30);
  } finally {
    await page.keyboard.up('Control');
  }
  await expect.poll(async () => Math.abs((await viewportTransform(viewport)).zoom - beforeWheelZoom.zoom)).toBeGreaterThan(0.01);

  const zoomIn = page.getByRole('button', { name: 'Zoom In' });
  const zoomOut = page.getByRole('button', { name: 'Zoom Out' });
  const fitView = page.getByRole('button', { name: 'Fit View' });
  const beforeToolbarZoom = await viewportTransform(viewport);
  await zoomIn.click();
  await expect.poll(async () => (await viewportTransform(viewport)).zoom).toBeGreaterThan(beforeToolbarZoom.zoom);
  const afterZoomIn = await viewportTransform(viewport);
  await zoomOut.click();
  await expect.poll(async () => (await viewportTransform(viewport)).zoom).toBeLessThan(afterZoomIn.zoom);
  await fitView.click();

  await expect(tableNode).toHaveClass(/selected/);
  await expect(tableSurface).toHaveAttribute('data-table-interaction', 'table');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(tableNode).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.react-flow__node-table')).toBeVisible();
});

test('keeps multiline cell-editor scrolling isolated from canvas navigation', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  await tableNode.locator('.table-cell').nth(3).dblclick();
  const editor = tableNode.getByRole('textbox', { name: /row 2, column 1/ });
  await editor.fill(Array.from({ length: 18 }, (_, index) => `Line ${index + 1}`).join('\n'));
  await editor.evaluate((element) => { element.scrollTop = 0; });
  await expect(editor.evaluate((element) => element.scrollHeight > element.clientHeight)).resolves.toBe(true);

  const viewport = page.locator('.react-flow__viewport');
  const before = await viewportTransform(viewport);
  await editor.hover({ position: { x: 24, y: 16 } });
  await page.mouse.wheel(0, 180);

  await expect.poll(() => editor.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await viewportTransform(viewport)).toEqual(before);
  await expect(editor).toBeFocused();
  await expect(tableNode.locator('.table-node')).toHaveAttribute('data-table-interaction', 'editing');
});

test('organizes selected canvas layers into table rows without removing the originals', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByRole('button', { name: 'Explore tools', exact: true }).click({ modifiers: ['Meta'] });
  await page.getByRole('button', { name: 'Organize selected layers into a table' }).click();

  await expect(page.getByText('Organized 2 layers into table rows. Originals were kept.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Research', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore tools', exact: true })).toBeVisible();
  const tableNode = page.locator('.react-flow__node-table');
  await expect(tableNode.getByText('Research', { exact: true })).toBeVisible();
  await expect(tableNode.getByText('Explore tools', { exact: true })).toBeVisible();
});

test('keeps table, cell range, and canvas selection levels distinct', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const tableSurface = tableNode.locator('.table-node');
  const cells = tableNode.locator('.table-cell');

  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
  await expect(tableNode).not.toHaveClass(/selected/);

  await cells.nth(3).click();
  await expect(tableNode).toHaveClass(/selected/);
  await expect(tableSurface).toHaveAttribute('data-table-interaction', 'table');
  await expect(cells.locator('[data-table-selected="true"]')).toHaveCount(0);

  await cells.nth(3).click();
  await expect(tableSurface).toHaveAttribute('data-table-interaction', 'cell');
  await expect(cells.nth(3)).toHaveAttribute('data-range-anchor', 'true');
  await expect(cells.nth(3)).toHaveAttribute('data-range-focus', 'true');
  await expect(tableNode.locator('.table-cell[tabindex="0"]')).toHaveCount(1);

  await cells.nth(8).click({ modifiers: ['Shift'] });
  await expect(tableNode.locator('.table-cell[data-table-selected="true"]')).toHaveCount(6);
  await expect(page.locator('.table-cell-section')).toContainText('Selected 6 cells');

  await cells.nth(8).press('Escape');
  await expect(tableSurface).toHaveAttribute('data-table-interaction', 'table');
  await expect(tableNode.locator('.table-cell[data-table-selected="true"]')).toHaveCount(0);
  await expect(tableNode.locator('.table-cell[tabindex="0"]')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(tableNode).not.toHaveClass(/selected/);
  await expect(tableSurface).toHaveAttribute('data-table-interaction', 'none');
});

test('selects contiguous rows and columns with accessible grabbers', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const tableSurface = tableNode.locator('.table-node');
  const cells = tableNode.locator('.table-cell');
  await cells.nth(4).click();

  const firstRowGrabber = tableNode.getByRole('button', { name: 'Select row 1' });
  await firstRowGrabber.click();
  await firstRowGrabber.press('Delete');
  await expect(tableNode.getByText('Column 1', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(tableNode.getByText('Column 1', { exact: true })).toBeVisible();

  await tableNode.getByRole('button', { name: 'Select row 2' }).click();
  await expect(tableSurface).toHaveAttribute('data-table-interaction', 'row');
  await expect(tableNode.locator('.table-cell[data-table-selected="true"]')).toHaveCount(3);
  await expect(page.locator('.table-cell-section')).toContainText('Selected 1 row');

  await tableNode.getByRole('button', { name: 'Select row 3' }).click({ modifiers: ['Shift'] });
  await expect(tableNode.locator('.table-cell[data-table-selected="true"]')).toHaveCount(6);
  await expect(page.locator('.table-cell-section')).toContainText('Selected 2 rows');

  await tableNode.getByRole('button', { name: 'Select column 1' }).click();
  await tableNode.getByRole('button', { name: 'Select column 3' }).click({ modifiers: ['Shift'] });
  await expect(tableSurface).toHaveAttribute('data-table-interaction', 'column');
  await expect(tableNode.locator('.table-cell[data-table-selected="true"]')).toHaveCount(9);
  await expect(page.locator('.table-cell-section')).toContainText('Selected 3 columns');
});

test('supports range keyboard navigation, edge keys, printable edit, and clear', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const cells = tableNode.locator('.table-cell');
  const firstBodyCell = cells.nth(3);
  await firstBodyCell.click();

  await firstBodyCell.press('Shift+ArrowRight');
  await expect(tableNode.locator('.table-cell[data-table-selected="true"]')).toHaveCount(2);
  await expect(cells.nth(4)).toBeFocused();

  await cells.nth(4).press('End');
  await expect(cells.nth(5)).toBeFocused();
  await cells.nth(5).press('Control+Home');
  await expect(cells.nth(0)).toBeFocused();

  await cells.nth(0).press('x');
  const editor = tableNode.getByRole('textbox', { name: /Edit New table, row 1, column 1/ });
  await expect(editor).toHaveText('x');
  await editor.press('Escape');
  await expect(cells.nth(0)).toContainText('Column 1');

  await firstBodyCell.click();
  await firstBodyCell.press('y');
  const bodyEditor = tableNode.getByRole('textbox', { name: /Edit New table, row 2, column 1/ });
  await expect(bodyEditor).toHaveText('y');
  await bodyEditor.press('Control+Enter');
  await expect(firstBodyCell).toContainText('y');
  await firstBodyCell.press('Delete');
  await expect(firstBodyCell).not.toContainText('y');
});

test('formats one rich cell with toolbar marks, links, commit, cancel, and history', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const bodyCell = tableNode.locator('.table-cell').nth(3);

  await bodyCell.dblclick();
  const editor = tableNode.getByRole('textbox', { name: /Edit New table, row 2, column 1/ });
  const toolbar = page.getByRole('toolbar', { name: 'Cell text formatting' });
  await expect(toolbar).toBeVisible();
  await editor.fill('Opening scene');
  await editor.selectText();
  await toolbar.getByRole('button', { name: 'Bold' }).click();
  await toolbar.getByRole('button', { name: 'Italic' }).click();
  await toolbar.getByRole('button', { name: 'Underline', exact: true }).click();
  await toolbar.getByRole('button', { name: 'Strikethrough' }).click();
  await expect(toolbar.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  await expect(editor.locator('strong')).toHaveText('Opening scene');
  await expect(editor.locator('em')).toHaveText('Opening scene');
  await expect(editor.locator('u')).toHaveText('Opening scene');
  await expect(editor.locator('s')).toHaveText('Opening scene');

  await toolbar.getByRole('button', { name: 'Add or edit link' }).click();
  const linkInput = page.getByRole('textbox', { name: 'Link URL' });
  await linkInput.fill('javascript:alert(1)');
  await expect(page.getByRole('button', { name: 'Apply' })).toBeDisabled();
  await linkInput.fill('https://example.com/scene');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(editor.locator('a')).toHaveAttribute('href', 'https://example.com/scene');

  await toolbar.getByRole('button', { name: 'Finish editing' }).click();
  await expect(toolbar).toBeHidden();
  await expect(bodyCell.locator('strong')).toHaveText('Opening scene');
  await expect(bodyCell.locator('a')).toHaveAttribute('href', 'https://example.com/scene');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(bodyCell).not.toContainText('Opening scene');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(bodyCell.locator('strong')).toHaveText('Opening scene');

  await bodyCell.dblclick();
  const reopened = tableNode.getByRole('textbox', { name: /Edit New table, row 2, column 1/ });
  await reopened.selectText();
  await page.getByRole('toolbar', { name: 'Cell text formatting' })
    .getByRole('button', { name: 'Remove link' })
    .click();
  await expect(reopened.locator('a')).toHaveCount(0);
  await page.getByRole('toolbar', { name: 'Cell text formatting' })
    .getByRole('button', { name: 'Cancel editing' })
    .click();
  await expect(bodyCell.locator('a')).toHaveAttribute('href', 'https://example.com/scene');

  await bodyCell.dblclick();
  const outsideCommitEditor = tableNode.getByRole('textbox', { name: /Edit New table, row 2, column 1/ });
  await outsideCommitEditor.press('Control+End');
  await outsideCommitEditor.type(' revised');
  await page.getByRole('heading', { name: 'Properties' }).click();
  await expect(page.getByRole('toolbar', { name: 'Cell text formatting' })).toBeHidden();
  await expect(bodyCell).toContainText('Opening scene revised');
  await expect(page.getByText('Saved on device')).toBeVisible();
  await page.reload();
  const restoredCell = page.locator('.react-flow__node-table .table-cell').nth(3);
  await expect(restoredCell.locator('strong')).toContainText('Opening scene revised');
  await expect(restoredCell.locator('a')).toHaveAttribute('href', 'https://example.com/scene');
});

test('resizes one internal boundary with one undo step and cancels with Escape', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const firstCell = tableNode.locator('.table-cell').first();
  await firstCell.click();

  const originalWidth = (await firstCell.boundingBox())!.width;
  const columnResizer = tableNode.getByRole('separator', { name: 'Resize column 1' });
  await columnResizer.press('ArrowRight');
  await expect.poll(async () => (await firstCell.boundingBox())!.width).toBeGreaterThan(originalWidth + 5);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await firstCell.boundingBox())!.width).toBeCloseTo(originalWidth, 0);

  const columnHandle = (await columnResizer.boundingBox())!;
  await page.mouse.move(columnHandle.x + columnHandle.width / 2, columnHandle.y + columnHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(columnHandle.x + columnHandle.width / 2 + 56, columnHandle.y + columnHandle.height / 2);
  await page.mouse.up();
  await expect.poll(async () => (await firstCell.boundingBox())!.width).toBeGreaterThan(originalWidth + 45);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await firstCell.boundingBox())!.width).toBeCloseTo(originalWidth, 0);

  const cancelHandle = (await columnResizer.boundingBox())!;
  await page.mouse.move(cancelHandle.x + cancelHandle.width / 2, cancelHandle.y + cancelHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(cancelHandle.x + cancelHandle.width / 2 + 44, cancelHandle.y + cancelHandle.height / 2);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect.poll(async () => (await firstCell.boundingBox())!.width).toBeCloseTo(originalWidth, 0);

  const originalHeight = (await firstCell.boundingBox())!.height;
  const rowResizer = tableNode.getByRole('separator', { name: 'Resize row 1' });
  const rowHandle = (await rowResizer.boundingBox())!;
  await page.mouse.move(rowHandle.x + rowHandle.width / 2, rowHandle.y + rowHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(rowHandle.x + rowHandle.width / 2, rowHandle.y + rowHandle.height / 2 + 34);
  await page.mouse.up();
  await expect.poll(async () => (await firstCell.boundingBox())!.height).toBeGreaterThan(originalHeight + 24);
});

test('resizes the whole table proportionally with anchored history and persistence', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const xInput = page.locator('.inspector-panel').getByRole('spinbutton', { name: 'X', exact: true });
  const yInput = page.locator('.inspector-panel').getByRole('spinbutton', { name: 'Y', exact: true });
  const originalSize = await flowNodeSize(tableNode);
  const originalCells = await tableNode.locator('.table-cell').evaluateAll((cells) => cells.map((cell) => {
    const box = cell.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));

  await dragResizeControl(page, tableNode, '.react-flow__resize-control.handle.bottom.right', 96, 66);
  const resizedSize = await flowNodeSize(tableNode);
  expect(resizedSize.width).toBeGreaterThan(originalSize.width + 55);
  expect(resizedSize.height).toBeGreaterThan(originalSize.height + 35);
  const resizedCells = await tableNode.locator('.table-cell').evaluateAll((cells) => cells.map((cell) => {
    const box = cell.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  expect(resizedCells).toHaveLength(originalCells.length);
  expect(resizedCells.every((cell, index) => (
    cell.width > originalCells[index].width + 10
    && cell.height > originalCells[index].height + 5
  ))).toBe(true);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expectSizeClose(await flowNodeSize(tableNode), originalSize);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expectSizeClose(await flowNodeSize(tableNode), resizedSize);

  const beforeTopLeftX = Number(await xInput.inputValue());
  const beforeTopLeftY = Number(await yInput.inputValue());
  await dragResizeControl(page, tableNode, '.react-flow__resize-control.handle.top.left', -52, -36);
  const anchoredSize = await flowNodeSize(tableNode);
  const anchoredX = Number(await xInput.inputValue());
  const anchoredY = Number(await yInput.inputValue());
  expect(anchoredSize.width).toBeGreaterThan(resizedSize.width + 25);
  expect(anchoredSize.height).toBeGreaterThan(resizedSize.height + 18);
  expect(anchoredX).toBeLessThan(beforeTopLeftX - 20);
  expect(anchoredY).toBeLessThan(beforeTopLeftY - 12);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expectSizeClose(await flowNodeSize(tableNode), resizedSize);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expectSizeClose(await flowNodeSize(tableNode), anchoredSize);
  await waitForSaved(page);

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const restored = page.locator('.react-flow__node-table');
  expectSizeClose(await flowNodeSize(restored), anchoredSize);
  await page.getByRole('button', { name: 'New table', exact: true }).click();
  await expect(page.locator('.inspector-panel').getByRole('spinbutton', { name: 'X', exact: true }))
    .toHaveValue(String(anchoredX));
  await expect(page.locator('.inspector-panel').getByRole('spinbutton', { name: 'Y', exact: true }))
    .toHaveValue(String(anchoredY));
});

test('connects every table side and updates connector geometry after resize', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const research = canvasNode(page, 'Research');
  const explore = canvasNode(page, 'Explore tools');
  const editable = canvasNode(page, 'Editable layers');
  const originalEdgeCount = await page.locator('.react-flow__edge').count();

  await dragBetween(
    page,
    tableNode.locator('.react-flow__handle.source').first(),
    research.locator('.react-flow__handle.target').first(),
  );
  await dragBetween(
    page,
    tableNode.locator('.react-flow__handle.source[data-handleid="bottom"]'),
    explore.locator('.react-flow__handle.target[data-handleid="top"]'),
  );
  await dragBetween(
    page,
    explore.locator('.react-flow__handle.source').first(),
    tableNode.locator('.react-flow__handle.target').first(),
  );
  await dragBetween(
    page,
    editable.locator('.react-flow__handle.source[data-handleid="bottom"]'),
    tableNode.locator('.react-flow__handle.target[data-handleid="top"]'),
  );

  await expect(page.locator('.react-flow__edge')).toHaveCount(originalEdgeCount + 4);
  const connectorLabels = [
    'Connector from New table to Research',
    'Connector from New table to Explore tools',
    'Connector from Explore tools to New table',
    'Connector from Editable layers to New table',
  ];
  for (const label of connectorLabels) await expect(page.getByLabel(label)).toBeVisible();
  const pathsBefore = await Promise.all(connectorLabels.map((label) => (
    page.getByLabel(label).locator('.react-flow__edge-path').getAttribute('d')
  )));

  await tableNode.locator('caption').click();
  await dragResizeControl(page, tableNode, '.react-flow__resize-control.handle.bottom.right', 82, 54);
  await expect.poll(async () => Promise.all(connectorLabels.map((label) => (
    page.getByLabel(label).locator('.react-flow__edge-path').getAttribute('d')
  )))).not.toEqual(pathsBefore);
  const pathsAfter = await Promise.all(connectorLabels.map((label) => (
    page.getByLabel(label).locator('.react-flow__edge-path').getAttribute('d')
  )));
  expect(pathsAfter.every((path, index) => path && path !== pathsBefore[index])).toBe(true);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => Promise.all(connectorLabels.map((label) => (
    page.getByLabel(label).locator('.react-flow__edge-path').getAttribute('d')
  )))).toEqual(pathsBefore);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => Promise.all(connectorLabels.map((label) => (
    page.getByLabel(label).locator('.react-flow__edge-path').getAttribute('d')
  )))).toEqual(pathsAfter);
});

test('offers directional insert, duplicate, delete, edge add, and sizing commands', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const inspector = page.locator('.inspector-panel');
  await tableNode.locator('.table-cell').nth(4).click();

  await tableNode.getByRole('button', { name: 'Add row below' }).click();
  await expect(inspector.getByText('4 rows × 3 columns')).toBeVisible();
  await tableNode.getByRole('button', { name: 'Add column right' }).click();
  await expect(inspector.getByText('4 rows × 4 columns')).toBeVisible();

  const rowControls = inspector.getByRole('group', { name: 'Table row controls' });
  const columnControls = inspector.getByRole('group', { name: 'Table column controls' });
  await rowControls.getByRole('button', { name: 'Above', exact: true }).click();
  await rowControls.getByRole('button', { name: 'Below', exact: true }).click();
  await expect(inspector.getByText('6 rows × 4 columns')).toBeVisible();
  await columnControls.getByRole('button', { name: 'Left', exact: true }).click();
  await columnControls.getByRole('button', { name: 'Right', exact: true }).click();
  await expect(inspector.getByText('6 rows × 6 columns')).toBeVisible();

  await rowControls.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(inspector.getByText('7 rows × 6 columns')).toBeVisible();
  await rowControls.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(inspector.getByText('6 rows × 6 columns')).toBeVisible();
  await columnControls.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(inspector.getByText('6 rows × 7 columns')).toBeVisible();
  await columnControls.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(inspector.getByText('6 rows × 6 columns')).toBeVisible();

  await inspector.getByRole('button', { name: 'Equal columns' }).click();
  await inspector.getByRole('button', { name: 'Equal rows' }).click();
  await inspector.getByRole('button', { name: 'Fit column' }).click();
  await inspector.getByRole('button', { name: 'Fit row' }).click();
  await inspector.getByRole('button', { name: 'Reset sizing' }).click();

});

test('centers row and column add icons at normal and maximum canvas zoom', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const addRow = tableNode.getByRole('button', { name: 'Add row below' });
  const addColumn = tableNode.getByRole('button', { name: 'Add column right' });
  await expect(addRow.locator('svg')).toHaveCount(1);
  await expect(addColumn.locator('svg')).toHaveCount(1);
  await expectSvgCentered(addRow);
  await expectSvgCentered(addColumn);

  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  for (let index = 0; index < 9 && await zoomIn.isEnabled(); index += 1) await zoomIn.click();
  await expect(page.getByRole('button', { name: /Reset zoom to 100%/ }))
    .toHaveAttribute('aria-label', /currently 400%/);
  await expectSvgCentered(addRow);
  await expectSvgCentered(addColumn);
});

test('copies and cuts a selected range as TSV and escaped HTML', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const startCell = tableNode.locator('.table-cell').nth(4);
  await startCell.click();
  await startCell.evaluate((cell) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'A\t<script>\nC\tD');
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: clipboardData });
    cell.dispatchEvent(paste);
  });
  await expect(tableNode.locator('.table-cell[data-table-selected="true"]')).toHaveCount(4);

  const copied = await startCell.evaluate((cell) => {
    const clipboardData = new DataTransfer();
    const copy = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(copy, 'clipboardData', { value: clipboardData });
    cell.dispatchEvent(copy);
    return {
      text: clipboardData.getData('text/plain'),
      html: clipboardData.getData('text/html'),
    };
  });
  expect(copied.text).toBe('A\t<script>\nC\tD');
  expect(copied.html).toContain('&lt;script&gt;');
  expect(copied.html).not.toContain('<script>');

  await page.locator('.inspector-panel').getByLabel('Background').selectOption('mint');
  await expect(tableNode.locator('.table-cell[data-table-selected="true"].cell-tone-mint')).toHaveCount(4);
  await page.locator('.inspector-panel').getByRole('button', { name: 'Clear formatting' }).click();
  await expect(tableNode.locator('.table-cell[data-table-selected="true"].cell-tone-none')).toHaveCount(4);

  await startCell.evaluate((cell) => {
    const clipboardData = new DataTransfer();
    const cut = new Event('cut', { bubbles: true, cancelable: true });
    Object.defineProperty(cut, 'clipboardData', { value: clipboardData });
    cell.dispatchEvent(cut);
  });
  await expect(tableNode.getByText('A', { exact: true })).toHaveCount(0);
  await expect(tableNode.getByText('C', { exact: true })).toHaveCount(0);
  await expect(tableNode.getByText('D', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(tableNode.getByText('D', { exact: true })).toBeVisible();
});

test('grows multiline edits, preserves one-step history, and marks manually constrained overflow', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const bodyCell = tableNode.locator('.table-cell').nth(3);
  const originalHeight = (await bodyCell.boundingBox())!.height;

  await bodyCell.dblclick();
  const editor = tableNode.getByRole('textbox', { name: /Edit New table, row 2, column 1/ });
  await editor.fill('Scene one');
  await editor.press('Control+End');
  await editor.press('Enter');
  await editor.type('Scene two');
  await expect(editor.locator('p')).toHaveText(['Scene one', 'Scene two']);
  await editor.press('Control+End');
  await editor.press('Enter');
  await editor.type('Scene three');
  await expect(editor.locator('p')).toHaveText(['Scene one', 'Scene two', 'Scene three']);
  const caret = await editor.evaluate(() => window.getSelection()?.anchorOffset ?? -1);
  await editor.press('ArrowLeft');
  await expect(editor).toBeFocused();
  expect(await editor.evaluate(() => window.getSelection()?.anchorOffset ?? -1)).toBe(caret - 1);
  await editor.press('Control+Enter');

  const grownHeight = (await bodyCell.boundingBox())!.height;
  expect(grownHeight).toBeGreaterThan(originalHeight + 8);
  await expect(bodyCell).not.toHaveAttribute('data-cell-overflow', 'true');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(bodyCell).not.toContainText('Scene one');
  await expect.poll(async () => (await bodyCell.boundingBox())!.height).toBeCloseTo(originalHeight, 0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(bodyCell).toContainText('Scene three');
  await expect.poll(async () => (await bodyCell.boundingBox())!.height).toBeCloseTo(grownHeight, 0);

  const height = page.locator('.inspector-panel').getByRole('spinbutton', { name: 'Height' });
  await height.fill('36');
  await height.blur();
  await expect(bodyCell).toHaveAttribute('data-cell-overflow', 'true');
  await expect(bodyCell).toHaveAttribute('aria-label', /content clipped/);
  await bodyCell.dblclick();
  await expect(tableNode.getByRole('textbox', { name: /Edit New table, row 2, column 1/ }).locator('p'))
    .toHaveText(['Scene one', 'Scene two', 'Scene three']);
});

test('enforces the 2,000-character cell limit as one undoable edit', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const firstCell = tableNode.locator('.table-cell').first();
  await firstCell.dblclick();
  const editor = tableNode.getByRole('textbox', { name: /Edit New table, row 1, column 1/ });
  await expect(editor).toHaveAttribute('maxlength', '2000');
  await editor.fill('x'.repeat(2_000));
  await editor.press('x');
  await expect.poll(async () => (await editor.textContent())?.length).toBe(2_000);
  await editor.press('Control+Enter');
  await expect.poll(async () => (await firstCell.textContent())?.length).toBe(2_000);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(firstCell).toContainText('Column 1');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await firstCell.textContent())?.length).toBe(2_000);
});

test('adds a row from the final cell and restores it with one undo', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const cells = tableNode.locator('.table-cell');
  await cells.nth(8).click();
  await cells.nth(8).press('Tab');
  await expect(cells).toHaveCount(12);
  await expect(cells.nth(9)).toBeFocused();
  await expect(page.locator('.inspector-panel').getByText('4 rows × 3 columns')).toBeVisible();

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cells).toHaveCount(9);
  await expect(tableNode.locator('.table-cell[tabindex="0"]')).toHaveCount(1);
});

test('moves focus to the nearest surviving cell after explicit row and column deletion', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const cells = tableNode.locator('.table-cell');
  await cells.nth(4).click();
  const nextRowId = await cells.nth(7).getAttribute('data-table-row-id');
  const activeColumnId = await cells.nth(4).getAttribute('data-table-column-id');
  const rowControls = page.locator('.inspector-panel').getByRole('group', { name: 'Table row controls' });
  await rowControls.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(cells).toHaveCount(6);
  const afterRowDelete = tableNode.locator(
    `.table-cell[data-table-row-id="${nextRowId}"][data-table-column-id="${activeColumnId}"]`,
  );
  await expect(afterRowDelete).toBeFocused();
  await expect(tableNode.locator('.table-cell[tabindex="0"]')).toHaveCount(1);

  const rowId = await afterRowDelete.getAttribute('data-table-row-id');
  const nextColumnId = await cells.nth(5).getAttribute('data-table-column-id');
  const columnControls = page.locator('.inspector-panel').getByRole('group', { name: 'Table column controls' });
  await columnControls.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(cells).toHaveCount(4);
  await expect(tableNode.locator(
    `.table-cell[data-table-row-id="${rowId}"][data-table-column-id="${nextColumnId}"]`,
  )).toBeFocused();
  await expect(tableNode.locator('.table-cell[tabindex="0"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cells).toHaveCount(6);
  await expect(tableNode.locator('.table-cell[tabindex="0"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cells).toHaveCount(4);
  await expect(tableNode.locator('.table-cell[tabindex="0"]')).toHaveCount(1);
});

test('preserves Unicode and RTL cell text through search, reload, and SVG export', async ({ page }) => {
  const unicodeText = 'Café 👩🏽‍💻 中文 العربية';
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const bodyCell = tableNode.locator('.table-cell').nth(3);
  await bodyCell.dblclick();
  const editor = tableNode.getByRole('textbox', { name: /Edit New table, row 2, column 1/ });
  await expect(editor).toHaveAttribute('dir', 'auto');
  await editor.fill(unicodeText);
  await editor.press('Control+Enter');
  await expect(bodyCell).toHaveAttribute('dir', 'auto');
  await page.getByPlaceholder('Search layers and notes').fill('العربية');
  await expect(page.getByRole('button', { name: 'New table', exact: true })).toBeVisible();
  await page.getByPlaceholder('Search layers and notes').fill('');
  await waitForSaved(page);

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.react-flow__node-table').getByText(unicodeText, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Export canvas' }).click();
  await page.getByText('SVG', { exact: true }).click();
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG' }).click();
  const downloadPath = await (await svgDownload).path();
  expect(downloadPath).toBeTruthy();
  const svg = await readFile(downloadPath!, 'utf8');
  expect(svg).toContain('Café 👩🏽‍💻 中文');
  expect(svg).toContain('العربية');
});

test('applies every supported cell tone and text alignment to a range', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const cells = tableNode.locator('.table-cell');
  await cells.nth(4).click();
  await cells.nth(8).click({ modifiers: ['Shift'] });
  const selected = tableNode.locator('.table-cell[data-table-selected="true"]');
  await expect(selected).toHaveCount(4);
  const inspector = page.locator('.inspector-panel');

  for (const tone of ['gray', 'indigo', 'mint', 'amber', 'rose', 'none']) {
    await inspector.getByLabel('Background').selectOption(tone);
    await expect(selected.filter({ has: page.locator(`:scope.cell-tone-${tone}`) })).toHaveCount(4);
  }
  for (const alignment of ['left', 'center', 'right']) {
    await inspector.getByRole('button', { name: alignment, exact: true }).click();
    await expect(selected.first()).toHaveCSS('text-align', alignment);
    expect(await selected.evaluateAll((elements, expected) => (
      elements.every((element) => getComputedStyle(element).textAlign === expected)
    ), alignment)).toBe(true);
  }
  await inspector.getByRole('button', { name: 'Clear formatting' }).click();
  await expect(tableNode.locator('.table-cell[data-table-selected="true"].cell-tone-none')).toHaveCount(4);
  await expect(selected.first()).toHaveCSS('text-align', 'left');
});

test('keeps cell hit targets and non-color selection cues at zoom extremes', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Contrast emulation is validated once in Chromium.');
  await page.emulateMedia({ contrast: 'more' });
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const cells = tableNode.locator('.table-cell');
  const zoomReadout = page.getByRole('button', { name: /Reset zoom to 100%/ });

  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  for (let index = 0; index < 14 && await zoomOut.isEnabled(); index += 1) await zoomOut.click();
  await expect(zoomReadout).toHaveAttribute('aria-label', /currently 15%/);
  await cells.nth(4).click();
  await expect(cells.nth(4)).toHaveAttribute('data-range-focus', 'true');
  const lowZoomSeparator = tableNode.getByRole('separator', { name: 'Resize column 2' });
  await expect(lowZoomSeparator).toBeVisible();
  const lowZoomWidth = (await cells.nth(4).boundingBox())!.width;
  await lowZoomSeparator.press('ArrowRight');
  await expect.poll(async () => (await cells.nth(4).boundingBox())!.width).toBeGreaterThan(lowZoomWidth);

  await zoomReadout.click();
  await expect(zoomReadout).toHaveText('100%');
  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  for (let index = 0; index < 9 && await zoomIn.isEnabled(); index += 1) await zoomIn.click();
  await expect(zoomReadout).toHaveAttribute('aria-label', /currently 400%/);
  await cells.nth(8).click({ modifiers: ['Shift'] });
  await expect(tableNode.locator('.table-cell[data-table-selected="true"]')).toHaveCount(4);
  await expect(cells.nth(8)).toHaveCSS('outline-width', '4px');
  expect(await cells.nth(4).evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
});

test('hides inner mutation controls while locked or canvas-multiselected', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  await tableNode.locator('.table-cell').nth(4).click();
  await expect(tableNode.getByRole('button', { name: 'Select row 2' })).toBeVisible();
  await expect(tableNode.getByRole('separator', { name: 'Resize column 1' })).toBeVisible();

  await page.locator('.inspector-panel').getByLabel('Lock layer').check();
  await expect(tableNode.getByRole('button', { name: 'Select row 2' })).toHaveCount(0);
  await expect(tableNode.getByRole('separator', { name: 'Resize column 1' })).toHaveCount(0);
  await expect(tableNode.locator('.table-cell[tabindex="0"]')).toHaveCount(0);

  await page.locator('.inspector-panel').getByLabel('Lock layer').uncheck();
  await page.getByRole('button', { name: 'Research', exact: true }).click({ modifiers: ['Meta'] });
  await expect(page.locator('.multi-selection-summary')).toContainText('2 layers selected');
  await expect(tableNode.getByRole('button', { name: 'Select row 2' })).toHaveCount(0);
  await expect(tableNode.getByRole('separator', { name: 'Resize column 1' })).toHaveCount(0);
});
