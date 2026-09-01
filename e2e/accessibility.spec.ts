import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { canvasNode, openEditor } from './helpers';

test('has no serious or critical automated accessibility violations', async ({ page }) => {
  await openEditor(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious');
  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
});

test('supports keyboard entry, editing, cancellation, and focus restoration', async ({ page, browserName }) => {
  await openEditor(page);
  const skipLink = page.getByRole('link', { name: 'Skip to canvas' });
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Canvas workspace' })).toBeFocused();

  const researchLayer = page.getByRole('button', { name: 'Research', exact: true });
  await researchLayer.focus();
  await researchLayer.press('F2');
  await expect(page.getByLabel('Layer name')).toBeFocused();
  await page.getByLabel('Layer name').press('Escape');
  await expect(researchLayer).toBeFocused();

  await researchLayer.click();
  const researchNode = canvasNode(page, 'Research');
  await researchNode.focus();
  await researchNode.press('Enter');
  await expect(page.getByLabel('Concept title')).toBeFocused();
  await page.getByLabel('Concept title').press('Escape');
  await expect(researchNode).toBeFocused();
});

test('exposes rich table-cell editing without serious accessibility violations', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add table layer' }).click();
  const table = page.locator('.react-flow__node-table');
  await table.locator('.table-cell').nth(3).dblclick();
  const editor = table.getByRole('textbox', { name: /Edit New table, row 2, column 1/ });
  const toolbar = page.getByRole('toolbar', { name: 'Cell text formatting' });
  await expect(editor).toHaveAttribute('aria-multiline', 'true');
  await expect(toolbar.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false');
  await expect(toolbar.getByRole('button', { name: 'Finish editing' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('.react-flow__node-table')
    .include('.table-formatting-shell')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious');
  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
});

test('exposes layer, connector, toggle, and selection state semantically', async ({ page }) => {
  await openEditor(page);
  await expect(page.getByRole('list', { name: 'Canvas layers' })).toHaveAttribute('aria-describedby', 'layer-list-instructions');
  await expect(page.getByRole('button', { name: 'Research', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Research', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Collapse branch from Research' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Connector from Research to Explore tools')).toBeVisible();
  await expect(page.getByLabel('Connector from Research to Editable layers')).toBeVisible();

  await page.getByRole('button', { name: 'Hide Research', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show Research', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show Research', exact: true }).click();
  await page.getByRole('button', { name: 'Lock Research', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unlock Research', exact: true })).toBeVisible();
});

test('keeps controls usable with reduced motion and enlarged text on mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.getByRole('button', { name: 'Open layers panel' }).click();
  await expect(page.locator('.layers-panel')).toHaveClass(/panel-open/);
  await expect(page.getByRole('button', { name: 'Research', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close layers panel' }).click();
  await page.getByRole('button', { name: 'Open properties panel' }).click();
  await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
});
