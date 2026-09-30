import { chromium } from 'playwright';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const appUrl = process.env.SYNAPTABLE_CAPTURE_URL ?? 'http://localhost:3003';
const projectRoot = process.cwd();
const recordingDir = path.join(projectRoot, 'capture', 'assets', 'recordings');
const rawDir = path.join(recordingDir, 'raw');
const storageStatePath = path.join(projectRoot, '.hyperframes', 'synaptable-capture-state.json');
const outputPath = path.join(recordingDir, 'synaptable-empty-to-table.webm');
const timelinePath = path.join(recordingDir, 'synaptable-empty-to-table.timeline.json');
const posterPath = path.join(recordingDir, 'synaptable-empty-to-table-final.png');

await mkdir(rawDir, { recursive: true });
await mkdir(path.dirname(storageStatePath), { recursive: true });
await rm(outputPath, { force: true });
await rm(timelinePath, { force: true });
await rm(posterPath, { force: true });

const browser = await chromium.launch({ headless: true });

async function waitForEditor(page) {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('main[data-ready="true"]').waitFor({ state: 'visible', timeout: 30_000 });
}

// Prepare a real blank project outside the recorded take, then preserve its IndexedDB state.
const setupContext = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
});
const setupPage = await setupContext.newPage();
await waitForEditor(setupPage);
const onboarding = setupPage.getByRole('dialog', { name: 'Move ideas between canvas and table' });
if (await onboarding.isVisible().catch(() => false)) {
  await onboarding.getByRole('button', { name: 'Got it' }).click();
}
await setupPage.getByRole('button', { name: 'Projects', exact: true }).click();
await setupPage.getByLabel('Starter').selectOption('blank');
await setupPage.getByRole('button', { name: 'New project', exact: true }).click();
await setupPage.locator('.react-flow__node').first().waitFor({ state: 'detached' });
const title = setupPage.getByLabel('Document title');
await title.fill('Launch system');
await title.press('Enter');
await setupPage.locator('main[data-save-state="saved"]').waitFor({ state: 'visible' });
await setupContext.storageState({ path: storageStatePath, indexedDB: true });
await setupContext.close();

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  screen: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  storageState: storageStatePath,
  recordVideo: {
    dir: rawDir,
    size: { width: 1920, height: 1080 },
  },
});

await context.addInitScript(() => {
  window.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
      * { cursor: none !important; }
      #demo-cursor {
        position: fixed;
        left: 0;
        top: 0;
        width: 24px;
        height: 30px;
        z-index: 2147483647;
        pointer-events: none;
        filter: drop-shadow(0 2px 3px rgb(24 25 29 / 28%));
        transform: translate3d(-40px, -40px, 0);
      }
      #demo-cursor::before {
        content: '';
        position: absolute;
        inset: 0;
        background: #18191d;
        border: 2px solid #fff;
        clip-path: polygon(0 0, 0 82%, 21% 63%, 35% 100%, 51% 92%, 37% 56%, 67% 56%);
      }
      #demo-cursor.is-clicking { transform: translate3d(var(--x), var(--y), 0) scale(.86); }
    `;
    document.head.append(style);
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.append(cursor);
    window.addEventListener('mousemove', (event) => {
      cursor.style.setProperty('--x', `${event.clientX}px`);
      cursor.style.setProperty('--y', `${event.clientY}px`);
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    }, { passive: true });
    window.addEventListener('mousedown', () => cursor.classList.add('is-clicking'));
    window.addEventListener('mouseup', () => cursor.classList.remove('is-clicking'));
  }, { once: true });
});

const page = await context.newPage();
const video = page.video();
const startedAt = performance.now();
const marks = [];
const mark = (event) => marks.push({ event, seconds: Number(((performance.now() - startedAt) / 1000).toFixed(3)) });
const pause = (milliseconds) => page.waitForTimeout(milliseconds);

await waitForEditor(page);
await page.locator('.react-flow__node').first().waitFor({ state: 'detached' });
await page.locator('main[data-save-state="saved"]').waitFor({ state: 'visible' });
await page.mouse.move(960, 530, { steps: 1 });
mark('empty-project-ready');
await pause(2200);

const pane = page.locator('.react-flow__pane');
await page.mouse.move(720, 470, { steps: 28 });
await pause(350);
await pane.dblclick({ position: { x: 475, y: 405 }, delay: 120 });
mark('create-root');
await page.getByLabel('Concept title').fill('Launch system');
await pause(650);
await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
await pause(1000);

async function addChild(label) {
  const rootNode = page.locator('.react-flow__node').filter({ hasText: 'Launch system' }).first();
  await rootNode.click();
  await rootNode.focus();
  await pause(420);
  await page.keyboard.press('Tab');
  await page.getByLabel('Concept title').fill(label);
  await pause(650);
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await pause(950);
  mark(`child-${label.toLowerCase().replaceAll(' ', '-')}`);
}

await addChild('Audience insight');
await addChild('Content ideas');
await addChild('Success signals');

await page.getByRole('button', { name: 'Fit view' }).click();
mark('connected-map');
await pause(2200);

await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
await pause(750);
await page.getByRole('button', { name: 'Organize selected layers into a table' }).click();
await page.getByText('Organized 4 layers into table rows. Originals were kept.').waitFor({ state: 'visible' });
mark('organized-table');
await pause(900);
await page.getByRole('button', { name: 'Fit view' }).click();
await pause(2100);

const table = page.locator('.react-flow__node-table').first();
const editableCell = table.locator('.table-cell').nth(5);
await editableCell.dblclick();
const cellEditor = table.getByRole('textbox').first();
await cellEditor.fill('Ready to ship');
await pause(900);
await cellEditor.press('Enter');
mark('edited-table-cell');
await pause(900);
await page.getByRole('button', { name: 'Fit view' }).click();
await pause(2800);
mark('final-hold');

await page.screenshot({ path: posterPath });
await page.close();
await context.close();

if (!video) throw new Error('Playwright did not create a recording handle.');
await video.saveAs(outputPath);
marks.push({ event: 'recording-end', seconds: Number(((performance.now() - startedAt) / 1000).toFixed(3)) });
await writeFile(timelinePath, `${JSON.stringify({ appUrl, marks }, null, 2)}\n`, 'utf8');

await browser.close();
console.log(JSON.stringify({ outputPath, timelinePath, posterPath, marks }, null, 2));
