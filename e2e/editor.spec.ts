import { expect, test } from '@playwright/test';
import { createDiagramPng } from './helpers';

test('imports, vectorizes, persists, backs up, and exports locally', async ({ page, baseURL }) => {
  const externalRequests: string[] = [];
  const appOrigin = new URL(baseURL ?? page.url()).origin;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== appOrigin) externalRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Layers' })).toBeVisible();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();

  const imageInput = page.getByLabel('Choose images to add to the canvas');
  await expect(imageInput).toBeEnabled();
  await imageInput.setInputFiles({
    name: 'test-map.png',
    mimeType: 'image/png',
    buffer: await createDiagramPng(page),
  });
  await expect(page.getByRole('button', { name: 'test-map.png', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Vectorize', exact: true }).last().click();
  await expect(page.getByText(/Created \d+ editable vector layers/)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('button', { name: 'test-map.png vector', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expand test-map.png vector' }).click();
  const pathList = page.getByRole('list', { name: 'test-map.png vector paths' });
  await expect(pathList).toBeVisible();
  expect(await pathList.locator('.path-row').count()).toBeGreaterThan(0);
  await pathList.locator('.path-row').first().click();
  const pathInspector = page.locator('.inspector-panel');
  await expect(pathInspector.getByText('Vector path', { exact: true })).toBeVisible();
  await pathInspector.getByLabel('Name').fill('Primary shape');
  await pathInspector.getByLabel('Lock path').check();
  await expect(pathInspector.getByRole('button', { name: 'Duplicate path' })).toBeDisabled();
  await pathInspector.getByLabel('Lock path').uncheck();
  await pathInspector.getByRole('button', { name: 'Duplicate path' }).click();
  await expect(pathList.getByRole('button', { name: 'Primary shape copy', exact: true })).toBeVisible();
  await pathList.getByRole('button', { name: 'Primary shape', exact: true }).click();
  await pathList.getByRole('button', { name: 'Hide Primary shape', exact: true }).click();
  await expect(pathList.getByRole('button', { name: 'Show Primary shape', exact: true })).toBeVisible();
  await pathList.getByRole('button', { name: 'Show Primary shape', exact: true }).click();
  await pathInspector.getByRole('button', { name: 'Move path down' }).click();
  await expect(pathList.locator('.path-row').nth(1)).toContainText('Primary shape');
  await pathInspector.getByRole('button', { name: 'Move path up' }).click();
  await pathList.getByRole('button', { name: 'Primary shape copy', exact: true }).click();
  await pathInspector.getByRole('button', { name: 'Delete path' }).click();
  await expect(pathList.getByRole('button', { name: 'Primary shape copy', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(pathList.getByRole('button', { name: 'Primary shape copy', exact: true })).toBeVisible();
  await expect(page.locator('main[data-save-state="saved"]')).toBeVisible();

  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const backup = await backupDownload;
  expect(backup.suggestedFilename()).toMatch(/\.synaptable$/);
  const backupPath = await backup.path();
  expect(backupPath).toBeTruthy();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByRole('button', { name: 'test-map.png vector', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Choose a SynapTable project backup').setInputFiles(backupPath!);
  await expect(page.getByText('Project backup restored.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'test-map.png vector', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Export SVG' }).click();
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG' }).click();
  expect((await svgDownload).suggestedFilename()).toMatch(/\.svg$/);

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'test-map.png vector', exact: true })).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test('edits, hides, locks, duplicates, deletes, undoes, and redoes layers', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();

  await page.getByRole('button', { name: 'Add concept layer' }).click();
  const inspector = page.locator('.inspector-panel');
  const edgeCount = await page.locator('.react-flow__edge').count();
  const sourceHandle = page.locator('.react-flow__node').filter({ hasText: 'Research' }).locator('.react-flow__handle.source').first();
  const targetHandle = page.locator('.react-flow__node').filter({ hasText: 'New concept' }).locator('.react-flow__handle.target').first();
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  expect(sourceBox).toBeTruthy();
  expect(targetBox).toBeTruthy();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(edgeCount + 1);

  await inspector.getByLabel('Label').fill('Launch plan');
  await inspector.getByLabel('Eyebrow').fill('Milestone');
  await inspector.getByLabel('Style').selectOption('mint');
  await expect(page.getByRole('button', { name: 'Launch plan', exact: true })).toBeVisible();
  await expect(page.getByText('Milestone', { exact: true })).toBeVisible();

  await inspector.getByRole('button', { name: 'Duplicate layer' }).click();
  await expect(page.getByRole('button', { name: 'Launch plan copy', exact: true })).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(edgeCount + 1);

  const lockLayer = inspector.getByLabel('Lock layer');
  await lockLayer.check();
  await expect(inspector.getByRole('button', { name: 'Delete layer' })).toBeDisabled();
  await lockLayer.uncheck();
  await inspector.getByRole('button', { name: 'Delete layer' }).click();
  await expect(page.getByRole('button', { name: 'Launch plan copy', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Launch plan copy', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('button', { name: 'Launch plan copy', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Hide Launch plan' }).click();
  await expect(page.getByRole('button', { name: 'Show Launch plan' })).toBeVisible();
});

test('rejects mislabeled and corrupt image files', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByLabel('Choose images to add to the canvas').setInputFiles({
    name: 'not-really-an-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from('This is not PNG data.'),
  });
  await expect(page.getByText('not-really-an-image.png does not contain valid PNG, JPEG, or WebP data.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'not-really-an-image.png', exact: true })).toHaveCount(0);
});

test('accepts images dropped or pasted directly onto the canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const bytes = Array.from(await createDiagramPng(page));
  await page.evaluate<void, number[]>((pngBytes) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([new Uint8Array(pngBytes)], 'dropped-map.png', { type: 'image/png' }));
    const canvas = document.querySelector<HTMLElement>('#canvas-workspace');
    if (!canvas) throw new Error('Canvas workspace is missing.');
    canvas.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer }));
    canvas.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      clientX: Math.round(window.innerWidth * 0.55),
      clientY: Math.round(window.innerHeight * 0.45),
      dataTransfer,
    }));
  }, bytes);
  await expect(page.getByRole('button', { name: 'dropped-map.png', exact: true })).toBeVisible();
  await expect(page.getByText('dropped-map.png added to the canvas.')).toBeVisible();

  await page.evaluate<void, number[]>((pngBytes) => {
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([new Uint8Array(pngBytes)], 'pasted-map.png', { type: 'image/png' }));
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: clipboardData });
    document.body.dispatchEvent(paste);
  }, bytes);
  await expect(page.getByRole('button', { name: 'pasted-map.png', exact: true })).toBeVisible();
  await expect(page.getByText('pasted-map.png added to the canvas.')).toBeVisible();
});

test('keeps layers and properties usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();

  await page.getByRole('button', { name: 'Open layers panel' }).click();
  await expect(page.locator('.layers-panel')).toHaveClass(/panel-open/);
  await page.getByRole('button', { name: 'Close layers panel' }).click();

  await page.getByRole('button', { name: 'Open properties panel' }).click();
  await expect(page.locator('.inspector-panel')).toHaveClass(/panel-open/);
  await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
});

test('edits rich concept text directly with formatting, commit, cancel, undo, and persistence', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();

  const researchNode = page.locator('.react-flow__node').filter({ hasText: 'Research' }).first();
  await researchNode.locator('.concept-node').dblclick();
  const title = page.getByLabel('Concept title');
  await expect(title).toBeVisible();
  await title.fill('Research plan');

  const body = page.locator('.concept-body-editor');
  await body.fill('First milestone');
  await body.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await page.getByRole('button', { name: 'Bulleted list', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();

  await expect(researchNode.getByText('Research plan', { exact: true })).toBeVisible();
  await expect(researchNode.getByText('First milestone', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(researchNode.getByText('Research', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(researchNode.getByText('Research plan', { exact: true })).toBeVisible();

  await researchNode.locator('.concept-node').dblclick();
  await page.getByLabel('Concept title').fill('Discard this');
  await page.getByLabel('Concept title').press('Escape');
  await expect(researchNode.getByText('Research plan', { exact: true })).toBeVisible();

  await researchNode.locator('.concept-node').dblclick();
  await page.getByLabel('Concept title').fill('Discard with button');
  await page.getByRole('button', { name: 'Cancel editing', exact: true }).click();
  await expect(researchNode.getByText('Research plan', { exact: true })).toBeVisible();
  await expect(page.locator('main[data-save-state="saved"]')).toBeVisible();

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Research plan' })).toBeVisible();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'First milestone' })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('renames layers, searches content, adds and collapses branches, and saves checkpoints', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();

  const researchLayer = page.getByRole('button', { name: 'Research', exact: true });
  await researchLayer.dblclick();
  const layerName = page.getByLabel('Layer name');
  await layerName.fill('Discovery layer');
  await layerName.press('Enter');
  await expect(page.getByRole('button', { name: 'Discovery layer', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Discovery layer', exact: true }).click();
  await page.getByRole('button', { name: 'Add child', exact: true }).click();
  await page.getByLabel('Concept title').fill('Evidence review');
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Evidence review' })).toBeVisible();

  await page.getByPlaceholder('Search layers and notes').fill('Evidence review');
  await page.getByPlaceholder('Search layers and notes').press('Enter');
  await expect(page.getByRole('button', { name: 'Evidence review', exact: true })).toBeVisible();
  await page.getByPlaceholder('Search layers and notes').fill('');
  await page.getByRole('button', { name: 'Discovery layer', exact: true }).click();

  const parentNode = page.locator('.react-flow__node').filter({ hasText: 'Research' }).first();
  await parentNode.getByRole('button', { name: 'Collapse branch from Research' }).click();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Evidence review' })).toBeHidden();
  await parentNode.getByRole('button', { name: 'Expand branch from Research' }).click();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Evidence review' })).toBeVisible();

  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  await page.getByRole('button', { name: 'Save checkpoint' }).click();
  await expect(page.getByRole('button', { name: /Untitled concept map/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  const inspector = page.locator('.inspector-panel');
  await inspector.getByLabel('Label').fill('Changed after checkpoint');
  await inspector.getByLabel('Label').blur();
  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Untitled concept map/ }).first().click();
  await expect(page.getByText('Checkpoint restored.')).toBeVisible();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Research' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  await page.getByRole('button', { name: 'Delete checkpoint Untitled concept map' }).click();
  await expect(page.getByText('No checkpoints yet. Save one before a major edit.')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
});

test('bulk-arranges selected layers and edits connector labels and styles', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();

  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByRole('button', { name: 'Explore tools', exact: true }).click({ modifiers: ['Meta'] });
  await expect(page.locator('.inspector-panel').getByText('2 layers selected', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Align left', exact: true }).click();
  await page.getByRole('button', { name: 'Indigo', exact: true }).click();

  await page.getByRole('button', { name: 'Tidy diagram layout' }).click();
  await expect(page.getByText('Diagram layout tidied.')).toBeVisible();

  const edge = page.locator('.react-flow__edge').first();
  await edge.focus();
  await edge.press('Enter');
  const inspector = page.locator('.inspector-panel');
  await expect(inspector.getByText('Connector label', { exact: true })).toBeVisible();
  await inspector.getByLabel('Connector label').fill('supports research');
  await inspector.getByLabel('Connector label').blur();
  await inspector.getByLabel('Connector style').selectOption('dashed');
  await inspector.getByLabel('Connector style').blur();
  await expect(page.getByText('supports research', { exact: true })).toBeVisible();
  await expect(page.locator('.react-flow__edge.selected .react-flow__edge-path')).toHaveAttribute('style', /stroke-dasharray:\s*6(?:px)?,\s*5/);
});
