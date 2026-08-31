# SynapTable table behavior and testing plan

> Status: proposed product specification for the next table refinement pass.
>
> Scope: a canvas-native visual table for comparisons, schedules, lists, planning, and lightweight organization. It is not a spreadsheet or database.
>
> Relationship to the code: the repository already contains a working version 5 table layer. This document defines the intended behavior in full, identifies gaps in that baseline, and provides the test plan required before merge.

## 1. Product outcome

A SynapTable table should feel like a natural combination of a canvas object and a lightweight document table:

- From the canvas, it moves, resizes, connects, locks, hides, duplicates, exports, and participates in undo like any other layer.
- Inside the table, cells are quick to select, edit, navigate, paste, style, and reorganize.
- The selection level is always obvious: whole table, row/column, cell range, or text editing.
- Structural operations never silently discard data.
- Keyboard and touch users can complete the same work as pointer users.
- Table state survives autosave, reload, checkpoints, backup/restore, and SVG export.

The core workflow is:

```text
Loose canvas ideas or spreadsheet data
                    ↓
            Create a visual table
                    ↓
       Select, edit, resize, and organize
                    ↓
     Continue connecting it to the canvas
```

## 2. Inspiration and decisions

### Google Docs and Microsoft Word: document-grade structure

Useful patterns:

- Explicit **insert above/below/left/right** commands relative to the active cell.
- Direct row and column boundary dragging.
- Exact numeric width and height controls.
- **Distribute rows** and **Distribute columns** commands.
- Drag-to-reorder rows and columns.
- Fit-to-content or AutoFit commands.

SynapTable decision:

- Adopt explicit directional insert commands, direct boundary resizing, exact inspector sizing, distribute commands, and accessible move buttons.
- Do not adopt pagination-specific features such as repeated page headers or row page-break control because SynapTable has an infinite canvas rather than pages.

References:

- [Google Docs: add and edit tables](https://support.google.com/docs/answer/1696711?hl=en-GB)
- [Microsoft Word: resize a table, column, or row](https://support.microsoft.com/en-US/Word/resize-a-table-column-or-row)
- [Microsoft Word: add a cell, row, or column](https://support.microsoft.com/en-us/word/add-a-cell-row-or-column-to-a-table-in-word)

### FigJam and Figma Slides: canvas-native interaction

Useful patterns:

- A table is first selected as one canvas object; a subsequent action drills into cells.
- Cell, row, column, and multi-cell selections are visually distinct.
- Table corners resize the entire object; internal borders resize rows and columns.
- Edge bars and inline plus controls add rows or columns where the user is working.
- `Tab` and `Shift+Tab` navigate cells.
- Spreadsheet paste creates or expands a table.
- Selected rows and columns can be duplicated and reordered.

SynapTable decision:

- Use a two-level canvas/table selection model and direct-manipulation handles.
- Support rectangular range selection, row selection, and column selection before adding rich text or merged cells.
- Preserve spreadsheet-shaped paste and automatic grid expansion.

References:

- [Figma: tables in FigJam](https://help.figma.com/hc/en-us/articles/12583849250199-Tables-in-FigJam)
- [Figma: add tables to slides](https://help.figma.com/hc/en-us/articles/30600895164439)
- [Figma accessibility: edit tables with a keyboard](https://help.figma.com/hc/en-us/articles/35063862380311-Accessibility-at-Figma)

### Notion: simple-table product boundary

Useful patterns:

- Simple tables are for plain-text presentation and brainstorming.
- Header rows/columns, cell color, row/column insertion, drag reordering, and fit-width behavior are enough for many document tables.
- Sorting, filtering, typed properties, relations, formulas, and multiple views signal a database rather than a simple table.

SynapTable decision:

- Keep cells plain text in this release.
- Defer database features even if the visual treatment resembles a spreadsheet.
- Treat requests for filtering, typed status/date fields, formulas, and alternate views as a separate structured-data project.

References:

- [Notion: simple tables versus databases](https://www.notion.com/help/guides/simple-tables-vs-databases)
- [Notion: simple-table controls](https://www.notion.com/help/columns-headings-and-dividers)

### Miro: canvas-to-table workflows and limits

Useful patterns:

- A grid can accept spreadsheet content and resize cells to fit.
- Row and column handles support adding, moving, coloring, resizing, and deleting.
- Canvas objects can become table records and records can return to the canvas.
- Explicit limits protect board performance.

SynapTable decision:

- Keep the existing non-destructive **Organize selected layers into a table** workflow.
- Preserve the 2,000-cell limit and measure behavior at that boundary.
- Defer synced records, typed fields, grouping, calculations, and timeline views.

References:

- [Miro Grid](https://help.miro.com/hc/en-us/articles/360011986519-Grid)
- [Miro Tables](https://help.miro.com/hc/en-us/articles/22760922335506-Tables)

### Accessibility: semantic table plus managed interaction

Useful patterns:

- Native table markup gives header/data relationships to assistive technology.
- Interactive grids need a short page tab sequence and managed arrow-key focus.
- `Enter` or `F2` conventionally changes from grid navigation to editing; `Escape` returns to navigation.

SynapTable decision:

- Keep a real `<table>`, `<caption>`, `<thead>`, `<tbody>`, `<th scope>`, and `<td>` structure.
- Use one roving `tabIndex=0` cell and managed arrow-key navigation.
- Run a focused browser/assistive-technology spike before deciding whether adding `role="grid"` improves or harms announcements. Do not change roles based on theory alone.

References:

- [W3C APG: interactive grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [W3C WAI: accessible tables tutorial](https://www.w3.org/WAI/tutorials/tables/)

## 3. Scope

### Required for the refined visual-table release

- Create a default table and optionally choose an initial grid size.
- Whole-table canvas selection and manipulation.
- Individual cell, row, column, and rectangular range selection.
- Plain-text editing with multiline content.
- Keyboard navigation and predictable focus restoration.
- Direct and inspector-based row/column insertion, deletion, duplication, movement, and resizing.
- Whole-table proportional resizing.
- Header row and header column.
- Cell/range background color and horizontal alignment.
- Spreadsheet copy, cut, and paste.
- Table creation from selected canvas layers.
- Search, persistence, undo/redo, backup/restore, and SVG export.
- Desktop pointer, keyboard-only, mobile, touch, zoom, and accessibility support.

### Explicitly deferred

- Formulas and calculations.
- Sorting, filtering, grouping, and database views.
- Typed columns such as status, date, currency, person, select, or relation.
- Merged cells in the first refinement pass.
- Rich text, images, attachments, nested nodes, or widgets inside cells.
- Frozen panes or internal virtual scrolling.
- Real-time collaboration.
- Live synchronization between a row and a canvas node.
- XLSX parsing. Clipboard and optional CSV import are sufficient for the visual-table product.

## 4. Interaction state model

Only one primary table interaction state exists at a time:

```ts
type TableInteraction =
  | { mode: 'table'; nodeId: string }
  | { mode: 'cell'; nodeId: string; anchor: CellAddress; focus: CellAddress }
  | { mode: 'row'; nodeId: string; rowIds: string[] }
  | { mode: 'column'; nodeId: string; columnIds: string[] }
  | { mode: 'editing'; nodeId: string; cell: CellAddress };
```

This state is ephemeral. It is not serialized and does not enter undo history.

### Selection ladder

1. Clicking an unselected table selects the whole table.
2. Clicking a cell in an already selected table selects the cell.
3. Double-clicking a cell, or pressing `Enter`/`F2` on it, starts editing.
4. `Escape` moves up one level:
   - editing → selected cell, restoring the pre-edit text;
   - cell/range/row/column → whole table;
   - whole table → no selection.
5. Clicking the caption/frame returns to whole-table selection.
6. Clicking the canvas clears table and cell selection.

This prevents an attempt to move a table from unexpectedly placing a text caret inside it.

## 5. Creation behavior

### Entry points

- Canvas toolbar: **Table**.
- Layer-panel add menu: **Table**.
- Quick template: **Table 3 × 3**.
- Keyboard shortcut: `Shift+T`, when focus is on the canvas and not inside a text field.
- Paste spreadsheet data onto empty canvas: create a table matching the clipboard matrix. This is P1 after in-table paste is proven stable.
- Multi-selection action: **Organize into table**.

### Initial size picker

Preferred behavior:

- Clicking Table opens a compact 1–10 by 1–10 grid picker.
- Pointer hover previews the size; click commits it.
- Keyboard users move with arrow keys and press `Enter`.
- A simple click or `Enter` with no choice creates the default 3 × 3 table.
- Default: 120-pixel columns, 44-pixel rows, header row enabled.

### Placement

- Toolbar creation centers the table in the currently visible canvas viewport.
- Paste creation uses the pointer/caret location or viewport center.
- Selection conversion places the new table beside the selection bounds, not directly over the originals.
- Creation is one undo operation.

## 6. Whole-table canvas behavior

When `mode === 'table'`:

- Drag the caption, frame, or non-cell padding to move the table.
- Corner handles proportionally resize every column and row.
- Side handles resize the overall width or height while distributing the delta proportionally.
- Connector handles belong to the outer table only; cells never become graph endpoints.
- Generic canvas commands work: move, align, tidy, hide, lock, duplicate, delete, layer order, undo, redo, search, export.
- Duplicate regenerates table, row, column, and cell IDs.
- Lock removes editing and structural controls but keeps readable table semantics.
- When multiple canvas layers are selected, table-specific resize and cell handles disappear.

## 7. Cell, range, row, and column selection

### Single cell

- Single click in an already selected table chooses one cell.
- The selected cell receives a high-contrast inset outline and is the only table cell in the page tab order.
- The inspector shows its row, column, text alignment, background, width, and height context.

### Rectangular range

- `Shift+click` extends from the anchor cell to the clicked cell.
- `Shift+Arrow` extends the range by one cell.
- A translucent fill plus strong perimeter shows the range; it must remain distinguishable in grayscale and high-contrast modes.
- Styling, copy, cut, clear, and paste apply to the range.
- Discontiguous cell selection is deferred.

### Row and column

- A row grabber appears on the left; a column grabber appears above.
- Clicking a grabber selects the entire row/column.
- `Shift+click` on another grabber selects a contiguous set.
- Selected rows/columns expose insert, duplicate, move, distribute, color, clear, and delete commands.
- Structural delete is only available from explicit row/column controls, never from an ambiguous cell `Delete` key.

### Delete and Backspace rules

- Cell/range mode: clear cell contents, preserving structure and styling unless **Clear formatting** is chosen.
- Editing mode: ordinary text deletion.
- Row/column mode: `Delete` clears the selected rows' or columns' cell contents; only the explicit **Delete rows/columns** command removes structure.
- Table mode: delete the table layer using the existing canvas command.
- Locked table: no destructive action occurs.

## 8. Editing and keyboard contract

| Context | Key | Result |
| --- | --- | --- |
| Whole table | `Enter` | Enter the last active cell, otherwise the first cell |
| Selected cell | Arrow keys | Move focus one cell; stop at the boundary |
| Selected cell | `Home` / `End` | First/last cell in the row |
| Selected cell | `Cmd/Ctrl+Home` / `Cmd/Ctrl+End` | First/last cell in the table |
| Selected cell | `Tab` / `Shift+Tab` | Next/previous cell in row-major order |
| Last cell | `Tab` | Add a row and move to its first cell, if below limits |
| Selected cell | `Enter` or `F2` | Enter edit mode without changing text |
| Selected cell | Printable character | Enter edit mode and replace the cell with that character |
| Selected range | `Enter` | Edit the anchor cell |
| Editing | Arrow keys | Move the text caret normally |
| Editing | `Enter` | Insert a newline |
| Editing | `Cmd/Ctrl+Enter` | Commit and remain on the cell |
| Editing | `Tab` / `Shift+Tab` | Commit once and move to next/previous cell |
| Editing | `Escape` | Restore the edit-session origin and return to cell mode |
| Any inner mode | `Escape` | Step outward through the selection ladder |

Editing rules:

- Cells remain plain text.
- Maximum 2,000 characters per cell.
- Text wraps.
- On commit, the row grows enough to reveal newly added lines up to the row-height maximum; it never silently hides new content.
- Manual row resizing may intentionally constrain content; constrained cells show an overflow indicator and remain fully editable.
- One edit session creates at most one history entry.
- Clicking outside commits unless the user used `Escape`.

## 9. Row and column structure

Every structural command must have three access paths:

1. Direct canvas affordance.
2. Context menu or inline toolbar.
3. Keyboard-accessible inspector button.

### Insert

- Row: above or below the active cell/selection.
- Column: left or right of the active cell/selection.
- End bars add one row below or one column to the right.
- Multi-row/column selection inserts the same number of rows/columns when explicitly requested.
- A new row inherits the neighboring row height and per-column cell formatting, with empty text.
- A new column inherits the neighboring column width and per-row cell formatting, with empty text.

### Delete

- Explicit row/column delete commands act immediately and create one undo entry, matching familiar document-table behavior.
- Do not add a modal confirmation to ordinary deletion; the explicit command, immediate visual result, and Undo are the recovery model.
- The last row and last column cannot be removed.
- After deletion, focus moves to the nearest surviving cell.
- Ambiguous `Delete`/`Backspace` from cell mode clears content and never removes structure.

### Duplicate

- Duplicate row(s) directly below the selection.
- Duplicate column(s) directly to the right.
- Regenerate all duplicated cell IDs.
- Preserve values, dimensions, alignment, and background.

### Move and reorder

- Drag row grabbers vertically and column grabbers horizontally.
- Show a clear insertion line before drop.
- Auto-pan when dragging near the viewport edge.
- Inspector **Move up/down/left/right** buttons provide the keyboard equivalent.
- Reordering preserves stable row, column, and cell IDs.
- Reorder records one history transaction on drop, not one per pointer movement.

## 10. Resizing and layout

### Internal boundary resizing

- Hover within an 8-screen-pixel target around a row or column boundary to reveal a resize cursor and visible guide.
- Pointer down captures the pointer so resizing continues outside the table until release/cancel.
- Dragging a column's right boundary changes that column only; total table width changes by the same delta.
- Dragging a row's bottom boundary changes that row only; total table height changes by the same delta.
- Sizes clamp to the existing limits:
  - column: 80–360 canvas pixels;
  - row: 36–180 canvas pixels.
- The inspector shows the live value while dragging.
- `Escape` during resize restores the original dimensions.
- Pointer release commits one undo entry.

### Whole-table resizing

- Corners scale all column widths and row heights proportionally.
- Side handles scale only the corresponding dimension.
- Resizing from top/left also updates node position so the opposite edge remains anchored.
- Clamping one dimension redistributes the remaining delta among unconstrained rows/columns.
- The node style always snaps back to the sum of persisted column widths and row heights plus caption height.
- Text size does not scale; only cell geometry changes.

### Exact and automatic sizing commands

- Inspector numeric width/height for the active column/row.
- **Fit column to content** with min/max clamps.
- **Fit row to content** based on wrapped plain text.
- **Distribute columns evenly** across the current total width.
- **Distribute rows evenly** across the current total height.
- **Reset table sizing** restores 120 × 44 defaults without changing content.

### Zoom and touch

- Boundary hit areas remain a usable screen-space size from 15% to 400% canvas zoom.
- Touch handles expose at least a 44 × 44 CSS-pixel target without visually thickening every gridline.
- Resizing never pans or drags the canvas at the same time.
- Pinch zoom during a resize is ignored until the resize completes.

## 11. Clipboard behavior

### Copy

- Table mode: copy/duplicate the whole canvas layer using the canvas object format.
- Cell/range/row/column mode: write both:
  - `text/plain` as TSV with `\n` row separators;
  - `text/html` as an escaped HTML table.
- Empty interior cells are preserved.
- Copy does not alter history.

### Cut

- Inner selection: copy, then clear values as one history action.
- Table mode: use the canvas-layer cut behavior.
- Locked tables cannot be cut internally.

### Paste inside a table

- Prefer clipboard HTML table data when present, extracting only `textContent`.
- Otherwise parse TSV/plain text with CRLF normalization.
- One-cell text pasted during editing follows normal textarea caret behavior.
- Multi-cell data replaces a rectangular destination beginning at the active cell.
- Expand rows/columns as needed, within limits.
- Do not repeat a smaller source matrix across a larger selection in the first release.
- Unsafe markup is never inserted into the document.
- Over-limit paste is rejected before mutation and reports the required versus allowed size.
- One paste is one undo transaction.
- Announce pasted dimensions and whether the table expanded.

### Paste onto empty canvas

P1 behavior:

- A clipboard matrix of at least 2 × 2 creates a new table.
- A single text value follows the existing canvas text/concept behavior instead of creating a 1 × 1 table.
- The user can undo creation in one step.

## 12. Styling

Required styling scope:

- Header row toggle.
- Header column toggle.
- Background tones: none, gray, indigo, mint, amber, rose.
- Horizontal alignment: left, center, right.
- Apply styling to a cell, range, selected rows, selected columns, or whole table.
- Headers use derived emphasis rather than copying bold flags into every header cell.
- **Clear formatting** resets background and alignment while preserving text.

Deferred styling:

- Arbitrary colors.
- Per-cell borders.
- Font family/size.
- Rich-text spans.
- Vertical alignment and cell padding controls unless user validation establishes a real need.

## 13. Search, conversion, and export

### Search

- Layer search matches table name and all cell text.
- Selecting a search result reveals and selects the table.
- P1: when the match is a cell, the table enters cell mode with that cell focused.

### Canvas selection to table

- Available for one or more unlocked selected layers.
- Sort source layers in visual reading order: top-to-bottom, then left-to-right.
- Create columns: Layer, Notes, Type.
- Keep original nodes and connectors.
- Place and select the new table.
- Announce that originals were retained.
- Undo removes only the created table.

### SVG export

- Export caption, every visible cell, gridline, header emphasis, backgrounds, alignment, wrapped text, and opacity.
- Escape XML special characters.
- Clip or ellipsize text within its cell; never draw into an adjacent cell.
- Connector endpoints use the same calculated bounds as the canvas.
- Hidden tables are omitted.
- Export is deterministic for the same document state.

## 14. Limits and invariants

- 1–100 rows.
- 1–30 columns.
- No more than 2,000 cells.
- No more than 2,000 characters in one cell.
- Every row has exactly one cell for every column.
- Table, row, column, and cell IDs remain unique.
- Structural operations preserve a rectangular matrix.
- All persisted sizes are finite and within bounds.
- No clipboard, backup, or imported content can create HTML/script execution.
- A rejected operation leaves nodes, edges, history, selection, and autosave state unchanged.

## 15. Current implementation gap analysis

The committed version 5 baseline already provides:

- Default 3 × 3 creation from toolbar and templates.
- Whole-table canvas behavior and proportional resizing.
- Single-cell selection and editing.
- Arrow, Tab, Shift+Tab, Enter, F2, Escape, and commit behavior.
- Spreadsheet-shaped paste and expansion.
- Inspector add/remove/move, numeric size, headers, background, and alignment.
- Selection-to-table conversion.
- Search, persistence, strict validation, deep duplication, SVG export, and a 2,000-cell cap.

The next implementation pass should close these gaps in order:

1. Clear table-versus-cell click hierarchy and Escape ladder.
2. Direct row/column boundary resize handles.
3. Explicit insert above/below/left/right commands.
4. Row and column grabber selection.
5. Rectangular cell range selection.
6. Copy/cut from inner selections.
7. Duplicate row/column and drag reordering.
8. Fit-to-content and distribute sizing commands.
9. Touch-specific affordances and empty-canvas spreadsheet paste.
10. Focused assistive-technology validation and any resulting semantic adjustments.

## 16. Implementation phases

### Phase A — Selection foundation

Deliver:

- Replace the single active-cell shape with the interaction-state union.
- Implement click hierarchy, Escape ladder, row/column grabbers, and rectangular range selection.
- Add stable data attributes for table, row, column, cell, range anchor, and focus.
- Route inspector sections based on interaction mode.

Gate:

- Pointer and keyboard selection behavior is deterministic in Chromium, Firefox, and WebKit.
- Canvas selection and table selection never conflict.
- No selection state is persisted or added to history.

### Phase B — Direct structure and resizing

Deliver:

- Boundary resize handles with pointer capture.
- Edge add bars and directional insert commands.
- Row/column duplication and accessible move buttons.
- Immediate explicit row/column deletion with reliable undo.
- Exact sizing, distribute, and fit commands.

Gate:

- Every resize/reorder is one undo transaction.
- Min/max clamps, top/left geometry, zoom, and pointer cancellation pass.
- Locked and multi-canvas-selection states expose no inner mutation handles.

### Phase C — Clipboard and bulk formatting

Deliver:

- Range copy/cut as TSV and escaped HTML.
- Range paste with expansion.
- Styling applied across cell ranges, rows, columns, and whole table.
- Clear content and clear formatting commands.

Gate:

- Clipboard round trips with Sheets, Excel, Docs, and another SynapTable table.
- Unsafe HTML and over-limit paste produce no mutation.
- One action equals one undo step.

### Phase D — Reorder, touch, and workflow polish

Deliver:

- Drag row/column reorder with insertion indicators and auto-pan.
- Touch handles and long-press command menu.
- Empty-canvas spreadsheet paste.
- Search-to-cell reveal.

Gate:

- Desktop and touch workflows are usable without hidden hover-only commands.
- Reordering and paste remain stable under canvas pan/zoom transforms.

### Phase E — Hardening and release

Deliver:

- Accessibility role/announcement decision from real AT testing.
- Boundary performance work and memoization.
- SVG fidelity and migration regression checks.
- Final intended-user acceptance session.

Gate:

- All P0/P1 tests below pass.
- No serious/critical axe issues.
- Supported-limit interaction budgets are met.
- The intended user can complete her real table without assistance.

# Testing plan

## 17. Test strategy

Use four layers of verification:

1. **Pure unit tests** for matrix operations, clipboard parsing, limits, and migrations.
2. **Component tests** for semantic markup, selection rendering, and isolated input events.
3. **Playwright browser tests** for real pointer, keyboard, focus, canvas transforms, persistence, and export workflows.
4. **Manual exploratory tests** for touch, assistive technology, visual quality, and the intended user's real scenario.

Priorities:

- **P0**: data loss, corruption, security, inaccessible core workflow, broken history/persistence, or table/canvas interaction conflicts.
- **P1**: major workflow, resizing, selection, formatting, export, cross-browser, and supported-limit performance.
- **P2**: polish, uncommon inputs, secondary shortcuts, and visual refinements.

## 18. Test fixtures

Create deterministic fixtures:

| Fixture | Purpose |
| --- | --- |
| 1 × 1 empty | Minimum structure and delete guards |
| 3 × 3 default | Core creation and navigation |
| 5 × 10 mixed | Row/column selection, reorder, formatting |
| 20 × 20 | Medium interaction and paste |
| 100 × 20 | Supported 2,000-cell performance boundary |
| Long text | Wrapping, row growth, overflow, export clipping |
| Unicode | Emoji, accents, CJK, combining marks, RTL text |
| Clipboard HTML | Sheets/Excel-style escaped HTML table |
| Clipboard TSV | Tabs, blank cells, CRLF, trailing newline |
| Hostile HTML | Script, event attributes, nested markup |
| Legacy v1–v4 project | Migration without tables |
| Valid v5 table | Round-trip and restore |
| Invalid v5 tables | Ragged rows, duplicate IDs, NaN, invalid enums, excessive cells |
| Mixed canvas | Concepts, raster, vector, table, connectors, locked/hidden nodes |

## 19. Detailed test matrix

### A. Creation and placement

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| CRT-01 | P0 | Add default table from toolbar | One 3 × 3 table centered in viewport; one history entry |
| CRT-02 | P1 | Create with grid picker using pointer | Preview and committed dimensions match chosen grid |
| CRT-03 | P1 | Create with grid picker using keyboard | Arrow navigation and Enter create chosen grid |
| CRT-04 | P1 | Add from quick template and layer panel | Same valid data contract and selection state |
| CRT-05 | P1 | `Shift+T` while canvas focused | Creates table; does nothing in text input/editor |
| CRT-06 | P1 | Create while zoomed and panned | Placement is in visible viewport, not document origin |
| CRT-07 | P0 | Undo/redo creation | Removes/restores exactly one table with same content and IDs on redo |
| CRT-08 | P1 | Convert mixed selected layers | Deterministic reading order; originals/connectors retained |

### B. Whole-table canvas behavior

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| CAN-01 | P0 | First click an unselected table | Whole table selected; no cell edit/caret |
| CAN-02 | P0 | Drag caption/frame | Table moves; inner cell selection does not start |
| CAN-03 | P0 | Drag inside selected cell | Text/cell interaction occurs; table does not move |
| CAN-04 | P1 | Connect table to each node kind | Valid connector targets outer table bounds |
| CAN-05 | P0 | Hide/lock/delete/duplicate | Generic behavior works; duplicate nested IDs are unique |
| CAN-06 | P1 | Multi-select table with other layers | Inner handles hidden; generic bulk actions work |
| CAN-07 | P1 | Layer ordering and tidy | Table bounds are measured correctly |
| CAN-08 | P0 | Undo/redo table drag and top-left resize | Position and dimensions restore exactly |

### C. Selection

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| SEL-01 | P0 | Second click a cell | Cell mode; one roving tab stop; inspector identifies coordinates |
| SEL-02 | P0 | Double-click cell from table/cell mode | Edit mode begins in intended cell |
| SEL-03 | P0 | Escape ladder | Edit → cell → table → none; edit cancellation restores text |
| SEL-04 | P1 | Shift+click rectangular range in all directions | Correct anchor/focus rectangle and perimeter |
| SEL-05 | P1 | Shift+Arrow expand/contract | Range changes one boundary at a time |
| SEL-06 | P1 | Select row/column grabber | Correct full row/column state and accessible name |
| SEL-07 | P1 | Shift-select multiple rows/columns | Contiguous set only; commands apply to all selected items |
| SEL-08 | P0 | Structural deletion removes active IDs | Focus moves to nearest surviving cell; no dead tab stop |
| SEL-09 | P1 | Undo/redo structure with active selection | Selection remains valid or falls back deterministically |
| SEL-10 | P1 | Selection at 15%, 100%, and 400% zoom | Hit testing selects the intended cell/boundary |
| SEL-11 | P1 | High contrast/grayscale | Table, cell, and range modes remain visually distinguishable |

### D. Editing and navigation

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| EDT-01 | P0 | Enter/F2 from selected cell | Textarea opens with original text and correct label |
| EDT-02 | P1 | Printable key from selected cell | Replaces cell and begins editing |
| EDT-03 | P0 | Type many keystrokes then commit | One history entry, correct plain text |
| EDT-04 | P0 | Escape after editing | Original text restored; no history entry |
| EDT-05 | P0 | Tab/Shift+Tab while editing | Commit once; focus moves to adjacent cell |
| EDT-06 | P1 | Tab from last cell | Appends one row under limit; focus enters first new cell |
| EDT-07 | P1 | Arrow/Home/End navigation | Correct destination; no page scroll or canvas movement |
| EDT-08 | P1 | Multiline text | Enter inserts newline; row grows or shows explicit overflow state |
| EDT-09 | P0 | 2,000-character boundary | Exact limit accepted; extra input blocked/reported |
| EDT-10 | P1 | Unicode and RTL text | Preserved in edit, save, reload, search, and export |
| EDT-11 | P0 | Lock during/after editing | Edit commits/cancels predictably; no inner mutation remains available |
| EDT-12 | P1 | Click outside editor | One commit, correct focus, no duplicate history |

### E. Row and column operations

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| STR-01 | P0 | Insert above/below active row | Correct index, rectangular matrix, one undo entry |
| STR-02 | P0 | Insert left/right active column | Correct index and cell creation in every row |
| STR-03 | P1 | Edge add bars | Append exactly one row/column without changing selection unexpectedly |
| STR-04 | P0 | Delete empty row/column | Immediate safe deletion; nearest focus retained |
| STR-05 | P0 | Delete non-empty row/column | Immediate explicit deletion; Undo restores exact content/style/IDs |
| STR-06 | P0 | Attempt delete last row/column | Disabled/rejected without mutation |
| STR-07 | P1 | Duplicate rows/columns | Content/style/dimensions copied; IDs regenerated |
| STR-08 | P1 | Move via accessible buttons | Correct order; stable IDs; one history entry |
| STR-09 | P1 | Drag reorder and cancel | Insertion guide correct; Escape returns original order |
| STR-10 | P1 | Drag reorder near viewport edge | Auto-pan without losing pointer capture |
| STR-11 | P0 | Operations at row/column/cell limits | Disabled or rejected before mutation with specific message |
| STR-12 | P0 | Locked table structural controls | Hidden/disabled and inert through pointer and keyboard |

### F. Resizing

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| RSZ-01 | P0 | Drag internal column boundary right/left | Only intended column changes; table width follows |
| RSZ-02 | P0 | Drag internal row boundary down/up | Only intended row changes; table height follows |
| RSZ-03 | P0 | Clamp at 80/360 column bounds | No invalid persisted size or jump |
| RSZ-04 | P0 | Clamp at 36/180 row bounds | No invalid persisted size or jump |
| RSZ-05 | P0 | Pointer leaves table/window while resizing | Pointer capture completes or cancels cleanly |
| RSZ-06 | P1 | Escape during internal resize | Exact original size restored; no history entry |
| RSZ-07 | P0 | Release after many pointer moves | One history entry only |
| RSZ-08 | P0 | Whole-table resize from four corners | Proportional dimensions and correct anchor position |
| RSZ-09 | P1 | Whole-table side handles | Only width or height scales |
| RSZ-10 | P0 | Whole resize with one dimension clamped | Remaining delta distributed; calculated bounds equal node style |
| RSZ-11 | P1 | Numeric inspector width/height | Live valid value; blur commits one history entry |
| RSZ-12 | P1 | Invalid numeric input | No NaN/Infinity/negative persisted; field recovers gracefully |
| RSZ-13 | P1 | Fit row/column to short and long content | Correct measured size within limits |
| RSZ-14 | P1 | Distribute rows/columns | Equal sizes; total dimension preserved within rounding tolerance |
| RSZ-15 | P1 | Resize while zoomed 15%, 50%, 200%, 400% | Pointer delta converts correctly to flow coordinates |
| RSZ-16 | P1 | Resize on touch viewport | Reachable 44px hit area; no canvas pan/zoom conflict |
| RSZ-17 | P0 | Resize locked or multi-selected table | No table-specific resize controls or mutation |
| RSZ-18 | P1 | Resize then reload/export | Persisted canvas and SVG geometry match |

### G. Clipboard

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| CLP-01 | P0 | Copy rectangular range | Correct TSV and escaped HTML matrix |
| CLP-02 | P0 | Cut range | Clipboard written; values cleared; one undo entry |
| CLP-03 | P0 | Paste TSV into active cell | Covered cells replaced exactly |
| CLP-04 | P0 | Paste larger matrix | Required rows/columns appended within limits |
| CLP-05 | P1 | Paste smaller matrix into larger range | Only source-shaped region replaced; no implicit tiling |
| CLP-06 | P1 | Paste single text while editing | Text inserts at caret rather than grid replacement |
| CLP-07 | P0 | Paste HTML containing tags/scripts | Only textContent stored; no executable DOM |
| CLP-08 | P1 | Blank cells, tabs, CRLF, trailing newline | Interior blanks preserved; trailing artifact handled consistently |
| CLP-09 | P1 | Unicode and multiline clipboard cells | Content round-trips without mojibake or lost lines |
| CLP-10 | P0 | Over-limit paste | Rejected before mutation; selection/history unchanged |
| CLP-11 | P0 | Undo/redo paste expansion | Shape and values restore exactly |
| CLP-12 | P1 | Copy/paste between two SynapTable tables | Matrix and plain formatting behave predictably |
| CLP-13 | P1 | Paste Sheets/Excel samples | Dimensions and values match source samples |
| CLP-14 | P1 | Paste matrix onto empty canvas | Creates matching table in one undo step |

### H. Styling

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| STY-01 | P1 | Toggle header row/column | Correct semantic `<th scope>` and visual emphasis |
| STY-02 | P1 | Apply every tone to one cell | Canvas and SVG palette match; text remains readable |
| STY-03 | P1 | Apply tone/alignment to range/row/column/table | Exactly selected cells change |
| STY-04 | P1 | Left/center/right alignment | Canvas and SVG anchors match |
| STY-05 | P1 | Clear formatting | Text retained; style defaults restored |
| STY-06 | P1 | Undo/redo bulk style | One transaction with exact restoration |
| STY-07 | P1 | Header plus explicit background | Documented precedence is consistent in canvas/export |
| STY-08 | P1 | Color contrast | Text, focus, headers, gridlines, and selection meet target contrast |

### I. History, persistence, and migration

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| HIS-01 | P0 | Edit, resize, reorder, paste, style | Each logical gesture is exactly one undo step |
| HIS-02 | P0 | Cancel edit/resize/reorder | No history entry |
| HIS-03 | P0 | Long undo/redo chain | Matrix, IDs, selection fallback, and connectors remain valid |
| PER-01 | P0 | Autosave and reload | Values, order, dimensions, styles, headers restored |
| PER-02 | P0 | Checkpoint save/restore | Exact table round-trip |
| PER-03 | P0 | Backup download/restore | Version and nested IDs round-trip |
| PER-04 | P0 | Load v1–v4 documents | Migrates to current schema without synthetic tables |
| PER-05 | P0 | Load malformed v5 table | Rejected with specific error; current document preserved |
| PER-06 | P0 | Restore supported-limit table | Completes within performance budget without corruption |

### J. Search, export, and graph integration

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| INT-01 | P1 | Search caption and body cells | Correct table layer appears |
| INT-02 | P2 | Search-to-cell reveal | Matching cell focused and visible |
| INT-03 | P0 | Export XML-sensitive text | Proper escaping; valid SVG |
| INT-04 | P1 | Export wrapped/overflow text | No text paints over adjacent cells |
| INT-05 | P1 | Export headers, tones, alignment, opacity | Canvas/export visual state agrees |
| INT-06 | P0 | Export hidden table | Omitted from SVG |
| INT-07 | P1 | Connect from every table side | Connector endpoints match current table bounds |
| INT-08 | P1 | Resize/move table with connectors then undo | Connector geometry follows restored bounds |

### K. Accessibility

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| A11Y-01 | P0 | Automated axe scan with table selected/editing | No serious or critical violations |
| A11Y-02 | P0 | Semantic structure | Caption, row groups, headers, cells, and scopes exposed |
| A11Y-03 | P0 | Keyboard-only full workflow | Create, select, edit, resize, structure, style, copy/paste, delete |
| A11Y-04 | P0 | Roving tab stop | Exactly one inner cell in page tab order outside editing |
| A11Y-05 | P1 | Announcements | Paste, insert, delete, limit, lock, and conversion messages are concise |
| A11Y-06 | P1 | Visible focus | Focus remains visible against every tone/header state |
| A11Y-07 | P1 | 200% browser text zoom | Controls and cell content usable without loss |
| A11Y-08 | P1 | Reduced motion | No essential information depends on animation |
| A11Y-09 | P0 | VoiceOver + Safari | Coordinates, headers, text, selection/edit transitions understandable |
| A11Y-10 | P0 | NVDA + Firefox/Chrome | Same core announcements and navigation verified |
| A11Y-11 | P1 | Role spike | Compare native table versus grid-enhanced semantics; record decision |

### L. Mobile and touch

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| MOB-01 | P1 | Select table/cell with tap | No accidental double action; selected level clear |
| MOB-02 | P1 | Edit with software keyboard | Active cell remains visible; viewport does not jump unpredictably |
| MOB-03 | P1 | Long-press command menu | Row/column/cell commands available without hover |
| MOB-04 | P1 | Touch internal resize | Usable target; no canvas pan conflict |
| MOB-05 | P1 | Pinch zoom near selected table | Zoom works outside active resize/edit gesture |
| MOB-06 | P1 | Inspector operations on 390px viewport | No clipped or unreachable controls |

### M. Security, robustness, and performance

| ID | Priority | Scenario | Expected result |
| --- | --- | --- | --- |
| SEC-01 | P0 | Hostile clipboard HTML | Stored/rendered/exported only as escaped text |
| SEC-02 | P0 | Hostile backup fields | Validator rejects invalid lengths/enums/dimensions/IDs |
| SEC-03 | P0 | Rapid repeated actions | No matrix corruption, duplicate IDs, or stale focus |
| SEC-04 | P1 | Pointer cancel/lost capture | Resize/reorder returns to valid state |
| PRF-01 | P1 | Render 100 × 20 table | Meets render budget and keeps unrelated canvas responsive |
| PRF-02 | P1 | Navigate 200 consecutive cells | No accumulating delay or focus loss |
| PRF-03 | P1 | Type 100 characters in one cell | No unrelated row/node rerender storm |
| PRF-04 | P1 | Paste 1,000 cells | Completes within budget; one autosave/history transaction |
| PRF-05 | P1 | Resize/reorder at 2,000 cells | Gesture remains responsive; final data valid |
| PRF-06 | P1 | Save/reload/export 2,000 cells | Completes without runtime error or memory spike |
| REG-01 | P0 | Existing concept/image/vector/connector suite | No regressions |
| REG-02 | P1 | Existing 500-layer/800-connector stress fixture plus table | Existing performance remains acceptable |

## 20. Performance budgets

Measure on the local reference machine and record hardware/browser:

- Single-cell navigation response: target under 50 ms at 2,000 cells.
- One-character edit-to-paint: target under 50 ms at 2,000 cells.
- Structural insert/delete: target under 100 ms for ordinary tables, under 250 ms at 2,000 cells.
- 1,000-cell paste: target under 500 ms excluding autosave disk latency.
- Autosave scheduling must not block interaction for more than one frame.
- SVG export of 2,000 cells: target under 1 second locally.

These are product budgets, not brittle CI assertions. Automated tests should capture timings and fail only on generous regression ceilings; tighter interpretation belongs in local profiling.

## 21. Automation and GitHub Actions quota strategy

Keep hosted checks lightweight:

- Typecheck.
- ESLint.
- Unit tests.
- One focused Chromium table smoke test only if its runtime remains small.

Run locally before PR/merge:

```sh
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
npm run test:e2e
```

Also run locally:

- Chromium, Firefox, and WebKit table suite.
- Accessibility suite.
- 2,000-cell performance fixture.
- Existing 500-layer/800-connector stress test.
- Production-build or local Cloudflare Worker smoke.
- Manual VoiceOver/Safari and touch/mobile checks.

Record commands, browser counts, skipped tests, retries, failures, and performance measurements in the PR description. Do not repeatedly push speculative fixes merely to use hosted runners as a debugger.

## 22. Release gates

### Gate 1 — interaction completeness

- P0 creation, table/cell selection, editing, navigation, structure, resize, clipboard, and history tests pass.
- Every destructive or structural action has an accessible non-pointer path.

### Gate 2 — data safety

- Migration, backup/restore, malformed-table rejection, undo/redo, and supported-limit tests pass.
- No rejected/cancelled operation mutates persisted state.

### Gate 3 — cross-browser and accessibility

- Table-focused Chromium, Firefox, and WebKit tests pass locally.
- Axe has no serious/critical findings.
- VoiceOver/Safari and NVDA/Firefox or Chrome core flows are recorded.

### Gate 4 — performance and regression

- 2,000-cell budgets are acceptable.
- Existing editor regression and stress suites pass.
- Production build and local Worker smoke pass.

### Gate 5 — intended-user acceptance

Give the intended user one realistic task without coaching:

1. Create her actual table.
2. Paste or type content.
3. Add and reorder rows/columns.
4. Resize it until it is readable.
5. Style the important cells.
6. Reload and export it.

Capture:

- where she hesitates;
- which commands she cannot discover;
- whether she understands table versus cell selection;
- whether content visibility and resizing feel predictable;
- whether she asks for formulas, filtering, dates, or statuses.

Merge only after P0/P1 technical gates pass and the user can finish her real table without assistance. Requests for formulas, filters, or typed fields should start a separate structured-data specification rather than expanding this visual-table release.
