import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { openEditor } from './helpers';

test('keeps the export dialog accessible and returns focus when cancelled', async ({ page }) => {
  await openEditor(page);
  const trigger = page.getByRole('button', { name: 'Export canvas' });
  await trigger.click();
  const results = await new AxeBuilder({ page })
    .include('.export-dialog')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious');
  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(trigger).toBeFocused();
});

test('downloads valid full-canvas SVG, PNG, and PDF files with chosen settings', async ({ page }) => {
  await openEditor(page);

  await page.getByRole('button', { name: 'Export canvas' }).click();
  await expect(page.getByRole('heading', { name: 'Export canvas' })).toBeVisible();
  await expect(page.getByLabel('Canvas', { exact: true })).toBeChecked();
  await expect(page.getByLabel('PNG', { exact: true })).toBeChecked();
  await expect(page.getByLabel('CSV', { exact: true })).toBeDisabled();
  await page.getByText('SVG', { exact: true }).click();
  await page.getByLabel('Export padding').selectOption('24');
  await page.getByLabel('Export background').selectOption('white');
  const svgEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG' }).click();
  const svgDownload = await svgEvent;
  const svgPath = await svgDownload.path();
  expect(svgPath).toBeTruthy();
  expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/);
  const svg = await readFile(svgPath!, 'utf8');
  expect(svg).toContain('<svg');
  expect(svg).toContain('fill="#ffffff"');
  expect(svg).toContain('Research');
  expect(svg).toContain('Explore tools');

  await page.getByRole('button', { name: 'Export canvas' }).click();
  await page.getByLabel('PNG resolution').selectOption('1');
  const pngEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG' }).click();
  const pngPath = await (await pngEvent).path();
  expect(pngPath).toBeTruthy();
  const png = await readFile(pngPath!);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

  await page.getByRole('button', { name: 'Export canvas' }).click();
  await page.getByText('PDF', { exact: true }).click();
  await page.getByLabel('PDF page size').selectOption('a4');
  await page.getByLabel('PDF orientation').selectOption('landscape');
  await page.getByLabel('PDF quality').selectOption('1');
  const pdfEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const pdfPath = await (await pdfEvent).path();
  expect(pdfPath).toBeTruthy();
  const pdfBytes = await readFile(pdfPath!);
  expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-');
  const pdf = await PDFDocument.load(pdfBytes);
  expect(pdf.getPageCount()).toBe(1);
  const size = pdf.getPage(0).getSize();
  expect(size.width).toBeGreaterThan(size.height);
  expect(size.width).toBeCloseTo(841.89, 1);
});

test('exports only selected layers and keeps connectors inside the selection', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByRole('button', { name: 'Explore tools', exact: true }).click({ modifiers: ['Meta'] });

  await page.getByRole('button', { name: 'Export canvas' }).click();
  await expect(page.getByLabel('Selection', { exact: true })).toBeChecked();
  await page.getByText('SVG', { exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG' }).click();
  const path = await (await event).path();
  expect(path).toBeTruthy();
  const svg = await readFile(path!, 'utf8');
  expect(svg).toContain('Research');
  expect(svg).toContain('Explore tools');
  expect(svg).not.toContain('Group findings');
  expect(svg).toContain('marker-end="url(#arrow)"');
});

test('exports a selected cell rectangle as spreadsheet-compatible Unicode CSV', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const table = page.locator('.react-flow__node-table');
  const cells = table.locator('.table-cell');

  await cells.nth(3).dblclick();
  const editor = table.getByRole('textbox', { name: /row 2, column 1/ });
  await editor.fill('Chloé, "导演"');
  await editor.press('Tab');
  await cells.nth(3).click();
  await cells.nth(3).press('Shift+ArrowRight');
  await cells.nth(4).press('Shift+ArrowRight');
  await cells.nth(5).press('Shift+ArrowDown');
  await expect(table.locator('.table-cell[data-table-selected="true"]')).toHaveCount(6);

  await page.getByRole('button', { name: 'Export canvas' }).click();
  await expect(page.getByLabel('Cells', { exact: true })).toBeChecked();
  await expect(page.getByLabel('CSV', { exact: true })).toBeChecked();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const download = await event;
  const path = await download.path();
  expect(path).toBeTruthy();
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const bytes = await readFile(path!);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const csv = new TextDecoder().decode(bytes.subarray(3));
  expect(csv).toContain('"Chloé, ""导演"""');
  expect(csv.split('\r\n')).toHaveLength(2);
});
