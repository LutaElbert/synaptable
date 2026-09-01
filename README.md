# SynapTable

SynapTable is a local-first visual thinking workspace for capturing connected ideas and organizing them into editable tables on the same canvas. Images and project content remain in the browser unless the user explicitly downloads a backup or export.

Image vectorization is temporarily disabled in the product interface. Its isolated implementation is retained behind a centralized feature switch for possible future evaluation.

## Features

- Drag, paste, or browse for images up to 15 MB and 24 decoded megapixels.
- Build connected concept maps and keep imported images as editable reference layers.
- Double-click concept nodes to edit structured notes directly with bold, italic, underline, strikethrough, safe links, bullets, numbering, and checklists.
- Add semantic table layers with rich cells, headers, range selection, spreadsheet-style copy/paste, row/column operations, internal resizing, and accessible keyboard navigation.
- Organize selected canvas layers into table rows without removing the source layers.
- Turn a whole table, selected rows, or a rectangular cell range back into ordered canvas concepts as one undoable action.
- Create deliberately sized tables with a keyboard-accessible 1–10 grid picker, `Shift+T`, or a spreadsheet grid pasted onto the canvas; generated names remain distinguishable.
- Rename, recolor, hide, lock, duplicate, delete, resize, and reorder content.
- Add child and sibling ideas from concept or image layers, collapse concept branches, search all layer and note text, and tidy a diagram automatically.
- Multi-select layers for bulk styling, alignment, distribution, opacity, and deletion.
- Label connectors and choose default, dashed, or emphasis styles.
- Start from idea, task, decision, or question templates.
- Keep multiple independently autosaved local projects in IndexedDB, with blank, idea-map, and table starters, project-scoped checkpoints, deep duplication, and portable `.synaptable` backup/import.
- Export the visible canvas or selected layers as PNG, editable SVG, or a single-page visual PDF; export tables or selected cell ranges as CSV.
- Responsive layers and properties panels for desktop, tablet, and mobile.

Formulas, database views, semantic AI reconstruction, cloud sync, collaboration, and video vectorization are intentionally outside the current local-first feature set.

The current product audit and sequenced roadmap are documented in [CURRENT_FEATURE_AUDIT.md](./CURRENT_FEATURE_AUDIT.md) and [AUDIT_REMEDIATION_IMPLEMENTATION_PLAN.md](./AUDIT_REMEDIATION_IMPLEMENTATION_PLAN.md).

## Requirements

- Node.js 24.15 or newer
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
- `Tab` adds a child when an unlocked concept or image node has canvas focus.
- `Shift+Enter` adds a sibling when an unlocked concept or image node has canvas focus.
- `Cmd/Ctrl+Enter` finishes rich-text editing; `Escape` cancels it.
- `Cmd/Ctrl+B`, `Cmd/Ctrl+I`, `Cmd/Ctrl+U`, and `Cmd/Ctrl+Shift+X` format selected text.
- `Cmd/Ctrl+K` opens the link editor through the rich-text extension.
- `Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z` undo and redo canvas operations when text is not being edited.
- Table cells support Enter/F2 to edit, Tab/Shift+Tab to commit and move, arrow-key navigation, range selection, and spreadsheet-style clipboard operations.
- `Shift+T` opens the table-size picker while canvas focus is active and never interrupts text or cell editing.

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

`npm run test:e2e` starts or reuses the local development server. GitHub Actions intentionally runs only the fast compatibility, type, lint, unit, build, and audit checks; run the full Chromium, Firefox, and WebKit suite locally before merging editor changes. The browser suite covers project migration and isolation, image import, concept and table editing, both conversion directions, table creation and paste, connection validation and reconnection, inherited child direction, locking, deletion, search, branch operations, project-scoped checkpoints, storage protection, backup/import, drag/resize persistence, accessibility, scope-aware export, mobile panels, and the large graph/table stress fixtures. See [LAYER_CONNECTION_TEST_PLAN.md](./LAYER_CONNECTION_TEST_PLAN.md) for the graph behavior contract and regression matrix.

## Cloudflare Workers

The project uses Vinext with Cloudflare's Vite plugin. No D1, R2, or server-side user-data binding is required for v1.

```sh
npx wrangler login
npm run deploy:preview
```

After preview QA, deploy the tested commit with `npm run deploy`. Set `CLOUDFLARE_ACCOUNT_ID` in the environment or add the non-secret account ID to `wrangler.jsonc`. Never commit an API token.

Deployment is intentionally a separate approval step. Completing local verification does not create or update a Cloudflare Worker.

## Local data and recovery

Browser storage can be cleared by the user, browser, device policy, or storage pressure. Use **Project backup and restore** to inspect approximate storage status, request persistent local storage where supported, create size-bounded local checkpoints, and download a portable `.synaptable` file before changing devices or clearing site data. Importing a backup creates a separate local project by default. Version 1–5 project files are migrated automatically to document schema 6, and the former single-project IndexedDB layout migrates once into the local project library without deleting its legacy recovery record. See [PRIVACY.md](./PRIVACY.md).
