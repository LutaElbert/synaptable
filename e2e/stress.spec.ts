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
      body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: index % 2 ? 'Detail' : 'Topic',
      tone: index % 3 === 0 ? 'indigo' : index % 3 === 1 ? 'ink' : 'mint',
      collapsed: false,
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
    version: 2,
    exportedAt: new Date(0).toISOString(),
    document: {
      schemaVersion: 2,
      title: 'Stress graph',
      nodes,
      edges,
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
