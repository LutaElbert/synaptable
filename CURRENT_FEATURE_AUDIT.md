# SynapTable Current Feature Audit

**Audit date:** 2026-09-01  
**Branch:** `feat/table-layer-mvp`  
**Commit reviewed:** `f648c5c`  
**Audit type:** Product fit, UX, accessibility, data safety, performance, architecture, testing, and release operations

## Executive conclusion

SynapTable is no longer just an image-to-layer experiment. It is already a capable local-first visual workspace with two complementary ways to think:

1. a free-form canvas for concepts, images, and connections; and
2. a structured table for organizing those ideas into rows and columns.

That combined workflow is the strongest product direction. The implementation is more mature than the current README, metadata, and older planning documents suggest. The table is an MVP-plus feature rather than a prototype: it has semantic markup, rich cell editing, range selection, row and column operations, resizing, clipboard support, conversion from canvas nodes, persistence, undo, search, connectors, and export.

The product is technically healthy enough to continue building. There is no P0 release blocker in the audited code. The main risks are that the product promise has not caught up with the implementation, the local data model still stores only one current project, and table-heavy documents can bypass the intended undo-memory budget. Those should be addressed before adding formulas, databases, collaboration, AI, or other large features.

### Recommended product promise

> **SynapTable is a local-first visual thinking workspace that turns free-form ideas into structured tables—and lets people keep both views connected on one canvas.**

This is more distinctive and accurate than the current “image to editable layers” positioning. SynapTable should remain a visual organizer, not attempt to become a spreadsheet or Airtable clone.

## Overall assessment

| Area | Status | Audit conclusion |
| --- | --- | --- |
| Core canvas workflow | Green | Mature selection, navigation, concepts, images, connectors, layers, and arrangement tools. |
| Table workflow | Green/Amber | Strong editing and structure controls; creation/onboarding and the return path from table to canvas remain incomplete. |
| Local persistence and recovery | Amber | Autosave, checkpoints, and portable backup exist, but only one live project is stored and quota handling is limited. |
| Export | Green/Amber | PNG, SVG, PDF, and CSV are well-scoped; PDF is intentionally rasterized and single-page, and manual interoperability checks remain. |
| Accessibility | Green/Amber | Strong semantics and automated coverage; real screen-reader, 200% zoom, and physical touch-device validation remain release gates. |
| Performance | Amber | Explicit document/table limits and stress tests exist; undo accounting omits table content and checkpoints have no byte budget. |
| Security and privacy | Green | Local-only content model, input validation, safe rich links, no application data backend, and useful Worker headers. |
| Architecture | Amber | Clear domain modules exist, but the 4,027-line editor component concentrates too many responsibilities. |
| Automated testing | Green | 99 unit tests and 201 browser cases are defined across Chromium, Firefox, and WebKit. |
| Product documentation | Red/Amber | README, page metadata, and readiness plans describe an older vectorization-first product. |
| Release operations | Amber | Lean CI and Cloudflare configuration are sensible; real preview-origin and device checks are not yet recorded as complete. |

## Current feature inventory

### 1. Canvas and navigation

**Implemented**

- Select and hand tools.
- Pointer, marquee, range, and select-all behavior.
- Mouse, trackpad, keyboard, and canvas controls for pan, zoom, and fit view.
- Double-click empty canvas to create a concept.
- Drag, resize, align, distribute, reorder, duplicate, hide, lock, and delete layers.
- Minimap, responsive side panels, and visible zoom state.
- Tidy layout and concept branch collapse.
- Undo and redo with an entry and estimated-memory cap.

**Product fit:** Strong. These behaviors support a spatial thinking tool and should remain foundational.

**Change recommended:** Add a clear empty-state tour that demonstrates the product loop—capture ideas, select them, organize them into a table, and continue working with the result. The current restored workspace can become crowded, while a first-time document starts as a concept-map example rather than teaching the table workflow.

### 2. Concept layers and rich text

**Implemented**

- Concept creation from toolbar, templates, double-click, child, and sibling actions.
- Rich title/body editing with bold, italic, underline, strikethrough, safe links, bullets, numbering, and checklists.
- Keyboard editing, commit, cancel, focus restoration, alignment, color, opacity, and resizing.
- Search across concept text.
- Branch creation, connection, collapse, and deterministic tidy behavior.

**Product fit:** Strong. Concepts are the natural capture side of the canvas-to-table workflow.

**Change recommended:** Keep concept editing focused. Avoid turning concept nodes into full documents; the table and canvas should remain fast to manipulate.

### 3. Image layers

**Implemented**

- Browse, drag/drop, and paste image import.
- Validation for type, file size, decoded dimensions, and pixel count.
- Local image storage, layer editing, branching, resize, persistence, backup, and export.
- Rejection of malformed or mislabeled image files.

**Product fit:** Strong as reference material. Images are useful inputs for research, storyboards, comparisons, and planning.

**Change recommended:** Present images as references, not as the main product promise. Add optional image captions or source notes only if a real workflow requires them.

### 4. Vector layers and image vectorization

**Implemented but hidden**

- Vector/path schema, renderer, export support, validation, worker, and editor code remain in the repository.
- `EDITOR_FEATURES.imageVectorization` is `false`.
- The built client still includes a vectorization worker asset of about 24 KB uncompressed.

**Product fit:** Unclear. It does not currently support the strongest canvas-to-table value proposition, and the public controls are disabled.

**Decision required:** Either move vectorization to an explicit later experiment or remove its runtime/code weight after confirming it is not on the roadmap. Do not continue advertising it while it is disabled.

### 5. Connectors and graph behavior

**Implemented**

- Connections between supported node kinds, including all sides of a table.
- Connection validation, reconnection, deletion, cascade behavior, undo/redo, labels, and visual styles.
- Geometry updates after node and table resizing.
- Cycle support with duplicate/self-edge protection.

**Product fit:** Strong. Connections preserve context that conventional spreadsheets lose.

**Change recommended:** In a later phase, preserve provenance between a source concept and a generated table row without forcing a visible connector. This could be lightweight metadata surfaced through “Go to source” and “Reveal organized row.”

### 6. Table layers

**Implemented**

- Default 3×3 creation from the toolbar, layer panel, and quick-template menu.
- Semantic HTML table, caption, headers, rows, columns, and cells.
- Table, row, column, single-cell, and rectangular range selection.
- Double-click, printable-key, Enter/F2, Tab, Shift+Tab, arrow, Home/End, Escape, and commit behavior.
- Rich text in cells: bold, italic, underline, strikethrough, lists, checklists, and safe links.
- Cell tones and horizontal alignment.
- Spreadsheet-style TSV/HTML copy, cut, and grid paste inside a table.
- Insert, duplicate, delete, and move row/column commands.
- Row/column resize and proportional whole-table resize.
- Optional header row and header column.
- Lock, hide, duplicate, move, search, undo, persist, restore, connect, and export behavior.
- Hard limits of 100 rows, 30 columns, 2,000 cells, and 2,000 characters per cell.
- Convert selected canvas nodes into table rows while preserving the originals.

**Product fit:** Very strong. This is now a core feature, not a secondary experiment.

**Gaps compared with the table behavior plan**

- No grid-size picker at creation time.
- No `Shift+T` canvas shortcut.
- Pasting a spreadsheet grid onto empty canvas does not create a table.
- Row and column reordering uses inspector commands rather than direct drag reordering.
- There is no reverse action to extract a selected table row or range back into canvas nodes.
- Repeated tables all use the default name “New table,” which makes the layer list ambiguous.

The missing reverse conversion is the most important gap because it prevents the promised two-way workflow.

### 7. Layers, search, and properties

**Implemented**

- Search across layer names, concept notes, and table cells.
- Layer selection, visibility, locking, naming, and ordering.
- Selection-aware properties for individual and bulk operations.
- Dedicated row/column/table commands and size controls.
- Responsive open/close behavior for panels.

**Product fit:** Strong.

**Change recommended:** Generate meaningful sequential table names (`Table 1`, `Table 2`) or prompt for a title after creation. Search results that match a table cell should continue revealing and focusing the exact cell; this behavior deserves a visible user affordance in addition to test coverage.

### 8. Local persistence, checkpoints, and project backup

**Implemented**

- IndexedDB autosave with visible saving/saved/failed state.
- Schema version 6 validation and migration.
- Up to 20 full-document checkpoints.
- Portable `.synaptable` download and validated restore.
- Corruption and oversized-project rejection.
- Project limits: 40 MB backup file, 2,500 nodes, and 5,000 edges.
- Destructive new-project and restore confirmations.

**Product fit:** Local-first is a meaningful differentiator and appropriate for private planning.

**Critical gaps**

- IndexedDB uses one fixed document key, `current`. “New” replaces the only live project; users must manually download backups to maintain multiple projects.
- The application does not request persistent storage or show `navigator.storage.estimate()` information.
- Checkpoints retain at most 20 entries but have no aggregate byte cap. Each entry contains a full document, including images and table content.
- Save failure is visible, but quota-specific recovery guidance is not surfaced.

The UI should either clearly state “one local workspace” everywhere or implement a lightweight local project library. Given the product name and the presence of “New,” a local project library is the better fit.

### 9. Export

**Implemented**

- Scopes: visible canvas, selected layers, and selected table cells.
- Formats: PNG, SVG, PDF, and CSV.
- Background, padding, scale, PDF page size/orientation/margin, and selection-aware availability.
- Canonical data-driven SVG rendering, so panels, selection outlines, zoom, and transient DOM controls do not leak into exports.
- Raster dimension/pixel safety limits.
- PDF generation is dynamically imported.
- Accessible native dialog and progress/error feedback.

**Product fit:** Strong for sharing a result without requiring cloud storage.

**Known limitation:** PDF is a high-resolution PNG embedded into exactly one PDF page. Text is not selectable, very large canvases can become small on A4/Letter, and multi-page/tiled printing is not supported. This is acceptable for the current scope if the UI and documentation describe it honestly.

**Manual validation still needed:** Open SVG/PNG/PDF in Preview, Chrome, and Safari; import CSV into Google Sheets and Excel; print representative A4/Letter PDFs; verify Unicode/emoji/RTL; and validate the dialog with VoiceOver.

### 10. Privacy, security, and Cloudflare Worker

**Implemented**

- User canvas data stays in browser storage unless explicitly downloaded.
- No D1, R2, account system, or server-side project storage.
- Cloudflare Worker serves the application shell/assets and adds security headers.
- Content Security Policy, HSTS, MIME sniffing protection, frame protection, referrer policy, and permissions policy are configured.
- Project files and rich text are validated; links are sanitized; generated SVG is escaped.
- Production error boundaries avoid logging user content.
- Dependency audit currently reports zero known vulnerabilities.

**Product fit:** Strong.

**Change recommended:** Document why `unsafe-inline` is currently needed in the CSP and re-evaluate it when the Vinext/Next runtime permits. Add an explicit privacy statement near backup/restore explaining that Cloudflare receives standard request metadata but not project content.

### 11. Responsive behavior and accessibility

**Implemented**

- Skip link, semantic landmarks, accessible control names, native dialogs, live status, focus restoration, and table semantics.
- Keyboard access to core canvas, concept, table, backup, and export workflows.
- Reduced-motion and enlarged-text browser checks.
- Phone viewport behavior for panels.
- Non-color selection cues and table hit-target checks at zoom extremes.

**Product fit:** Strong and unusually mature for this stage.

**Remaining release evidence**

- VoiceOver on macOS/iOS and at least one Windows screen reader.
- Browser zoom at 200% with no clipped essential actions.
- Physical iOS Safari and Android Chrome touch interaction, especially table selection, resize handles, scrolling, and canvas pan/zoom.
- High-contrast/forced-colors verification beyond the Chromium-only automated case.
- Keyboard-only completion of an end-to-end “ideas → table → export/backup” workflow.

### 12. Testing and CI

**Current evidence**

- `npm run check`: 100% Vinext compatibility, 0 issues.
- `npm test`: 12 files and 99 tests passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- Playwright defines 201 cases across Chromium, Firefox, and WebKit.
- The latest full local browser run associated with this branch recorded 195 passes and 6 intentional skips.
- Stress coverage includes 500 layers/800 connectors and a 2,000-cell table boundary in Chromium.
- CI runs only on pull requests and pushes to `main`, cancels superseded runs, has a 10-minute timeout, and intentionally omits the expensive cross-browser suite.

**Product fit:** The lean CI setup respects the GitHub Actions quota decision while retaining strong local verification.

**Gaps**

- Stress budgets run only in Chromium.
- No retained performance trend or bundle budget alerts regressions over time.
- The cross-browser suite is a local convention rather than a protected merge requirement.
- Manual screen-reader, physical-device, and export interoperability results are not maintained in one release record.

**Recommendation:** Keep CI lean. Add a versioned local release checklist and attach the final Playwright report or summary to each release/PR instead of moving the entire browser matrix into GitHub Actions.

### 13. Architecture and maintainability

**Strengths**

- Table logic, persistence, schema validation, export, graph rules, rich text, layout, and image validation have dedicated modules and unit tests.
- Limits and migrations are explicit.
- Export rendering is separated from transient DOM state.
- Feature switches isolate unfinished product directions.

**Risks**

- `app/editor/Editor.tsx` is 4,027 lines and owns canvas state, history, persistence orchestration, commands, imports, exports, dialogs, shortcuts, selection, and inspectors.
- `app/globals.css` is 1,514 lines, increasing the chance of selector collisions and making component ownership difficult to see.
- `TableNode.tsx` and `table-grid.ts` are each over 550 lines and continue growing.
- Old vectorization code and historical plans increase cognitive and shipped asset overhead despite the feature being disabled.

**Recommendation:** Do not do a broad rewrite. After the table behavior is frozen, extract one responsibility at a time behind existing tests:

1. editor persistence/history controller;
2. export controller and dialog;
3. table command controller;
4. selection/keyboard controller;
5. properties and layers panels;
6. component-scoped CSS modules or clearly separated cascade layers.

## Prioritized findings

### P0 — release blockers

None found in the audited state.

### P1 — address before expanding scope

#### P1-01: Align the product promise with the actual product

**Evidence:** Page metadata says “Image to editable layers,” the README foregrounds concepts/images/vectors and SVG-only export, and the production plan contains stale test counts and no table release path. Vectorization is disabled while tables are enabled.

**Impact:** New users, contributors, judges, and future implementation decisions receive the wrong product signal.

**Acceptance criteria**

- Metadata, README, privacy copy, onboarding, and screenshots describe the canvas-to-table workflow.
- The README lists current table, PNG, PDF, CSV, and schema-v6 capabilities.
- Historical vectorization plans are labeled archived or moved to an archive folder.
- One living roadmap identifies what is shipped, next, and deferred.

#### P1-02: Decide and implement the local project model

**Evidence:** Persistence stores one document under the fixed key `current`; “New” clears that document.

**Impact:** Users can unintentionally replace their only live workspace and cannot naturally manage more than one project.

**Recommendation:** Implement a local project library with stable project IDs, title, updated time, small preview, duplicate, rename, delete-to-recoverable-trash, and open actions. Keep portable backup independent.

**Acceptance criteria**

- Creating a project does not overwrite another project.
- Users can identify, open, rename, duplicate, back up, and delete projects.
- Deletion has explicit confirmation and a recoverable path where practical.
- Existing `current` data migrates once without loss.
- Autosave and checkpoints are scoped by project ID.

#### P1-03: Complete the two-way canvas↔table workflow

**Evidence:** Selected canvas nodes can become rows while originals remain; no table row/range extraction to canvas nodes exists.

**Impact:** The feature differentiator currently ends after organization instead of supporting iterative visual thinking.

**Acceptance criteria**

- A selected row or range can create canvas concept nodes with a predictable field mapping.
- The action is one undoable operation and preserves the table.
- New nodes appear without overlap and remain selected.
- Rich text is converted without unsafe links or silent data loss.
- Optional source provenance can reveal the originating row/node without mandatory visible connectors.

#### P1-04: Fix table-aware undo-memory accounting

**Evidence:** `estimateSnapshotBytes()` counts generic node overhead plus raster, concept, and vector content, but does not count table rows, columns, cell IDs, rich text, or styles.

**Impact:** Table-heavy histories can exceed the intended 48 MB limit, creating avoidable memory pressure or browser instability.

**Acceptance criteria**

- The estimator includes table structure and serialized rich cell content.
- Unit tests cover a near-2,000-cell table and prove history is trimmed by bytes.
- A stress test records peak history size and verifies undo remains responsive.

#### P1-05: Harden browser-storage behavior

**Evidence:** Checkpoints are limited by count only; storage persistence and quota estimates are not used; a quota failure results in a generic save failure.

**Impact:** Large images, tables, and 20 full-document checkpoints can exhaust browser storage without actionable recovery guidance.

**Acceptance criteria**

- The app reports approximate local storage use and warns before critical pressure.
- `navigator.storage.persist()` is requested in an appropriate user-driven recovery/settings flow where supported.
- Checkpoints have both count and aggregate-byte limits.
- Quota errors explain how to download a backup and safely free space.
- Autosave never claims success after a failed write.

#### P1-06: Close real-device and assistive-technology release gates

**Evidence:** Automated semantics are strong, but the readiness plan still lacks recorded physical iOS/Android, screen-reader, PDF print, and spreadsheet-import evidence.

**Acceptance criteria**

- A versioned release checklist records browser/device/assistive-technology, commit, date, tester, and result.
- Table resize, selection, edit, copy/paste, pan/zoom, export, backup, and restore pass on representative mobile and desktop environments.
- Any unsupported interaction has an accessible alternative and is documented.

### P2 — improve after P1 foundations

#### P2-01: Improve table creation and discovery

- Add a keyboard-accessible grid-size picker.
- Add `Shift+T` only if it does not conflict with text editing.
- Offer “Paste spreadsheet data” on an empty canvas to create a table.
- Generate distinct default names and focus the caption/name after creation when appropriate.
- Add table-first templates such as comparison, weekly plan, decision matrix, and shot list.

#### P2-02: Consolidate stale and conflicting plans

The table behavior plan correctly lists some missing features, while older implementation/readiness plans still center vectorization. Preserve completed plans as records, but maintain one current product roadmap and one release checklist.

#### P2-03: Decompose the editor incrementally

Use existing tests as characterization tests. Extract controllers and panels without changing behavior, one PR at a time. Avoid mixing architecture refactoring with new table capability.

#### P2-04: Set performance and bundle budgets

The current production output includes an editor chunk around 247 KB uncompressed/72 KB gzip, an initial framework/index chunk around 194 KB/56 KB gzip, and a dynamically loaded PDF-related chunk around 511 KB/203 KB gzip. Define budgets for initial interaction, large-document pan/zoom, autosave, and export so future additions have an explicit cost.

#### P2-05: Clarify export limitations and complete interoperability QA

Keep the current PDF implementation for now, but label it “single-page visual PDF.” Consider multi-page tiling or selectable vector text only when users demonstrate a real print/document need.

#### P2-06: Archive or remove dormant vectorization scope

If vectorization is not on the next two milestones, move its plans to an archive and consider removing the client worker and UI branches. Retain project-file compatibility for existing vector nodes.

#### P2-07: Verify the real Cloudflare preview origin

Record CSP behavior, asset MIME/cache headers, IndexedDB persistence, downloads, error reporting, and rollback steps on the deployed preview before production promotion.

## Keep, change, defer, and avoid

### Keep

- Local-first, no-account workflow.
- Free-form concepts, images, and connectors.
- Semantic visual tables rather than a database engine.
- Rich but bounded content editing.
- Canvas-node-to-table conversion.
- Search, layers, locks, backup/restore, checkpoints, and scope-aware export.
- Lean GitHub Actions plus comprehensive local browser testing.

### Change next

- Product language and onboarding.
- Single-document persistence model.
- One-way conversion into a two-way workflow.
- Table-aware history/storage limits.
- Default table naming and creation experience.
- Living documentation and release evidence.
- Editor module boundaries after behavior stabilizes.

### Defer until the core loop proves demand

- Formulas and calculations.
- Typed database fields, sorting, filtering, grouping, and alternate views.
- Cloud sync, accounts, and real-time collaboration.
- AI-generated content or reconstruction.
- Comments, permissions, and team administration.
- Multi-page document publishing.
- PWA/offline packaging beyond the existing local-first browser behavior.

### Avoid

- Rebuilding Google Sheets inside the canvas.
- Adding a backend merely because Cloudflare Worker exists.
- Shipping a hidden experimental feature in marketing copy.
- Adding more editor behavior directly to the monolithic component without first identifying an extraction boundary.
- Treating automated accessibility checks as a replacement for real assistive-technology testing.

## Recommended implementation sequence

### Phase 1 — product alignment and safety

1. Update the product promise, metadata, README, and onboarding.
2. Fix table-aware history estimation.
3. Add checkpoint byte limits and quota-specific recovery messaging.
4. Decide and specify the local multi-project model.

**Exit gate:** The public story matches the UI, table-heavy undo respects its memory budget, and a save failure provides a safe recovery action.

### Phase 2 — complete the differentiating workflow

1. Implement table-row/range-to-canvas conversion.
2. Add stable source mapping if user testing shows it is useful.
3. Improve default names, creation sizes, and spreadsheet-paste-to-table.
4. Add focused templates for the intended audiences.

**Exit gate:** A user can complete and undo `ideas → table → canvas ideas` without losing content or creating overlapping nodes.

### Phase 3 — local project library

1. Migrate from `current` to stable project IDs.
2. Add project list, open, rename, duplicate, and delete/recovery behavior.
3. Scope autosave and checkpoints per project.
4. Preserve `.synaptable` portability.

**Exit gate:** Two or more projects can be created and reopened without manual backup juggling or data replacement.

### Phase 4 — release evidence and maintainability

1. Run and record physical-device, screen-reader, export interoperability, and preview-origin checks.
2. Introduce performance and bundle budgets.
3. Extract editor responsibilities behind passing tests.
4. Archive or remove dormant vectorization implementation.

**Exit gate:** Release evidence is reproducible and the editor can accept new work without further increasing the central component's responsibility.

## Audit verification record

The audit used source inspection, repository documentation, local build artifacts, automated checks, and live browser inspection at `http://localhost:3000`.

Observed in the running application:

- the browser-local workspace restored correctly;
- semantic table roles, captions, headers, cells, and accessible names were present;
- skip link, canvas landmarks, named controls, and native dialogs were exposed;
- export scope/format controls correctly disabled unavailable choices;
- backup/restore and checkpoint information was understandable;
- multiple default-named tables were indistinguishable in the layer list;
- the singleton restored workspace had accumulated overlapping QA content, reinforcing the need for project management and stronger organization/onboarding.

Commands run during this audit:

```sh
npm run check
npm test
npm audit --audit-level=high
npx playwright test --list
```

Results:

- compatibility check: pass;
- unit tests: 99/99 pass;
- dependency audit: 0 vulnerabilities;
- browser cases defined: 201;
- working tree before this report: clean;
- product behavior changed by this audit: none.

## Definition of audit closure

This audit is considered acted upon when:

- every P1 item has an owner and target milestone;
- current product documentation no longer advertises disabled vectorization as the primary value;
- the team has explicitly chosen one-workspace or multi-project behavior;
- table content is included in memory and storage safety limits;
- the two-way canvas/table workflow is either scheduled or deliberately rejected with user evidence;
- physical-device, screen-reader, export, and deployed-preview results are recorded;
- P2 items are prioritized from user evidence rather than implemented as an undifferentiated backlog.
