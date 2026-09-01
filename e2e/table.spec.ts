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

function expectSizeClose(actual: { width: number; height: number }, expected: { width: number; height: number }) {
  expect(Math.abs(actual.width - expected.width)).toBeLessThan(2);
  expect(Math.abs(actual.height - expected.height)).toBeLessThan(2);
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
  await expect(editor).toHaveValue('x');
  await editor.press('Escape');
  await expect(cells.nth(0)).toContainText('Column 1');

  await firstBodyCell.click();
  await firstBodyCell.press('y');
  const bodyEditor = tableNode.getByRole('textbox', { name: /Edit New table, row 2, column 1/ });
  await expect(bodyEditor).toHaveValue('y');
  await bodyEditor.press('Control+Enter');
  await expect(firstBodyCell).toContainText('y');
  await firstBodyCell.press('Delete');
  await expect(firstBodyCell).not.toContainText('y');
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
