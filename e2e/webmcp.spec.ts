import { expect, test } from '@playwright/test';

type BrowserTool = {
  name: string;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: unknown, options: { signal: AbortSignal }) => Promise<unknown>;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const registrations: BrowserTool[] = [];
    Object.defineProperty(window, '__synaptableWebMcpTools', {
      configurable: true,
      value: registrations,
    });
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool(definition: BrowserTool) {
          registrations.push(definition);
        },
      },
    });
  });
});

test('registers the approved tools once and persists an atomic agent mutation', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { __synaptableWebMcpTools?: BrowserTool[] }).__synaptableWebMcpTools?.length ?? 0
  ))).toBe(6);

  const names = await page.evaluate(() => (
    (window as unknown as { __synaptableWebMcpTools: BrowserTool[] })
      .__synaptableWebMcpTools.map((tool) => tool.name)
  ));
  expect(names).toEqual([
    'get_workspace_summary',
    'find_layers',
    'create_concept',
    'create_table',
    'organize_layers_into_table',
    'create_canvas_nodes_from_rows',
  ]);

  const summary = await page.evaluate(async () => {
    const tools = (window as unknown as { __synaptableWebMcpTools: BrowserTool[] }).__synaptableWebMcpTools;
    const tool = tools.find((candidate) => candidate.name === 'get_workspace_summary');
    return tool?.execute({}, { signal: new AbortController().signal });
  }) as { ok: boolean; projectId: string; revision: number };
  expect(summary).toMatchObject({ ok: true, revision: 0 });

  const title = `Agent browser concept ${Date.now()}`;
  const created = await page.evaluate(async ({ projectId, revision, title: conceptTitle }) => {
    const tools = (window as unknown as { __synaptableWebMcpTools: BrowserTool[] }).__synaptableWebMcpTools;
    const tool = tools.find((candidate) => candidate.name === 'create_concept');
    return tool?.execute({
      projectId,
      expectedRevision: revision,
      title: conceptTitle,
    }, { signal: new AbortController().signal });
  }, { projectId: summary.projectId, revision: summary.revision, title }) as {
    ok: boolean;
    revision: number;
    affectedCount: number;
  };
  expect(created).toMatchObject({ ok: true, revision: 1, affectedCount: 1 });
  await expect(page.locator('.react-flow__node').filter({ hasText: title })).toHaveCount(1);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.react-flow__node').filter({ hasText: title })).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.react-flow__node').filter({ hasText: title })).toHaveCount(1);
  await expect(page.locator('main[data-save-state="saved"]')).toBeVisible();

  await page.reload();
  await expect(page.locator('.react-flow__node').filter({ hasText: title })).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { __synaptableWebMcpTools?: BrowserTool[] }).__synaptableWebMcpTools?.length ?? 0
  ))).toBe(6);
});

test('keeps every registered result marked as untrusted and read annotations accurate', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { __synaptableWebMcpTools?: BrowserTool[] }).__synaptableWebMcpTools?.length ?? 0
  ))).toBe(6);
  const annotations = await page.evaluate(() => (
    (window as unknown as { __synaptableWebMcpTools: BrowserTool[] })
      .__synaptableWebMcpTools.map((tool) => tool.annotations)
  ));
  expect(annotations.every((annotation) => annotation?.untrustedContentHint)).toBe(true);
  expect(annotations.slice(0, 2).every((annotation) => annotation?.readOnlyHint)).toBe(true);
  expect(annotations.slice(2).every((annotation) => annotation?.readOnlyHint === false)).toBe(true);
});

test('serializes concurrent mutations, rejects stale replay, and honors cancellation', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { __synaptableWebMcpTools?: BrowserTool[] }).__synaptableWebMcpTools?.length ?? 0
  ))).toBe(6);

  const outcome = await page.evaluate(async () => {
    const tools = (window as unknown as { __synaptableWebMcpTools: BrowserTool[] }).__synaptableWebMcpTools;
    const summaryTool = tools.find((tool) => tool.name === 'get_workspace_summary');
    const createTool = tools.find((tool) => tool.name === 'create_concept');
    if (!summaryTool || !createTool) throw new Error('Expected registered tools.');
    const summary = await summaryTool.execute({}, { signal: new AbortController().signal }) as {
      projectId: string;
      revision: number;
    };
    const context = { projectId: summary.projectId, expectedRevision: summary.revision };
    const [first, second] = await Promise.all([
      createTool.execute({ ...context, title: 'Concurrent first' }, { signal: new AbortController().signal }),
      createTool.execute({ ...context, title: 'Concurrent second' }, { signal: new AbortController().signal }),
    ]);
    const cancelledController = new AbortController();
    cancelledController.abort();
    const cancelled = await createTool.execute(
      { ...context, title: 'Must not exist' },
      { signal: cancelledController.signal },
    );
    return { first, second, cancelled };
  }) as {
    first: { ok: boolean; code?: string };
    second: { ok: boolean; code?: string };
    cancelled: { ok: boolean; code?: string };
  };

  expect([outcome.first.ok, outcome.second.ok].filter(Boolean)).toHaveLength(1);
  expect([outcome.first.code, outcome.second.code]).toContain('STALE_REVISION');
  expect(outcome.cancelled).toMatchObject({ ok: false, code: 'CANCELLED' });
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Concurrent' })).toHaveCount(1);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Must not exist' })).toHaveCount(0);
});

test('rejects old project context after a visible project switch without disclosing it', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { __synaptableWebMcpTools?: BrowserTool[] }).__synaptableWebMcpTools?.length ?? 0
  ))).toBe(6);
  const oldContext = await page.evaluate(async () => {
    const tool = (window as unknown as { __synaptableWebMcpTools: BrowserTool[] })
      .__synaptableWebMcpTools.find((candidate) => candidate.name === 'get_workspace_summary');
    return tool?.execute({}, { signal: new AbortController().signal });
  }) as { projectId: string; revision: number };

  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByLabel('Starter').selectOption('blank');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);

  const rejected = await page.evaluate(async (context) => {
    const tool = (window as unknown as { __synaptableWebMcpTools: BrowserTool[] })
      .__synaptableWebMcpTools.find((candidate) => candidate.name === 'find_layers');
    return tool?.execute({
      projectId: context.projectId,
      expectedRevision: context.revision,
      query: 'Research',
    }, { signal: new AbortController().signal });
  }, oldContext) as { ok: boolean; code?: string; summary?: string };
  expect(rejected).toMatchObject({ ok: false, code: 'PROJECT_CHANGED' });
  expect(JSON.stringify(rejected)).not.toContain('Research');
});
