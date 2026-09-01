# Table rich-text implementation plan

## Goal

Let a user format text inside one actively edited table cell without turning the table into a spreadsheet or changing multi-cell styling behavior. The first release supports bold, italic, underline, strikethrough, links, confirm, and cancel. Lists and checklists remain concept-only until the simpler interaction is proven.

## Implementation status

Implemented on `feat/table-layer-mvp`. Local validation completed with 83 unit tests, 192 passing end-to-end scenarios across Chromium, Firefox, and WebKit (6 intentional skips), accessibility scans in rich-cell edit mode, typecheck, lint, and a production build.

## Product behavior

1. A single cell enters rich-text editing through double-click, Enter, F2, or printable-key replacement.
2. A compact floating toolbar appears above the table only while that cell is being edited.
3. Bold, italic, underline, and strikethrough apply to the selection. With a collapsed caret they change the stored mark for subsequently typed text.
4. Link opens the existing inline URL form. Only `http`, `https`, and `mailto` URLs are accepted. Unlink is available only while the selection or caret is inside a link.
5. Confirm commits the complete editing session as one undoable history step. Cancel restores the exact pre-edit cell content and row size.
6. `Tab` and `Shift+Tab` commit and move to the adjacent cell. `Cmd/Ctrl+Enter` commits. `Escape` cancels. Native selection, composition/IME, clipboard, arrows, Home/End, and Enter remain editor operations.
7. `Cmd/Ctrl+B`, `Cmd/Ctrl+I`, `Cmd/Ctrl+U`, and `Cmd/Ctrl+K` work while editing. Browser/application events must not leak into canvas shortcuts.
8. The toolbar uses native buttons with accessible names, `aria-pressed` for toggle state, visible focus, and at least 30 × 30 CSS-pixel targets (40 × 40 on coarse pointers).
9. The semantic `<table>`, `<th scope>`, and `<td>` structure remains intact. Rich display content lives inside each cell and does not replace table semantics.

## Data and migration

- Replace `TableCell.text` with one canonical `TableCell.content: RichTextDocument` field. Keeping both would permit stale search, export, clipboard, and persistence results.
- Increment the editor document schema to version 6.
- During load/restore, versions 1–5 migrate legacy `text` into a paragraph-based rich-text document. Version 6 validates and normalizes rich content and rejects unsupported or unsafe marks.
- Table helpers expose `tableCellPlainText`, `tableCellHasContent`, and `replaceTableCellPlainText` so non-visual features never inspect the rich tree directly.
- Cell character limits are measured from plain text. Rich markup cannot bypass the 2,000-character limit.

## Implementation sequence

1. Add the rich-content cell type, table helpers, schema migration, and parser validation.
2. Update table creation, duplication, insertion, clearing, sizing, search, and grid paste to use the helpers.
3. Add a focused `InlineTableCellEditor` using the existing Tiptap configuration and formatting patterns, with lists and unsupported block nodes disabled.
4. Render committed cell content through `RichTextView`; preserve current alignment, tone, clipping, row growth, lock, selection, and canvas navigation behavior.
5. Update CSV and table-range clipboard output to flatten content to plain text. Grid paste creates plain rich-text documents. Native rich-text copy/paste remains available inside the active editor.
6. Update SVG rendering to emit marked `<tspan>` runs and sanitized anchors. PNG and PDF inherit the SVG result. Search and accessible cell labels use plain text.
7. Add unit, browser, accessibility, and cross-browser regression coverage, then run the complete local validation suite.

## Acceptance criteria

### Editing and formatting

- [ ] The toolbar exists only for one unlocked cell in editing mode.
- [ ] Each mark can be applied, removed, combined, and continued at a collapsed caret.
- [ ] Toolbar presses preserve the text selection and return focus to the editor.
- [ ] Toolbar toggle state follows the current selection/caret.
- [ ] Link creation rejects empty, malformed, `javascript:`, and `data:` values; unlink removes only the link mark.
- [ ] Empty and multiline cells remain editable, including IME composition.
- [ ] Printable-key replacement selects/replaces prior content without creating a premature history entry.

### Commit, cancel, navigation, and history

- [ ] Confirm, outside click, `Cmd/Ctrl+Enter`, and Tab commit once.
- [ ] Escape and Cancel restore the exact original rich content and row height.
- [ ] One undo restores the pre-edit content; one redo restores the committed rich content.
- [ ] Tab/Shift+Tab retain existing adjacent-cell and end-of-table behavior.
- [ ] Cell editing never triggers grid arrows, canvas deletion, browser shortcuts, or node dragging.
- [ ] Row height grows after commit when plain text wraps; cancelling does not grow it.

### Persistence, interoperability, and output

- [ ] Existing schema 1–5 projects load with identical visible table text.
- [ ] Schema 6 backup, restore, reload, and local persistence retain all supported marks and links.
- [ ] Search and layer discovery find formatted cell text.
- [ ] Table-range copy and CSV export contain readable plain text with no markup artifacts.
- [ ] Grid paste and spreadsheet paste create valid rich cell documents.
- [ ] SVG, PNG, and PDF preserve bold, italic, underline, strikethrough, and safe links where the format supports them.
- [ ] Unsafe links are never interactive in the canvas or exports.

### Accessibility and regression

- [ ] The formatting bar has a toolbar label, named native buttons, accurate toggle state, and logical DOM/tab order.
- [ ] Keyboard-only editing, formatting, linking, committing, and cancelling are possible with visible focus.
- [ ] The canvas retains semantic table headers/cells and useful plain-text accessible labels.
- [ ] Axe reports no serious or critical violations in table edit mode.
- [ ] Zoom, pan, wheel routing, resize handles, selection, multi-cell styling, lock/hide, duplicate, undo/redo, and exports continue to work.

## Test plan

### Unit tests

- Rich-text cell creation, normalization, plain-text conversion, emptiness, replacement, and character limiting.
- Schema 5 `text` migration and schema 6 rich-content round trips, including invalid marks and unsafe links.
- Insert, duplicate, move, clear, paste, fit-column, fit-row, search, and node-to-table conversion with formatted cells.
- CSV/plain clipboard flattening and HTML/grid paste conversion.
- SVG mark attributes, combined decorations, link sanitization, wrapping, and clipping.

### Browser tests

- Enter via double-click, Enter/F2, and printable replacement; toolbar visibility and locked-cell exclusion.
- Mouse selection plus every toolbar action; collapsed-caret continuation; combined marks.
- Keyboard shortcuts on macOS-style and Control-style modifiers.
- Valid link, edit link, unlink, invalid-link disabled state, and selection preservation through the URL form.
- Confirm, cancel, outside commit, one-step undo/redo, Tab/Shift+Tab, multiline editing, and row growth.
- Range copy/cut/paste, spreadsheet paste, search, reload, backup/restore, CSV, SVG, PNG, and PDF.
- Wheel/trackpad zoom and canvas pan over committed cells; editor scrolling while actively editing.
- Axe scan and keyboard-only flow.

### Validation matrix

- Run focused Vitest suites while implementing.
- Run the focused Playwright table/export/accessibility specs on Chromium.
- Run the same focused scenarios on Firefox and WebKit.
- Finish with local typecheck, lint, production build, full unit suite, and full Playwright suite. Keep complex validation local to avoid consuming GitHub Actions quota.
