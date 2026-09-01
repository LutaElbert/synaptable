# SynapTable Audit Remediation Implementation Plan

**Created:** 2026-09-01  
**Source audit:** [`CURRENT_FEATURE_AUDIT.md`](./CURRENT_FEATURE_AUDIT.md)  
**Target product direction:** Local-first visual thinking that moves ideas between a free-form canvas and structured tables  
**Plan status:** Ready for implementation; no application behavior is changed by this document

## Implementation progress

Validated on `feat/audit-remediation-foundations` after the plan was written:

- [x] Preliminary graph-consistency fix: relative child/sibling creation inherits horizontal or vertical branch direction without rewriting existing connectors.
- [x] Phase 1 documentation and metadata alignment. First-run onboarding remains pending.
- [x] Phase 2A table-aware history budgeting with complete-snapshot estimation and focused max-table coverage.
- [x] Phase 2B storage inspection, explicit persistent-storage request, quota-specific save guidance, and count-plus-80-MB checkpoint pruning.
- [ ] Phase 3 local multi-project library.
- [ ] Phase 4 table-to-canvas conversion.
- [ ] Phase 5 table creation and discoverability.
- [ ] Phases 6–7 architecture and release validation.

Current validation: 99 unit tests pass; 201 Playwright cases produce 195 passes and 6 intentional skips across Chromium, Firefox, and WebKit; compatibility, typecheck, lint, production build, and dependency audit pass.

## 1. Objective

Bring the current implementation, product story, data model, and release evidence into alignment without expanding SynapTable into a spreadsheet or database product.

The work must:

1. accurately explain what SynapTable already does;
2. protect table-heavy local data and undo history;
3. support more than one local project without overwriting another;
4. complete the two-way canvas-to-table workflow;
5. improve table creation and discoverability;
6. preserve accessibility, local-only privacy, export behavior, and cross-browser support;
7. reduce architectural risk through incremental extraction after behavior is stable; and
8. produce reproducible release evidence without increasing routine GitHub Actions usage.

## 2. Product boundary

### In scope

- Product metadata, README, onboarding, and current roadmap alignment.
- Table-aware history sizing.
- Storage quota visibility, persistent-storage request flow, checkpoint byte budgets, and recovery messaging.
- A local multi-project library.
- Selected table rows/ranges to canvas concepts.
- Better table naming, size selection, keyboard creation, and spreadsheet-paste creation.
- Performance budgets, incremental editor decomposition, and documented release validation.

### Out of scope

- Formulas and calculations.
- Database property types, filters, grouping, alternate views, or relational records.
- Cloud sync, accounts, multiplayer collaboration, comments, and permissions.
- AI reconstruction or generation.
- Multi-page publishing or vector-text PDF redesign.
- Re-enabling image vectorization.
- A full editor rewrite or design-system replacement.

## 3. Delivery principles

- Use separate `feat/...`, `fix/...`, `docs/...`, `refactor/...`, or `chore/...` branches. Do not use a `codex/` branch prefix.
- Each pull request must preserve a runnable editor and include its own tests.
- Land safety fixes before adding more table data or project-management behavior.
- Keep project content local. Cloudflare remains an application host, not a project-content backend.
- Prefer native controls and native `<dialog>` for project-management and recovery flows.
- Preserve semantic `<table>` markup and existing keyboard/focus behavior.
- Keep frequently updated announcements in the existing centralized polite live region; reserve assertive announcements for immediate data-loss risk.
- Break up any main-thread task that exceeds 50 ms in representative stress fixtures; use a feature-detected yield strategy or worker only when measurement shows it is needed.
- Never mix architecture extraction with a user-facing behavior change in the same commit unless the extraction is required to make that change safe.
- Keep the expensive Chromium/Firefox/WebKit suite local. GitHub Actions continues to run the fast verification suite only.

## 4. Traceability from the audit

| Audit finding | Remediation phase | Required outcome |
| --- | --- | --- |
| P1-01 Product promise is stale | Phase 1 | Public copy and living docs match the enabled product. |
| P1-04 Table content omitted from history estimate | Phase 2 | Table-heavy history obeys the byte budget. |
| P1-05 Storage and checkpoint risk | Phase 2 | Quota-aware recovery and count-plus-byte checkpoint limits. |
| P1-02 One replaceable local document | Phase 3 | Safe local project library with migration. |
| P1-03 One-way canvas→table conversion | Phase 4 | Selected table content can produce canvas concepts. |
| P2-01 Table creation/discovery gaps | Phase 5 | Size picker, shortcut, paste-to-create, and unique names. |
| P2-03 Monolithic editor | Phase 6 | Incremental tested extractions with no behavior changes. |
| P1-06/P2-07 Release evidence gaps | Phase 7 | Recorded devices, assistive technology, export, and preview checks. |
| P2-04 Performance/bundle budgets | Phases 2, 6, and 7 | Measured thresholds and regression evidence. |
| P2-06 Dormant vectorization | Decision gate after Phase 1 | Archive/remove later, or explicitly retain as an experiment. |

### Preliminary graph-consistency fix

Before the remediation phases, make `Add child` and `Add sibling` follow the selected parent's established connector direction. Horizontal branches use right-to-left handles and a right-side child column; vertical branches use bottom-to-top handles and a lower child row. A connected parent with no children inherits its incoming direction, while an isolated parent keeps the vertical default. Creating a relative concept must not rewrite existing connectors.

**Acceptance criteria**

- [ ] Adding to an existing horizontal branch creates a horizontal connector and right-side layout.
- [ ] Adding to an existing vertical branch creates a vertical connector and lower-row layout.
- [ ] The first child of a connected parent continues the incoming connector direction.
- [ ] An isolated parent creates its first child below using bottom-to-top handles.
- [ ] Adding a child or sibling does not change any existing edge's handles, style, label, or endpoints.
- [ ] Pointer and keyboard branch actions share the same behavior and remain one undoable operation.

## 5. Sequenced implementation

## Phase 0 — establish the baseline

**Suggested branch:** `chore/audit-remediation-baseline`

### Work

1. Preserve the audit and this plan in the repository.
2. Record the starting commit, bundle sizes, automated results, intentional skips, and supported-browser policy.
3. Create one release-validation record template containing commit, build, browser/device, tester, date, and result.
4. Confirm that the existing full browser suite passes before feature work begins.

### Baseline evidence

- 99 unit tests pass.
- 201 Playwright cases are defined.
- Latest known full browser result: 195 pass and 6 intentional skips.
- `npm run check`, typecheck, lint, build, and high-level dependency audit pass.
- Current editor chunk: approximately 247 KB uncompressed and 72 KB gzip.
- Current dynamically loaded PDF-related chunk: approximately 511 KB uncompressed and 203 KB gzip.

### Acceptance criteria

- [ ] Baseline commands and their outputs are recorded against a commit.
- [ ] Every skip has a written reason and no unexpected skip is present.
- [ ] The working tree contains no unrelated generated files.
- [ ] A failed baseline blocks later implementation rather than being reclassified as expected.

## Phase 1 — align product language and onboarding

**Suggested branch:** `docs/canvas-table-product-direction`

### Work

1. Update `app/layout.tsx` metadata to the canvas-plus-table promise.
2. Rewrite the README feature inventory to include current table behavior and PNG/SVG/PDF/CSV export.
3. Correct recovery/migration documentation to schema version 6.
4. Label historical vectorization plans as archived implementation records.
5. Create one current roadmap that separates shipped, next, deferred, and rejected work.
6. Update the initial document or first-run guidance to demonstrate:
   - capture two or three ideas;
   - select the ideas;
   - organize the selection into a table;
   - edit the resulting table; and
   - back up or export the result.
7. Keep onboarding dismissible and non-blocking. Do not show it again after dismissal unless users explicitly reopen it.

### Implementation notes

- The page title should front-load the product identity, for example `SynapTable — Visual ideas, structured tables`.
- Onboarding must use ordinary buttons/links or a native dialog, maintain logical focus order, and return focus to the opener when closed.
- Do not imply cloud storage, AI, spreadsheet formulas, or database behavior.
- Decide after this phase whether dormant vectorization remains a named experiment or moves to archived code in a separate PR.

### Acceptance criteria

- [ ] Metadata, README, onboarding, privacy copy, and the current roadmap describe the same enabled product.
- [ ] No user-facing copy presents image vectorization as currently available.
- [ ] README documents tables, all four export formats, local backup, and schema-v6 migration.
- [ ] A new user can identify the ideas→table workflow without opening documentation.
- [ ] Onboarding is keyboard operable, dismissible, and does not trap focus.
- [ ] Existing users do not repeatedly receive first-run guidance.
- [ ] No application data is sent to a new service.

## Phase 2 — history and storage safety

**Suggested branches:**

- `fix/table-history-byte-budget`
- `feat/storage-quota-recovery`

### 2A. Table-aware history budgeting

#### Work

1. Extract history byte estimation and trimming from `Editor.tsx` into a pure `history-budget.ts` module.
2. Count all snapshot content:
   - document title;
   - nodes and edges;
   - raster data URLs;
   - concept rich text and metadata;
   - vector paths and styling;
   - table name, rows, columns, IDs, dimensions, header flags, cell rich text, tones, and alignment.
3. Keep the existing limits of 40 history entries and 48 MB unless measurements justify a smaller limit.
4. Avoid repeated full `JSON.stringify` work on every pointer move. Estimate when an undoable snapshot is committed, not during transient drag/resize updates.
5. Add a development-only diagnostic that can expose estimated entry count/bytes during stress testing without logging content.

#### Acceptance criteria

- [ ] A 2,000-cell rich-text table contributes materially to estimated history size.
- [ ] History trims oldest entries before exceeding 40 entries or the 48 MB estimate, while retaining at least the newest usable state.
- [ ] One drag or resize still creates one undo step.
- [ ] Undo and redo remain responsive after table-heavy edits.
- [ ] Estimation does not inspect or transmit user content outside the browser.

### 2B. Quota-aware checkpoints and recovery

#### Work

1. Add a storage-capability adapter with feature detection for:
   - `navigator.storage.estimate()`;
   - `navigator.storage.persisted()`; and
   - `navigator.storage.persist()`.
2. Continue working when those APIs are unavailable.
3. Set explicit checkpoint policies:
   - maximum 20 checkpoints per project;
   - maximum 80 MB aggregate checkpoint payload per project;
   - prune oldest checkpoints after a successful newer write;
   - reject a checkpoint that cannot fit without deleting the only known recovery point.
4. Estimate checkpoint bytes from the validated serialized project payload.
5. Show storage usage as approximate and never promise browser retention.
6. Request persistent storage only from a user-initiated settings/recovery action.
7. Detect quota-related failures and present an actionable message with buttons to:
   - download a project backup;
   - open checkpoint management; and
   - retry saving after space is freed.
8. Ensure a failed write never updates the state to “Saved on device.”

#### Acceptance criteria

- [ ] Unsupported storage APIs degrade to the existing local workflow without exceptions.
- [ ] Approximate usage and retention status are understandable and do not overstate guarantees.
- [ ] Checkpoints obey both count and byte limits.
- [ ] Oldest-first pruning is deterministic and tested.
- [ ] Quota errors preserve the in-memory document and offer backup before destructive cleanup.
- [ ] Persistent storage is never requested on page load.
- [ ] Save success is announced politely; immediate data-loss risk is announced assertively once.
- [ ] No project names or content appear in logs or telemetry.

## Phase 3 — local multi-project library

**Suggested branch:** `feat/local-project-library`

### User experience

- Replace the ambiguous destructive `New` action with `Projects` and a clear `New project` action.
- Open a native project-library dialog listing local projects by title and most-recent update.
- Support open, new, rename, duplicate, backup, and delete.
- Keep the active document open behind the modal until another project is successfully loaded.
- Use an explicit confirmation for permanent deletion. If a recoverable local trash is practical, retain deleted items for a bounded period; otherwise make the irreversible result unmistakable.
- Never silently switch projects while the active project has a failed autosave.

### Persistence design

Upgrade the IndexedDB database from version 3 to version 4 with the following logical model:

```text
documents
  existing key path: id
  value: { id: projectId, title, updatedAt, document }

checkpoints
  existing key path: id
  indexes: projectId, createdAt, [projectId, createdAt]
  value: { id: checkpointId, projectId, title, createdAt, bytes, document }

preferences
  key: name
  values include activeProjectId and onboarding state
```

Names may differ in code, but behavior and migration guarantees must remain.

### Migration

1. Version 4 keeps the existing `documents` and `checkpoints` key paths so migration never needs to delete either object store. It adds the preferences store and checkpoint indexes.
2. On first version-4 application load, detect the legacy `documents/current` record.
3. Validate it before migration.
4. Create one stable project ID and copy the document into the new record shape.
5. Associate existing checkpoints with the migrated project.
6. Set that project as active only after all required writes succeed in one transaction or a safely resumable sequence guarded by a migration marker.
7. Keep the legacy record until the new project and checkpoint records have been loaded and validated successfully. Cleanup may happen on a subsequent load.
8. If migration fails, leave legacy data readable by a recovery path and offer project backup; do not create a blank replacement silently.

### Project rules

- Project IDs are opaque and stable.
- Titles are not unique identifiers; duplicate titles are allowed but are disambiguated by update time.
- New projects start from a deliberate starter choice: blank canvas, idea map, or table.
- Duplicate creates independent node, edge, row, column, and cell IDs.
- Project switching commits/cancels active editors through the existing safe editing contract before saving.
- Checkpoints and autosave are always scoped to the active project ID.
- `.synaptable` import creates a new project by default; replacing an existing project requires an explicit alternate action.

### Acceptance criteria

- [ ] Two or more projects can be created, edited, closed, reopened, and distinguished.
- [ ] Creating or importing a project does not overwrite another project.
- [ ] Existing version-3 `current` data and checkpoints migrate exactly once without loss.
- [ ] Reload restores the last active project.
- [ ] Autosave cannot write one project's state into another project ID.
- [ ] Duplicate produces a deep independent copy.
- [ ] Deletion names the exact project, handles the active project safely, and returns focus predictably.
- [ ] Restore/import validation and the 40 MB project-file limit remain enforced.
- [ ] The project dialog supports keyboard-only operation and screen-reader navigation.
- [ ] Storage-quota failure leaves the current in-memory project available for backup.

## Phase 4 — complete table-to-canvas conversion

**Suggested branch:** `feat/table-to-canvas-conversion`

### Interaction contract

1. Show `Create canvas nodes` when one table, one or more rows, or a rectangular cell range is selected.
2. Convert one selected data row into one concept node.
3. Convert multiple selected rows into one concept node per row.
4. When a header row is enabled, use it as field labels and do not create a node from it unless explicitly selected as ordinary data.
5. Use the first selected non-header column as the concept title.
6. Put remaining selected non-empty cells into the concept body in column order as labeled blocks:

   ```text
   Column label
   Cell content
   ```

7. If a row has no usable title, use `Untitled row`; do not skip it silently.
8. Preserve supported rich marks and safe links. Unsupported cell structures must degrade to readable plain text rather than disappear.
9. Preserve the source table and selected cells.
10. Place generated nodes to the right of the table in a vertical, non-overlapping stack, adjusted to avoid existing node bounds.
11. Select the generated nodes after conversion and fit/reveal them only when they are outside the viewport; do not unexpectedly change zoom when already visible.
12. Treat the entire conversion as one undoable operation.

### Provenance

The initial version may store private source metadata (`sourceTableId`, row IDs, selected column IDs) on generated nodes only if schema validation, duplication, deletion, and migration are designed at the same time. Do not create visible connectors automatically.

If provenance would expand the schema significantly, defer it and ship deterministic conversion first.

### Acceptance criteria

- [ ] One row produces exactly one concept with deterministic title/body mapping.
- [ ] Multiple rows preserve table row order.
- [ ] Empty cells do not produce meaningless blank body blocks.
- [ ] An empty row still produces an identifiable `Untitled row` concept.
- [ ] Rich text, Unicode, emoji, RTL, line breaks, checklists, and safe links survive or degrade readably.
- [ ] Unsafe link protocols remain inert after conversion and export.
- [ ] Source table data and selection are unchanged.
- [ ] Generated nodes do not overlap each other or the table in the representative fixture.
- [ ] Undo removes all generated nodes in one step; redo restores the same content and positions.
- [ ] Locked tables expose no mutating conversion action.
- [ ] Keyboard and screen-reader users receive a concise completion announcement including node count.

## Phase 5 — table creation and discoverability

**Suggested branch:** `feat/table-creation-workflow`

### 5A. Unique default naming

- Choose the lowest available positive sequential label: `Table 1`, `Table 2`, and so on.
- Treat a renamed table as occupied only when its exact normalized name matches the generated pattern.
- Imported and duplicated table titles remain unchanged unless a collision would make the operation ambiguous; duplication may use `Copy of …`.

### 5B. Accessible grid-size picker

- Toolbar and layer-panel Table buttons open a compact 1–10 by 1–10 picker.
- Pointer hover/focus previews `R × C` without mutating the document.
- Arrow keys move the preview; Enter creates; Escape cancels and returns focus.
- A visible text summary announces the chosen size without relying on color.
- Provide number inputs or preset buttons as a touch/screen-reader fallback if the grid interaction is not reliable.
- Tables larger than 10×10 remain possible through later row/column insertion and spreadsheet paste.

### 5C. Keyboard shortcut

- `Shift+T` opens or creates the default table only while canvas focus is active.
- It must do nothing inside inputs, textareas, rich editors, table cells, dialogs, and other contenteditable controls.
- Display the shortcut in the button tooltip/help.

### 5D. Paste spreadsheet data onto empty canvas

- When clipboard text contains tabs or multiple rows and focus is on the canvas, offer/create a table at the pointer or viewport center.
- A single plain-text value continues following the current paste behavior and must not unexpectedly create a table.
- HTML table clipboard content may be used only after sanitization; TSV/plain text is the canonical fallback.
- Reject over-2,000-cell and over-2,000-character-cell input before mutation with a clear error.
- The entire creation is one undo step.

### Acceptance criteria

- [ ] Newly created tables have distinguishable default names in the canvas and layer list.
- [ ] Pointer, keyboard, touch fallback, and screen-reader paths can choose a table size.
- [ ] Cancelling the picker creates no history entry.
- [ ] `Shift+T` never interrupts text or cell editing.
- [ ] A spreadsheet grid pasted on canvas creates the correct rows, columns, and Unicode content.
- [ ] Oversized paste fails before creating a partial table.
- [ ] Table creation is one undoable operation and survives reload.
- [ ] Existing in-table paste behavior does not regress.

## Phase 6 — incremental architecture and performance work

**Suggested branches:**

- `refactor/editor-history-controller`
- `refactor/editor-export-controller`
- `refactor/editor-table-commands`
- `refactor/editor-panels`
- `refactor/editor-styles`

### Extraction order

1. History/persistence controller after Phase 2 tests are stable.
2. Project library controller after Phase 3 ships.
3. Table command and conversion controller after Phases 4–5 ship.
4. Export controller/dialog.
5. Layers and properties panels.
6. CSS ownership using component modules or documented cascade layers.

### Rules

- Preserve public behavior and persisted schemas.
- Do not rename accessible controls or test IDs without a documented reason.
- Keep extracted modules pure where possible.
- Do not introduce a global state library unless a measured problem cannot be solved with existing React patterns.
- Keep `pdf-lib` dynamically loaded.
- Measure before applying `content-visibility`, containment, memoization, or virtualization to React Flow/table content; canvas visibility and accessibility can be harmed by indiscriminate hiding.

### Initial budgets

| Metric | Initial budget |
| --- | --- |
| Editor application chunk | No more than 10% gzip growth from Phase 0 without an approved reason |
| PDF dependency | Remains outside the initial editor chunk |
| Common table edit INP | Under 200 ms on the representative desktop fixture |
| 2,000-cell table selection/edit response | Under 250 ms for a discrete action |
| Autosave serialization/write | Must not block the main thread for more than 50 ms continuously |
| History estimate/trim | Under 50 ms for the 2,000-cell fixture |
| Project switch | Visible busy feedback within 100 ms; completion or actionable error |

These are starting engineering budgets, not claims about every device. Record test hardware and revise only from measurements.

### Acceptance criteria

- [ ] Each extraction PR passes the unchanged characterization suite before new tests are added.
- [ ] No persistence, keyboard, focus, export, or undo behavior changes accidentally.
- [ ] Bundle and interaction measurements are recorded against Phase 0.
- [ ] Any budget regression has a documented product justification.
- [ ] The central editor component loses clearly owned responsibilities rather than merely moving JSX into equally coupled files.

## Phase 7 — release validation and operational readiness

**Suggested branch:** `chore/release-validation`

### Automated local gate

```sh
npm ci
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm audit --audit-level=high
```

### Manual environments

| Platform | Browser/assistive technology | Required coverage |
| --- | --- | --- |
| macOS | Safari + VoiceOver | Full keyboard/screen-reader core workflow and downloads |
| macOS/Windows | Chrome or Edge | Canvas/table interaction, large fixture, export, storage |
| Windows | Firefox + NVDA when available | Semantic tables, dialogs, project library, focus |
| iOS physical device | Safari + VoiceOver spot check | Panels, touch selection, edit, pan/zoom, backup/export |
| Android physical device | Chrome + TalkBack spot check | Panels, touch selection, edit, pan/zoom, backup/export |

### Cloudflare preview checks

- HTML/assets return correct MIME and cache headers.
- CSP permits required application behavior without unexpected violations.
- IndexedDB persists across reload and deploy revision.
- Project switching, backup/restore, PNG/SVG/PDF/CSV downloads work on the preview origin.
- No project content appears in Worker/request logs.
- Error reporting records operational failures without document names or content.
- The tested commit and rollback command are recorded before production deployment.

### Acceptance criteria

- [ ] All fast automated checks pass.
- [ ] Full local cross-browser results and skips are attached to the release record.
- [ ] Keyboard-only ideas→table→canvas→backup/export succeeds.
- [ ] Content/functionality remains available at 200% browser zoom.
- [ ] VoiceOver announces project dialog, table coordinates/selection, conversion completion, save errors, and export state coherently.
- [ ] Physical iOS and Android checks have no blocker in touch selection, resize alternatives, edit, scrolling, or pan/zoom.
- [ ] CSV opens correctly in Google Sheets and Excel with commas, quotes, newlines, Unicode, emoji, and RTL.
- [ ] PNG/SVG/PDF open in Preview, Chrome, and Safari; A4/Letter printing has no unexpected clipping.
- [ ] Preview-origin headers, persistence, privacy, downloads, observability, and rollback are verified.
- [ ] Production deployment remains a separate explicit approval step.

## 6. Detailed test plan

### Test priority definitions

- **P0:** Data loss, cross-project contamination, unsafe output, inaccessible core action, or editor crash.
- **P1:** Core workflow, undo/persistence, keyboard, export, or serious usability regression.
- **P2:** Secondary affordance, polish, diagnostics, or non-blocking edge case.

### A. Product messaging and onboarding

| ID | Priority | Test | Expected result |
| --- | --- | --- | --- |
| DOC-01 | P1 | Inspect page title, description, Open Graph, and Twitter metadata | All describe enabled canvas/table behavior; none advertises vectorization. |
| DOC-02 | P1 | Compare README feature list with visible UI | Tables, PNG/SVG/PDF/CSV, backup, and current schema are accurate. |
| ONB-01 | P1 | Open first-run experience with keyboard | Every action is reachable in logical order; Escape/Close returns focus. |
| ONB-02 | P1 | Dismiss onboarding and reload | It stays dismissed for that browser profile and can be reopened. |
| ONB-03 | P2 | Complete the demonstrated workflow | Instructions match actual labels and behavior. |
| ONB-04 | P1 | Run automated accessibility scan with onboarding open | No serious or critical violation. |

### B. History byte budgeting

| ID | Priority | Test | Expected result |
| --- | --- | --- | --- |
| HIS-01 | P0 | Estimate empty, concept, raster, vector, and table snapshots | Every supported kind contributes deterministic nonzero content bytes. |
| HIS-02 | P0 | Estimate a 2,000-cell table with 2,000-character cells | Estimate includes cell rich text and exceeds a structurally empty table. |
| HIS-03 | P1 | Add more than 40 small snapshots | Oldest entries trim to the count limit. |
| HIS-04 | P0 | Add table-heavy snapshots past 48 MB | Oldest entries trim by bytes while newest usable snapshot remains. |
| HIS-05 | P1 | Undo/redo after trim | Remaining history order and document states are correct. |
| HIS-06 | P1 | Drag/resize one table boundary | Exactly one history entry is committed. |
| HIS-07 | P1 | Measure estimate/trim on max table fixture | Operation meets the recorded performance budget. |

### C. Storage quota and checkpoints

| ID | Priority | Test | Expected result |
| --- | --- | --- | --- |
| STO-01 | P1 | Browser implements all StorageManager APIs | Usage, quota, and persisted state display accurately as approximate. |
| STO-02 | P1 | APIs are undefined or reject | Editor continues; unsupported state is explained without error loop. |
| STO-03 | P1 | Request persistent storage from explicit user action | Request occurs once per action and result is announced. |
| STO-04 | P0 | Simulate IndexedDB quota failure during autosave | Save remains failed, in-memory work remains, backup action is offered. |
| STO-05 | P0 | Create checkpoints over count limit | Oldest checkpoint prunes deterministically after successful save. |
| STO-06 | P0 | Create checkpoints over byte limit | Oldest eligible checkpoints prune; protected/latest recovery is not silently lost. |
| STO-07 | P1 | Single checkpoint exceeds policy | No partial checkpoint; clear message and backup alternative. |
| STO-08 | P1 | Delete checkpoint with keyboard | Correct item is removed and focus moves predictably. |
| STO-09 | P0 | Reload after failed checkpoint write | Last successfully saved project/checkpoints remain valid. |

### D. Multi-project migration and isolation

| ID | Priority | Test | Expected result |
| --- | --- | --- | --- |
| PRJ-01 | P0 | Upgrade a valid version-3 `current` document | One project is created with identical title, nodes, edges, and content. |
| PRJ-02 | P0 | Upgrade legacy checkpoints | All valid checkpoints associate with the migrated project in order. |
| PRJ-03 | P0 | Interrupt/fail migration | Legacy data remains recoverable; no blank project overwrites it. |
| PRJ-04 | P0 | Run migration twice | No duplicate projects/checkpoints and no second mutation. |
| PRJ-05 | P0 | Edit project A, switch to B, edit, reload A | Each project retains only its own state. |
| PRJ-06 | P0 | Switch while autosave is saving/fails | Switch waits or blocks with an actionable result; no cross-write occurs. |
| PRJ-07 | P1 | Create blank, idea, and table starters | Each starter creates the expected independent document. |
| PRJ-08 | P0 | Duplicate a project and edit nested table cells | Original is unchanged; all mutable IDs/state are independent. |
| PRJ-09 | P1 | Rename duplicate-titled projects | Both remain accessible and are disambiguated by metadata. |
| PRJ-10 | P0 | Delete inactive and active projects | Exact target is confirmed; active selection resolves safely. |
| PRJ-11 | P0 | Import a `.synaptable` file | A new project is created by default; existing projects remain unchanged. |
| PRJ-12 | P0 | Import corrupt/oversized project | No project is created or replaced; error is actionable. |
| PRJ-13 | P1 | Navigate project dialog by keyboard/screen reader | Names, update times, actions, focus return, and empty state are coherent. |
| PRJ-14 | P1 | Search/open among many projects | Selection and active state remain deterministic and responsive. |

### E. Table-to-canvas conversion

| ID | Priority | Test | Expected result |
| --- | --- | --- | --- |
| CNV-01 | P1 | Convert one selected data row | One concept uses first selected field as title and labeled remaining fields as body. |
| CNV-02 | P1 | Convert a rectangular range across multiple rows | One node per row, correct row/column order, only selected columns. |
| CNV-03 | P1 | Convert whole table with header row | Header labels fields; header is not emitted as data by default. |
| CNV-04 | P1 | Convert with header column enabled | Selected-column mapping remains deterministic. |
| CNV-05 | P1 | Convert empty and partially empty rows | No silent row loss; blank titles use `Untitled row`; empty fields are omitted. |
| CNV-06 | P0 | Convert rich Unicode/emoji/RTL/checklist/link cells | Content is preserved or readably degraded; unsafe links remain inert. |
| CNV-07 | P1 | Convert near existing nodes | Generated nodes form a non-overlapping stack and are selected. |
| CNV-08 | P0 | Undo then redo multi-row conversion | All generated nodes are removed/restored as one deterministic operation. |
| CNV-09 | P1 | Convert locked table | Action is absent/disabled and no mutation occurs. |
| CNV-10 | P1 | Convert with keyboard only | Action completes, focus remains useful, and count is announced. |
| CNV-11 | P1 | Reload after conversion | Generated concepts and original table persist. |
| CNV-12 | P1 | Export after conversion | SVG/PNG/PDF include expected visible content; source table is unchanged. |

### F. Table creation workflow

| ID | Priority | Test | Expected result |
| --- | --- | --- | --- |
| CRT-01 | P1 | Create three tables by toolbar/layer/template | Names are distinct and deterministic. |
| CRT-02 | P1 | Use grid picker with pointer | Preview and created dimensions match. |
| CRT-03 | P1 | Use grid picker with arrows and Enter | Selection is announced and correct table is created. |
| CRT-04 | P1 | Cancel picker with Escape/outside action | No table/history entry; focus returns to trigger. |
| CRT-05 | P1 | Use picker on phone/touch viewport | Fallback controls are reachable and do not require hover. |
| CRT-06 | P1 | Press `Shift+T` on canvas | Picker/default creation occurs as specified. |
| CRT-07 | P0 | Press `Shift+T` in concept/table/link editor/dialog | Text interaction is unaffected; no table is created. |
| CRT-08 | P1 | Paste 3×4 TSV on empty canvas | One 3×4 table is created at expected position with exact text. |
| CRT-09 | P1 | Paste one plain string | Existing non-grid paste contract remains; no surprise table. |
| CRT-10 | P0 | Paste more than 2,000 cells or an overlong cell | Mutation is rejected before any partial table/history state. |
| CRT-11 | P1 | Undo/reload pasted table | One-step undo and persistence are correct. |
| CRT-12 | P1 | Paste grid while editing an existing table | Existing in-table grid paste wins; no second table is created. |

### G. Regression coverage for existing table behavior

| ID | Priority | Test | Expected result |
| --- | --- | --- | --- |
| REG-01 | P0 | Cell edit, commit, cancel, Tab/Shift+Tab | Existing content and focus behavior remain unchanged. |
| REG-02 | P1 | Range/row/column/table selection | Selection levels remain distinct and accessible. |
| REG-03 | P1 | Internal and whole-table resizing | Limits, connector geometry, undo, and zoom behavior remain correct. |
| REG-04 | P1 | Pan/zoom with pointer over static table and editor | Static cells match other layers; active editor isolates its own scroll. |
| REG-05 | P1 | Copy/cut/paste TSV and HTML | Spreadsheet compatibility and escaping remain correct. |
| REG-06 | P1 | Insert/move/duplicate/delete rows/columns | Focus recovery and one-step history remain correct. |
| REG-07 | P0 | Backup/restore schema-v6 table | Rich content, styles, sizes, headers, and IDs restore safely. |
| REG-08 | P1 | PNG/SVG/PDF/CSV export | Scope, formats, Unicode, clipping, and disabled-state rules remain correct. |
| REG-09 | P1 | Search table content | Matching layer and exact cell reveal/focus behavior remain correct. |
| REG-10 | P1 | Locked/hidden table | Mutating controls and exports obey current visibility/lock contract. |

### H. Accessibility and responsive behavior

| ID | Priority | Test | Expected result |
| --- | --- | --- | --- |
| A11Y-01 | P0 | axe scan all new dialogs/states | No serious or critical automated violation. |
| A11Y-02 | P0 | Keyboard-only projects→table→canvas→export/backup | No unreachable action, focus loss, or trap. |
| A11Y-03 | P1 | 200% browser zoom | Essential controls remain visible/reachable; scrolling is available. |
| A11Y-04 | P1 | Reduced motion | No necessary information depends on animation. |
| A11Y-05 | P1 | Forced colors/high contrast | Selection, focus, errors, and active project remain distinguishable. |
| A11Y-06 | P0 | VoiceOver/NVDA project dialog | Project name, metadata, selection, actions, and errors are coherent. |
| A11Y-07 | P0 | VoiceOver/NVDA table conversion | Selection context, action, result count, and focus destination are coherent. |
| A11Y-08 | P1 | iOS/Android touch | Table selection/edit, fallback sizing, panels, scrolling, pan, and zoom work. |
| A11Y-09 | P1 | Accessible-name uniqueness | Repeated project/table actions are disambiguated by the target name. |

### I. Performance, security, export, and deployment

| ID | Priority | Test | Expected result |
| --- | --- | --- | --- |
| OPS-01 | P1 | Compare production chunks with baseline | Initial editor growth stays within budget or is justified. |
| OPS-02 | P1 | Record INP/task durations on max table | Editing, conversion, history, autosave, and switch meet budgets. |
| OPS-03 | P0 | Inspect network during all local workflows | No document/table/image content leaves the browser. |
| OPS-04 | P0 | Adversarial names/rich links/imports/exports | No script execution, unsafe navigation, or malformed output. |
| OPS-05 | P1 | Cloudflare preview headers and downloads | CSP/security/cache/MIME behavior supports every required workflow. |
| OPS-06 | P1 | PDF lazy loading | PDF dependency is absent before PDF export and loaded only on demand. |
| OPS-07 | P1 | CSV interoperability fixture | Sheets/Excel preserve quoting, line breaks, Unicode, emoji, and RTL. |
| OPS-08 | P1 | Print A4/Letter PDF fixture | Single-page visual limitation is clear; no unexpected clipping. |
| OPS-09 | P0 | Observe Worker/error logs during content operations | Logs contain no project names, cell text, images, or exported data. |
| OPS-10 | P1 | Roll back preview to prior tested commit | Documented rollback succeeds without changing local project data. |

## 7. Test execution strategy

### Unit tests

Add pure tests for:

- history byte estimates and trim policy;
- checkpoint byte pruning;
- storage capability fallbacks and quota-error classification;
- IndexedDB migration and project isolation;
- deep project duplication;
- table-range-to-concept mapping;
- table sequential naming;
- clipboard grid detection and limits; and
- performance-budget helpers.

Use a real IndexedDB-compatible test environment or focused browser integration tests for transaction and upgrade behavior; do not mock away transaction semantics in the only migration coverage.

### Component/integration tests

Cover dialog focus, project actions, storage messages, grid picker keyboard behavior, and conversion announcements. Prefer role/name queries over CSS selectors.

### Playwright

Keep critical P0/P1 workflows in Chromium, Firefox, and WebKit. Run expensive 500-layer and 2,000-cell budgets once in Chromium unless a cross-browser defect is discovered. Preserve screenshots/traces only on failure to control local artifact size.

### Computer-use/manual validation

Use real browser/device interaction for:

- screen readers;
- touch and trackpad behavior;
- 200% zoom and high contrast;
- native save/download/open dialogs;
- Google Sheets/Excel CSV import;
- Preview/Safari PDF, PNG, and SVG inspection; and
- Cloudflare preview-origin behavior.

Automation is evidence for repeatability, but it does not replace these manual checks.

## 8. Pull-request sequence and merge gates

| Order | Suggested branch | Scope | Merge gate |
| --- | --- | --- | --- |
| 1 | `chore/audit-remediation-baseline` | Audit/plan/baseline record | Current suite is green and evidence is recorded. |
| 2 | `docs/canvas-table-product-direction` | Copy, metadata, onboarding, roadmap | DOC/ONB tests and accessibility pass. |
| 3 | `fix/table-history-byte-budget` | History estimator extraction/fix | HIS tests and max-table stress pass. |
| 4 | `feat/storage-quota-recovery` | Storage adapter/checkpoint budget/recovery | STO tests pass across supported browsers. |
| 5 | `feat/local-project-library` | IndexedDB v4, migration, project UI | All PRJ P0/P1 tests and backup migration gate pass. |
| 6 | `feat/table-to-canvas-conversion` | Reverse conversion | CNV and table regression tests pass. |
| 7 | `feat/table-creation-workflow` | Naming, picker, shortcut, paste | CRT and table regression tests pass. |
| 8+ | `refactor/editor-*` | One extraction per PR | Characterization suite and budgets do not regress. |
| Final | `chore/release-validation` | Device, AT, export, preview evidence | Phase 7 acceptance criteria complete. |

Do not combine the multi-project migration with table conversion. They both touch editor state and persistence and would make rollback and defect isolation unnecessarily difficult.

## 9. Global definition of done

An implementation phase is complete only when:

- [ ] Its user-visible behavior and non-goals are documented.
- [ ] Every P0 and P1 test assigned to the phase passes.
- [ ] Undo, redo, autosave, reload, backup, restore, and export are checked where the phase mutates document state.
- [ ] Keyboard, focus, accessible names, live announcements, 200% zoom, reduced motion, and touch alternatives are checked where the phase adds UI.
- [ ] Corrupt, oversized, unsupported, and quota-limited inputs fail before partial mutation.
- [ ] No content is transmitted or logged.
- [ ] Production build and dependency audit pass.
- [ ] Bundle/performance changes are measured against the baseline.
- [ ] Cross-browser local results are recorded before merge for stateful editor changes.
- [ ] GitHub Actions remains the lean fast suite unless the team explicitly changes the quota policy.
- [ ] Product deployment is performed only after separate approval.

## 10. Recommended first implementation

Start with `fix/table-history-byte-budget` after committing the audit documents. It is the smallest high-priority code change, protects the newly expanded table feature, has a clear pure-test boundary, and lowers risk before the project-library migration begins.
