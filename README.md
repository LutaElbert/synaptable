# SynapTable

SynapTable is a local-first diagram workspace that turns PNG, JPEG, and WebP images into editable vector paths without AI. Images and documents remain in the browser unless the user explicitly downloads a project or SVG file.

## Features

- Drag, paste, or browse for images up to 15 MB and 24 decoded megapixels.
- Trace images locally in a cancellable Web Worker.
- Edit concept, raster, vector, and individual path layers.
- Double-click concept nodes to edit structured notes directly with bold, italic, underline, strikethrough, safe links, bullets, numbering, and checklists.
- Rename, recolor, hide, lock, duplicate, delete, resize, and reorder content.
- Add child and sibling ideas, collapse branches, search all layer and note text, and tidy a diagram automatically.
- Multi-select layers for bulk styling, alignment, distribution, opacity, and deletion.
- Label connectors and choose default, dashed, or emphasis styles.
- Start from idea, task, decision, or question templates.
- Autosave to IndexedDB with local version checkpoints plus portable `.synaptable` backup and restore.
- Export the visible canvas as editable SVG, including rich text, lists, checklists, links, connector labels, and vector paths.
- Responsive layers and properties panels for desktop, tablet, and mobile.

Semantic AI reconstruction, cloud sync, collaboration, and video vectorization are intentionally outside the local-first v1 feature set.

## Requirements

- Node.js 22.13 or newer
- npm
- A current Chrome, Edge, Firefox, or Safari release

## Local development

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Editing shortcuts

- `Enter` edits the selected concept.
- Double-click a layer name or press `F2` to rename it; `Enter` commits and `Escape` cancels.
- `Tab` adds a child when a canvas node has keyboard focus.
- `Shift+Enter` adds a sibling when a canvas node has keyboard focus.
- `Cmd/Ctrl+Enter` finishes rich-text editing; `Escape` cancels it.
- `Cmd/Ctrl+B`, `Cmd/Ctrl+I`, `Cmd/Ctrl+U`, and `Cmd/Ctrl+Shift+X` format selected text.
- `Cmd/Ctrl+K` opens the link editor through the rich-text extension.
- `Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z` undo and redo canvas operations when text is not being edited.

## Verification

```sh
npx playwright install chromium firefox webkit
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm audit
```

`npm run test:e2e` starts or reuses the local development server. CI builds the app first and runs the same workflow against the local Cloudflare Worker in Chromium, Firefox, and WebKit. The suite covers double-click and keyboard layer editing, direct rich-text editing, migration, connection validation and reconnection, locked-layer behavior, cascade deletion, search, branch operations, checkpoints, bulk arrangement, vectorization, backup/restore, drag/resize persistence, accessibility, export, and mobile panels. See [LAYER_CONNECTION_TEST_PLAN.md](./LAYER_CONNECTION_TEST_PLAN.md) for the graph behavior contract and regression matrix.

## Cloudflare Workers

The project uses Vinext with Cloudflare's Vite plugin. No D1, R2, or server-side user-data binding is required for v1.

```sh
npx wrangler login
npm run deploy:preview
```

After preview QA, deploy the tested commit with `npm run deploy`. Set `CLOUDFLARE_ACCOUNT_ID` in the environment or add the non-secret account ID to `wrangler.jsonc`. Never commit an API token.

Deployment is intentionally a separate approval step. Completing local verification does not create or update a Cloudflare Worker.

## Local data and recovery

Browser storage can be cleared by the user, browser, device policy, or storage pressure. Use **Project backup and restore** to create local checkpoints and download a portable `.synaptable` file before changing devices or clearing site data. Version 1 and 2 project files are migrated automatically to the current rich-title document schema. See [PRIVACY.md](./PRIVACY.md).
