import { expect, test, type Page } from '@playwright/test';
import { openEditor, waitForSaved } from './helpers';

async function renameActiveDocument(page: Page, title: string) {
  const input = page.getByLabel('Document title');
  await input.fill(title);
  await input.press('Enter');
  await expect(page.locator('main[data-save-state="saving"]')).toBeVisible();
  await waitForSaved(page);
}

test('creates, switches, renames, duplicates, and deletes isolated local projects', async ({ page }) => {
  await openEditor(page);
  await renameActiveDocument(page, 'Project Alpha');

  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Local projects' })).toBeVisible();
  await page.getByLabel('Starter').selectOption('blank');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  await renameActiveDocument(page, 'Project Beta');

  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const projectList = page.getByRole('list').filter({ has: page.locator('.project-row') });
  await expect(projectList.getByText('Project Alpha', { exact: true })).toBeVisible();
  await expect(projectList.getByText('Project Beta', { exact: true })).toBeVisible();
  await projectList.getByRole('button', { name: /^Project Alpha/ }).click();
  await expect(page.getByLabel('Document title')).toHaveValue('Project Alpha');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.getByLabel('Document title')).toHaveValue('Project Alpha');

  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate Project Alpha' }).click();
  await expect(page.getByLabel('Document title')).toHaveValue('Copy of Project Alpha');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Rename Copy of Project Alpha' }).click();
  await page.getByLabel('Project name').fill('Project Gamma');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Project Gamma', { exact: true })).toBeVisible();

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Project Beta');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete Project Beta' }).click();
  await expect(page.getByText('Project Beta', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeFocused();
});

test('migrates a version-3 document and checkpoints once without removing the legacy record', async ({ page }) => {
  await page.goto('/legacy-migration-fixture');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('synaptable-local');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Database deletion was blocked.'));
    });
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('synaptable-local', 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('documents', { keyPath: 'id' });
        const checkpoints = db.createObjectStore('checkpoints', { keyPath: 'id' });
        checkpoints.createIndex('createdAt', 'createdAt');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const document = {
      id: 'current',
      schemaVersion: 6,
      title: 'Legacy project',
      nodes: [],
      edges: [],
      updatedAt: 1234,
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(['documents', 'checkpoints'], 'readwrite');
      transaction.objectStore('documents').put(document);
      transaction.objectStore('checkpoints').put({
        id: 'legacy-checkpoint',
        createdAt: 1200,
        title: 'Legacy checkpoint',
        document: { ...document, id: undefined },
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.getByLabel('Document title')).toHaveValue('Legacy project');
  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  await expect(page.getByText('Legacy checkpoint', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  const firstMigration = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('synaptable-local', 4);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['documents', 'checkpoints'], 'readonly');
    const documents = await new Promise<unknown[]>((resolve, reject) => {
      const request = transaction.objectStore('documents').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const checkpoints = await new Promise<Array<{ projectId?: string }>>((resolve, reject) => {
      const request = transaction.objectStore('checkpoints').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {
      projectCount: documents.filter((record) => (record as { id?: string }).id !== 'current').length,
      hasLegacy: documents.some((record) => (record as { id?: string }).id === 'current'),
      checkpointProjectId: checkpoints[0]?.projectId,
    };
  });
  expect(firstMigration.projectCount).toBe(1);
  expect(firstMigration.hasLegacy).toBe(true);
  expect(firstMigration.checkpointProjectId).toBeTruthy();

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(page.locator('.project-row')).toHaveCount(1);
});
