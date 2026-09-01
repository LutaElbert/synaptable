import { expect, test } from '@playwright/test';
import { openEditor, waitForSaved } from './helpers';

function stressProject(nodeCount = 500, edgeCount = 800) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `stress-node-${index}`,
    type: 'concept',
    position: { x: (index % 20) * 260, y: Math.floor(index / 20) * 110 },
    style: { width: 220, height: 78 },
    draggable: true,
    deletable: true,
    selected: false,
    data: {
      kind: 'concept',
      name: `Layer ${String(index + 1).padStart(3, '0')}`,
      label: `Layer ${String(index + 1).padStart(3, '0')}`,
      title: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: `Layer ${String(index + 1).padStart(3, '0')}`,
            marks: [{ type: 'bold' }],
          }],
        }],
      },
      body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: index % 2 ? 'Detail' : 'Topic',
      tone: index % 3 === 0 ? 'indigo' : index % 3 === 1 ? 'ink' : 'mint',
      collapsed: false,
      horizontalAlign: 'left',
      verticalAlign: 'top',
      opacity: 1,
      locked: false,
    },
  }));
  const edges = [];
  for (let index = 0; index < nodeCount - 1 && edges.length < edgeCount; index += 1) {
    edges.push({
      id: `stress-chain-${index}`,
      source: `stress-node-${index}`,
      target: `stress-node-${index + 1}`,
      type: 'smoothstep',
      data: { label: '', kind: 'default' },
    });
  }
  for (let index = 0; edges.length < edgeCount; index += 1) {
    edges.push({
      id: `stress-skip-${index}`,
      source: `stress-node-${index}`,
      target: `stress-node-${index + 2}`,
      type: 'smoothstep',
      data: { label: index % 25 === 0 ? 'related' : '', kind: index % 3 === 0 ? 'dashed' : 'default' },
    });
  }
  return JSON.stringify({
    format: 'synaptable-project',
    version: 3,
    exportedAt: new Date(0).toISOString(),
    document: {
      schemaVersion: 3,
      title: 'Stress graph',
      nodes,
      edges,
      updatedAt: 0,
    },
  });
}

function tableStressProject(rowCount = 100, columnCount = 20) {
  const columns = Array.from({ length: columnCount }, (_, columnIndex) => ({
    id: `stress-column-${columnIndex}`,
    width: 120,
  }));
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => ({
    id: `stress-row-${rowIndex}`,
    height: 44,
    cells: Array.from({ length: columnCount }, (__, columnIndex) => ({
      id: `stress-cell-${rowIndex}-${columnIndex}`,
      text: rowIndex === 0 ? `Column ${columnIndex + 1}` : `R${rowIndex + 1}C${columnIndex + 1}`,
      tone: rowIndex % 4 === 0 ? 'mint' : 'none',
      horizontalAlign: columnIndex % 3 === 0 ? 'center' : 'left',
    })),
  }));
  return JSON.stringify({
    format: 'synaptable-project',
    version: 5,
    exportedAt: new Date(0).toISOString(),
    document: {
      schemaVersion: 5,
      title: 'Table boundary fixture',
      nodes: [{
        id: 'stress-table',
        type: 'table',
        position: { x: 0, y: 0 },
        style: { width: columnCount * 120, height: 38 + rowCount * 44 },
        draggable: true,
        deletable: true,
        selected: false,
        data: {
          kind: 'table',
          name: 'Boundary table',
          opacity: 1,
          locked: false,
          columns,
          rows,
          headerRow: true,
          headerColumn: false,
        },
      }],
      edges: [],
      updatedAt: 0,
    },
  });
}

test('keeps a 500-layer, 800-connector document responsive and persistent', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The deterministic stress budget runs once in Chromium.');
  test.setTimeout(90_000);
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await openEditor(page);

  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  const restoreStarted = Date.now();
  await page.getByLabel('Choose a SynapTable project backup').setInputFiles({
    name: 'stress-graph.synaptable',
    mimeType: 'application/json',
    buffer: Buffer.from(stressProject()),
  });
  await expect(page.getByText('Project backup restored.')).toBeVisible({ timeout: 20_000 });
  expect(Date.now() - restoreStarted).toBeLessThan(20_000);
  await expect(page.locator('.layer-row')).toHaveCount(500);
  await expect(page.locator('.react-flow__node')).toHaveCount(500);
  await expect(page.locator('.react-flow__edge')).toHaveCount(800);

  const searchStarted = Date.now();
  await page.getByPlaceholder('Search layers and notes').fill('Layer 500');
  await expect(page.locator('.layer-row')).toHaveCount(1);
  expect(Date.now() - searchStarted).toBeLessThan(2_000);
  await page.getByPlaceholder('Search layers and notes').fill('');

  const tidyStarted = Date.now();
  await page.getByRole('button', { name: 'Tidy diagram layout' }).click();
  await expect(page.getByText('Diagram layout tidied.')).toBeVisible({ timeout: 10_000 });
  expect(Date.now() - tidyStarted).toBeLessThan(10_000);
  await waitForSaved(page);

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.layer-row')).toHaveCount(500);
  await expect(page.locator('.react-flow__edge')).toHaveCount(800);
  expect(runtimeErrors).toEqual([]);
});

test('renders, guards, exports, and restores the 2,000-cell table boundary', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The deterministic table boundary budget runs once in Chromium.');
  test.setTimeout(90_000);
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await openEditor(page);

  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  const restoreStarted = Date.now();
  await page.getByLabel('Choose a SynapTable project backup').setInputFiles({
    name: 'table-boundary.synaptable',
    mimeType: 'application/json',
    buffer: Buffer.from(tableStressProject()),
  });
  await expect(page.getByText('Project backup restored.')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.react-flow__node-table .table-cell')).toHaveCount(2_000, { timeout: 20_000 });
  expect(Date.now() - restoreStarted).toBeLessThan(20_000);

  await page.getByPlaceholder('Search layers and notes').fill('R100C20');
  await expect(page.getByRole('button', { name: 'Boundary table', exact: true })).toBeVisible();
  await page.getByPlaceholder('Search layers and notes').fill('');
  await page.getByRole('button', { name: 'Boundary table', exact: true }).click();
  const inspector = page.locator('.inspector-panel');
  await expect(inspector.getByText('100 rows × 20 columns')).toBeVisible();

  await expect(inspector.getByRole('group', { name: 'Table row controls' })
    .getByRole('button', { name: 'Below', exact: true })).toBeDisabled();
  await expect(inspector.getByRole('group', { name: 'Table column controls' })
    .getByRole('button', { name: 'Right', exact: true })).toBeDisabled();
  await expect(page.locator('.react-flow__node-table .table-cell')).toHaveCount(2_000);

  const exportStarted = Date.now();
  await page.getByRole('button', { name: 'Export SVG' }).click();
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG' }).click();
  const download = await svgDownload;
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  expect(await download.path()).toBeTruthy();
  expect(Date.now() - exportStarted).toBeLessThan(20_000);

  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.react-flow__node-table .table-cell')).toHaveCount(2_000, { timeout: 20_000 });
  await expect(page.getByText('R100C20', { exact: true })).toBeAttached();
  expect(runtimeErrors).toEqual([]);
});
