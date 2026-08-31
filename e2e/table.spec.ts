import { expect, test } from '@playwright/test';
import { openEditor, waitForSaved } from './helpers';

test('creates, edits, pastes, restructures, searches, undoes, and persists a table layer', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await openEditor(page);

  await page.getByRole('button', { name: 'Add table layer' }).click();
  const tableNode = page.locator('.react-flow__node-table');
  const table = tableNode.getByRole('table');
  await expect(table).toBeVisible();
  await expect(tableNode.locator('.table-cell')).toHaveCount(9);
  await expect(table.getByRole('columnheader')).toHaveCount(3);
  await expect(table.getByRole('cell')).toHaveCount(6);
  await expect(tableNode.locator('.table-cell[tabindex="0"]')).toHaveCount(1);
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
  await inspector.getByRole('button', { name: 'Row', exact: true }).first().click();
  await expect(inspector.getByText('4 rows × 3 columns')).toBeVisible();
  await inspector.getByRole('button', { name: 'Column', exact: true }).first().click();
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
