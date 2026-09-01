# SynapTable table layer implementation plan

> Status: core MVP plus selection, direct resizing, structural commands, and range clipboard/formatting are implemented locally on `codex/table-layer-mvp`. Drag reordering, touch polish, and representative-user review remain before release.
>
> Product assumption: the first release is a simple visual table for comparisons, schedules, lists, and lightweight planning. It is not a database or spreadsheet.
>
> The next-pass interaction specification and full QA matrix are in [`TABLE_BEHAVIOR_AND_TEST_PLAN.md`](./TABLE_BEHAVIOR_AND_TEST_PLAN.md).

## Outcome

Add a `table` layer that behaves like a first-class SynapTable canvas object while keeping its cells easy to edit and accessible. A user can create a 3×3 table, enter and paste plain-text data, organize rows and columns, style cells, connect the whole table to other layers, persist it locally, undo changes, and export it with the rest of the diagram.

The differentiating workflow is:

```text
Loose canvas layers
        ↓
Create table from selection
        ↓
Organized plain-text rows
        ↓
Continue arranging and connecting the table on the canvas
```

The initial conversion is intentionally non-destructive: the source layers remain on the canvas, and the app announces that they were kept. Dragging a row back out as a synced canvas node is a later feature.

## Product boundary

### Included in version 1

- Create a blank 3×3 table from the canvas toolbar or quick-template picker.
- Move, select, resize, hide, lock, duplicate, delete, and connect the table as one React Flow node.
- Select a cell with one click and edit it with double-click, `Enter`, or `F2`.
- Navigate cells with `Tab`, `Shift+Tab`, and arrow keys.
- Add, remove, resize, and reorder rows and columns.
- Toggle a semantic header row and header column.
- Apply a small background-color palette and left, center, or right alignment to the active cell.
- Paste spreadsheet-shaped clipboard content into the active cell and expand the table when needed.
- Persist tables through autosave, undo/redo, checkpoints, project backup/restore, and reload.
- Render tables in SVG export.
- Create a table from selected canvas layers.
- Search table names and cell text from the layer panel.

### Explicitly deferred

- Formulas, calculations, aggregation, and conditional formatting.
- Typed properties such as dates, people, status, currency, or relations.
- Sorting, filtering, grouping, alternate views, and database records.
- CSV/XLSX file import or CSV export.
- Rich text, links, images, widgets, or nested canvas objects inside cells.
- Merged cells and discontiguous cell selection.
- Real-time collaboration or synchronized table copies.
- Drag-to-reorder rows and columns; accessible move controls ship first.
- Dragging rows onto the canvas or maintaining a live link between a row and a canvas node.

This boundary follows the useful distinction in Notion's guidance: a simple table presents and organizes plain text, while sorting, filtering, typed fields, formulas, and multiple views belong to a database. FigJam validates cell editing, adjustable rows and columns, headers, and spreadsheet paste as a strong whiteboard-table baseline. Miro's records, field types, grouping, calculations, and synced cards demonstrate the larger product category that should remain outside this MVP.

## Current codebase fit

SynapTable already provides most canvas-level behavior generically:

- `app/editor/types.ts` defines the `EditorNodeData` union and the current `concept`, `raster`, and `vector` node kinds.
- `app/editor/Editor.tsx` registers React Flow node renderers and owns selection, history, autosave, node movement, locking, visibility, duplication, deletion, connectors, layer search, templates, and inspectors.
- `app/editor/document-file.ts` validates and migrates document and backup data. The current document and project version is 5.
- `app/editor/persistence.ts` stores a validated `EditorDocument` and checkpoints in IndexedDB, so a valid new node kind participates automatically.
- `app/editor/export-svg.ts` has a renderer and dimension calculation for every existing node kind.
- `app/editor/node-layout.ts` supplies shared node dimensions used by branches, tidy, and export-adjacent behavior.
- The GitHub workflow intentionally runs fast checks only. Cross-browser, Worker, accessibility, and stress verification remain local release gates.

The implementation should extend these seams instead of adding a second state store or table-specific persistence path.

## Data contract

Add stable identifiers for rows, columns, and cells so focus and edits survive React Flow re-renders, structural changes, undo/redo, and reload.

```ts
export type TableCellTone =
  | 'none'
  | 'gray'
  | 'indigo'
  | 'mint'
  | 'amber'
  | 'rose';

export type TableCell = {
  id: string;
  text: string;
  tone: TableCellTone;
  horizontalAlign: 'left' | 'center' | 'right';
};

export type TableColumn = {
  id: string;
  width: number;
};

export type TableRow = {
  id: string;
  height: number;
  cells: TableCell[];
};

export type TableNodeData = BaseNodeData & {
  kind: 'table';
  columns: TableColumn[];
  rows: TableRow[];
  headerRow: boolean;
  headerColumn: boolean;
};
```

`data.name` is both the layer name and the visible table caption. Cells remain plain text. Header emphasis is derived from `headerRow` and `headerColumn`; it is not copied into every cell.

### Invariants and limits

- At least one row and one column must exist.
- Every row has exactly one cell for every column.
- Row, column, and cell IDs are unique within their table.
- Column width is clamped to 80–360 canvas pixels.
- Row height is clamped to 36–180 canvas pixels.
- A cell contains at most 2,000 characters.
- A table contains at most 100 rows, 30 columns, and 2,000 cells in total.
- Clipboard paste that exceeds a limit is rejected with a specific message; data is never silently truncated.
- Cell tones come from the fixed token set so validation, contrast, dark mode, and SVG output remain deterministic.

Create pure helpers in `app/editor/table-grid.ts` for default creation, invariant checks, cell updates, row and column insertion/removal/reordering, proportional table resizing, clipboard parsing, duplication with regenerated nested IDs, and selected-layer conversion. Unit-test these helpers in `app/editor/table-grid.test.ts` before wiring UI behavior.

## Document and migration strategy

1. Extend `BaseNodeData['kind']` and `EditorNodeData` with `TableNodeData`.
2. Raise `EditorDocument.schemaVersion` and `PROJECT_FILE_VERSION` from 4 to 5.
3. Make `validateEditorDocument` accept source versions 1–5 and always return version 5.
4. Add a strict `parseTableNode` path that enforces dimensions, matrix shape, ID uniqueness, cell limits, and enum values.
5. Preserve versions 1–4 unchanged through migration; they contain no table nodes and receive no synthetic table data.
6. Update every document constructor and fixture that currently writes `schemaVersion: 4`.
7. Keep the `.synaptable` envelope and IndexedDB database structure unchanged; no database-version migration is needed because the stored value remains an `EditorDocument`.
8. Add backup tests proving that version 4 projects still load and version 5 tables round-trip exactly.

## Interaction contract

### Canvas mode versus cell mode

There are distinct canvas and inner-table selection levels:

- **Canvas selection** selects the entire table for movement, connections, duplication, locking, layer actions, and inspector routing.
- **Inner-table selection** is an ephemeral union for whole-table, cell/range, row, column, and editing modes. It must not be serialized or added to undo history. The authoritative union and transition plan are in [`TABLE_BEHAVIOR_AND_TEST_PLAN.md`](./TABLE_BEHAVIOR_AND_TEST_PLAN.md#4-interaction-state-model).

The table caption and outer frame remain the drag surface. The semantic grid uses React Flow's `nodrag` and `nowheel` boundaries so text selection, cell editing, and row/column resizing do not move or pan the canvas accidentally. All connector handles remain on the table's outer node.

### Keyboard behavior

| Context | Key | Behavior |
| --- | --- | --- |
| Selected table node | `Enter` | Focus the last active cell, or the first cell |
| Selected cell | Arrow keys | Move one cell without entering edit mode |
| Selected cell | `Enter` or `F2` | Enter cell edit mode |
| Selected cell | `Tab` / `Shift+Tab` | Move forward/backward in row-major order |
| Last selected cell | `Tab` | Add a row and move into its first cell when under the limit |
| Editing cell | `Tab` / `Shift+Tab` | Commit once and move to the adjacent cell |
| Editing cell | `Escape` | Restore the cell's original text and return to selection mode |
| Editing cell | `Cmd/Ctrl+Enter` | Commit and remain on the cell |
| Editing cell | Arrow keys / `Enter` | Preserve normal textarea caret and multiline behavior |

Only one cell participates in the page tab order at a time through roving `tabIndex`. Do not use positive tabindex values. Table key handlers must stop React Flow or global canvas shortcuts only for keys the table actually handles.

### Focus stability

- Track the active cell by stable row and column IDs, never array index alone.
- After inserting, deleting, or moving a row or column, choose the nearest surviving cell before React paints.
- Restore focus with a layout effect tied to the active IDs; do not use timing guesses as the primary focus mechanism.
- Locking a table commits or cancels an active edit and moves focus to the table node.
- Deleting a row or column moves focus to the nearest surviving peer.
- Announce structural outcomes through the existing centralized polite toast region rather than creating live regions per table.

### Semantic HTML

Render a real `<table>` with a visible `<caption>` using the layer name. Use a `<colgroup>` for persisted widths, `<thead>` only when the first row is a header, and `<tbody>` for remaining rows.

- Header-row cells render as `<th scope="col">`.
- First-column cells below the header row render as `<th scope="row">` when `headerColumn` is enabled.
- All remaining cells render as `<td>`.
- The active cell swaps its display content for a labelled `<textarea>` during editing.
- Row/column commands use native `<button type="button">` controls with specific accessible names.
- Focus indicators, selected-cell state, header boundaries, and resize handles must meet non-text contrast requirements and cannot rely on color alone.

## Visual and sizing behavior

- Default table: 3 columns × 3 rows, 120-pixel columns, 44-pixel rows, header row enabled, header column disabled.
- The node's dimensions equal the caption plus the complete grid; version 1 does not introduce a clipped internal viewport.
- Column and row resize handles update stored widths/heights during pointer movement and record one history entry on pointer release.
- Keyboard-accessible number inputs in the inspector provide equivalent row-height and column-width controls.
- Whole-node resizing proportionally scales all stored column widths and row heights within their limits, then snaps the React Flow node style to the calculated table dimensions.
- Apply layout and paint containment to the inner table surface if browser testing confirms that handles and focus rings are unaffected. Do not depend on `content-visibility` for correctness.
- Update only the changed row/cell immutably and memoize the semantic grid so one keystroke does not rebuild unrelated nodes.

## Phased implementation

### Phase 0 — Confirm the representative use case

Before enabling the feature, collect one real example from the intended user: comparison, schedule, task tracker, expenses, or another shape. Use it to choose the default caption and template labels. Do not expand the model into typed database fields during this step.

**Gate:** one representative table can be expressed as plain text using the proposed rows, columns, headers, colors, and alignment.

### Phase 1 — Model, migration, and pure operations

Touch:

- `app/editor/types.ts`
- `app/editor/table-grid.ts`
- `app/editor/table-grid.test.ts`
- `app/editor/document-file.ts`
- `app/editor/document-file.test.ts`
- document fixtures in unit and browser tests

Implement the version 5 schema, default-table factory, structural operations, validation limits, deep duplication, clipboard matrix parser, and selected-layer-to-row mapping. Add `tableLayer: false` to `EDITOR_FEATURES` so incomplete UI stays hidden.

**Gate:** typecheck passes; old backups migrate; valid tables round-trip; malformed matrices, excessive content, duplicate nested IDs, and invalid styles are rejected; every pure operation is reversible from a recorded snapshot.

### Phase 2 — Read-only node, creation, and existing canvas behavior

Touch:

- `app/editor/Editor.tsx`
- `app/editor/TableGrid.tsx`
- `app/editor/features.ts`
- `app/editor/node-layout.ts`
- `app/globals.css`

Register `TableNode`, render the semantic table, expose **Add table** in the canvas toolbar and layer-panel heading, and add **Table 3×3** to the quick-template selector. Add the table icon, search text, minimap color, inspector kind, and common handles.

Make generic move, select, hide, lock, delete, and connect behavior pass first. Update both single-node and multi-node duplication to regenerate nested table IDs.

**Gate:** a feature-flagged table can be added, moved, resized, connected, hidden, locked, duplicated, deleted, undone, redone, saved, and restored without cell editing.

### Phase 3 — Cell editing and keyboard navigation

Touch:

- `app/editor/Editor.tsx`
- `app/editor/TableGrid.tsx`
- `app/globals.css`
- `e2e/editor.spec.ts`
- `e2e/accessibility.spec.ts`

Add ephemeral active-cell/edit state, the roving-tabindex model, textarea editing, commit/cancel snapshots, focus restoration, and the keyboard contract above. Each edit session creates at most one history entry regardless of keystroke count.

**Gate:** pointer and keyboard editing work in Chromium, Firefox, and WebKit; `Escape` creates no history entry; commit, undo, redo, autosave, and reload preserve the intended cell and focus behavior.

### Phase 4 — Row, column, header, size, and style controls

Touch:

- `app/editor/Editor.tsx`
- `app/editor/TableGrid.tsx`
- `app/editor/table-grid.ts`
- `app/globals.css`
- `e2e/layer-behavior.spec.ts`

Add a table-specific inspector section routed from `NodeInspector`:

- Header row and header column toggles.
- Add row above/below and column left/right.
- Delete active row or column, disabled when it would remove the last one.
- Move row up/down and column left/right.
- Numeric active-row height and active-column width.
- Active-cell background palette and text alignment.

Add pointer resize handles after inspector sizing is stable. All structural commands are one undoable transaction and retain a valid active cell.

**Gate:** every operation has pointer and keyboard access, respects locking and limits, survives reload, exports semantic state correctly, and can be undone/redone without matrix corruption.

### Phase 5 — Spreadsheet paste

Touch:

- `app/editor/table-grid.ts`
- `app/editor/TableGrid.tsx`
- `app/editor/Editor.tsx`
- relevant unit and Playwright tests

Prefer a clipboard HTML `<table>` when present, extracting only `textContent`; otherwise parse `text/tab-separated-values` or plain-text TSV with CRLF normalization. Never insert clipboard HTML into the DOM.

Paste begins at the active cell, replaces the covered range, and appends rows/columns when required and allowed. It records one history entry and announces the inserted dimensions. A one-cell clipboard remains a normal cell edit. Pasting tabular data onto an empty canvas to create a new table is a follow-up after in-table paste is stable.

**Gate:** Google Sheets and Excel clipboard samples with tabs, blank cells, multiline text, Unicode, and trailing newlines import predictably; unsafe markup is treated only as text; over-limit paste is rejected without mutation.

### Phase 6 — Canvas ideas to table rows

Touch:

- `app/editor/table-grid.ts`
- `app/editor/Editor.tsx`
- `e2e/canvas-behavior.spec.ts`

When two or more unlocked layers are selected, expose **Create table from selection** in the multi-selection toolbar and inspector. Sort selected layers in visual reading order, then create:

| Layer | Notes | Type |
| --- | --- | --- |
| Concept title or layer name | Plain-text concept body when available | Concept, image, vector, or table |

Place the new table beside the selection bounds, select it, keep the originals and all connectors, and announce the non-destructive result. The complete operation is one undo step.

**Gate:** mixed selected layer kinds map deterministically, locked layers are skipped with clear feedback, original graph integrity remains unchanged, and undo removes only the newly created table.

### Phase 7 — SVG export and hardening

Touch:

- `app/editor/export-svg.ts`
- `app/editor/export-svg.test.ts`
- `app/editor/node-layout.ts`
- `e2e/editor.spec.ts`
- `e2e/stress.spec.ts`

Add table dimension calculation and SVG rendering with escaped text, cell rectangles, grid borders, header emphasis, palette fills, alignment, and multiline wrapping/clipping. Connector endpoints must use the same calculated dimensions as the canvas node.

Run a mixed-document stress fixture with existing graph layers plus at least one 1,000-cell table. Measure cell navigation, one-character edit, structural mutation, paste, autosave, reload, and SVG generation. Optimize immutable update boundaries before considering virtualization.

**Gate:** exported SVG contains every visible cell without unsafe markup or clipping outside its cell; hidden tables are omitted; table connectors align; no runtime errors occur at the supported cell limit.

### Phase 8 — Enable and validate with the intended user

Turn on `EDITOR_FEATURES.tableLayer` only after all earlier gates pass. Test the real representative table from Phase 0, then decide whether the next increment should be templates, multi-cell selection, canvas-to-table drag/drop, or row-to-node extraction.

**Gate:** the intended user can create and finish her table without assistance, and her feedback does not reveal a need for formulas, filters, or typed properties in the MVP.

## Verification matrix

| Area | Required evidence |
| --- | --- |
| Schema | Version 4 migration, version 5 round-trip, strict invalid-table rejection, local restore |
| Pure operations | Insert/delete/move/resize rows and columns, paste expansion, limits, regenerated IDs |
| Canvas | Add, select, drag, whole-node resize, connect, lock, hide, duplicate, delete, tidy |
| Editing | Pointer entry, `Enter`, `F2`, arrows, Tab directions, multiline text, commit, cancel |
| History | One entry per edit/paste/structural action; correct undo/redo focus and data |
| Persistence | Autosave, reload, checkpoint, backup/restore, legacy backup import |
| Accessibility | Semantic caption/table/header cells, accessible controls, visible focus, axe scan, 200% zoom, VoiceOver/Safari review |
| Clipboard | Sheets/Excel HTML and TSV, blank cells, Unicode, multiline values, rejected oversize paste |
| Export | Escaping, wrapping, header/style fidelity, table bounds, connector endpoints |
| Performance | Supported-limit table remains usable without blocking unrelated canvas interactions |
| Regression | Existing concept, image, vector, connector, export, and 500-layer tests remain green |

Run before each implementation PR is considered ready:

```sh
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
```

Run the complex checks locally before enabling or merging the feature:

```sh
npm run test:e2e
```

For production parity, also run the focused table, persistence, accessibility, export, and stress cases against the locally built Cloudflare Worker. Record the command, browser counts, failures/retries, and representative manual result in this document or the PR description.

## Recommended PR sequence

1. **Table model and version 5 migration** — pure helpers and unit tests; feature flag off.
2. **Table creation and read-only canvas integration** — renderer, templates, layer list, generic node behavior; feature flag off.
3. **Editing, navigation, structure, and styling** — semantic interaction contract and local browser coverage; feature flag off.
4. **Clipboard, selected-layer conversion, SVG, and scale hardening** — end-to-end workflow; feature flag off.
5. **Enable table layer** — documentation, final local Worker/browser evidence, and intended-user acceptance.

Each PR should be independently reversible and must not expose partially working controls.

## Primary risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Canvas shortcuts conflict with cell navigation | Separate node and cell modes; handle and stop only owned keys inside the grid |
| Focus jumps after React Flow remounts | Stable nested IDs, parent-owned active-cell state, layout-effect restoration |
| One keystroke creates many history entries | Snapshot on edit start; record once on commit; restore snapshot on cancel |
| Generic duplication repeats nested DOM IDs | Table-specific deep clone that regenerates row, column, and cell IDs |
| Malformed backup creates a ragged matrix | Strict version 5 validation with explicit row/column/cell limits |
| Large paste stalls the canvas | Hard cell cap, reject-before-mutate parser, immutable row updates, local stress gate |
| Table semantics are lost in a custom grid | Native `<table>`, `<caption>`, scoped `<th>`, `<td>`, and labelled native edit controls |
| SVG differs from the canvas | Share dimension, palette, alignment, and wrapping helpers between renderers where practical |
| “Convert” unexpectedly destroys ideas | Ship non-destructive create-from-selection and announce that originals remain |
| Scope drifts into Airtable | Keep cells plain text and defer types, filters, formulas, grouping, records, and views |

## Reference patterns

- [FigJam tables](https://help.figma.com/hc/en-us/articles/12583849250199-Tables-in-FigJam): board-native creation, cell navigation, row/column manipulation, spreadsheet paste, and visual export.
- [Notion simple tables versus databases](https://www.notion.com/help/guides/simple-tables-vs-databases): the scope boundary between plain-text presentation and structured database behavior.
- [Miro Tables](https://help.miro.com/hc/en-us/articles/22760922335506-Tables): canvas-to-record and record-to-canvas workflows, plus a clear view of the advanced field/filter/group/calculation scope intentionally deferred here.

## Product question to validate

Ask the intended user for one real table she expects to make. If it is mainly a comparison, schedule, list, or planning grid, proceed with this plan. If it requires formulas, expense totals, typed dates, filtering, or task statuses as structured values, pause before implementation and write a separate data-table specification rather than stretching this visual-table model.

## Local implementation evidence — 2026-09-01

Implemented on `codex/table-layer-mvp` with the entry-point flag enabled. The generic comparison/schedule shape remains the default because the representative real-world table has not yet been supplied.

- Unit tests: 60 passed, including the supported 2,000-cell boundary and rejected over-limit growth.
- Chromium regression: 40 passed, including the existing 500-layer/800-connector stress scenario and both table workflows.
- Cross-browser regression: 117 passed and 2 intentionally skipped; the sole first-pass Firefox failure came from constructing synthetic clipboard data differently from the browser's real paste event.
- Corrected table-focused cross-browser run: 6 passed across Chromium, Firefox, and WebKit.
- Typecheck, ESLint, `vinext check`, production build, and `npm audit --audit-level=high`: passed; audit reported zero vulnerabilities.
- GitHub Actions usage: none. All complex browser, stress, build, and audit checks ran locally.

Remaining product gate: let the intended user recreate one real table and confirm whether plain text, headers, cell colors, alignment, spreadsheet paste, and row/column controls are enough. Formulas, typed fields, filtering, and database views remain explicitly out of scope.
