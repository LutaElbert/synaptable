# Table rich-text QA checklist

## Purpose

Verify that rich-text cells behave like normal SynapTable table cells while adding bold, italic, underline, strikethrough, and safe links. This checklist combines repeatable manual cases, automated coverage, and a computer-use execution record.

## Test environment

- Branch: `feat/table-layer-mvp`
- App: local development server at `http://localhost:3000`
- Persistence: browser-local workspace
- Supported browsers: Chromium, Firefox, and WebKit
- GitHub Actions: not used; all validation runs locally

## Status legend

- **PASS** — observed result matches every expected result.
- **FAIL** — at least one expected result is not met; record the defect and evidence.
- **BLOCKED** — the case cannot be executed because a prerequisite is unavailable.
- **AUTO** — covered by the local automated suite and unsuitable or unnecessarily expensive to reproduce manually.
- **NOT RUN** — still awaiting execution.

## Acceptance criteria

| ID | Acceptance criterion |
| --- | --- |
| AC-01 | An unlocked cell can enter editing by double-click, Enter, F2, or printable-key replacement; a locked table cannot enter cell editing. |
| AC-02 | The cell-formatting toolbar appears only while one cell is actively edited and exposes named controls for bold, italic, underline, strikethrough, link/unlink, finish, and cancel. |
| AC-03 | Bold, italic, underline, and strikethrough can be applied, combined, toggled off, and continued from a collapsed caret without losing the selection or editor focus. |
| AC-04 | Only `http`, `https`, and `mailto` links are accepted; empty, malformed, `javascript:`, and `data:` values cannot be applied; unlink removes only the link. |
| AC-05 | Finish, outside click, `Cmd/Ctrl+Enter`, Tab, and Shift+Tab commit once. Escape and Cancel restore the exact pre-edit content and size. |
| AC-06 | One undo restores the complete pre-edit cell; one redo restores the complete committed cell. |
| AC-07 | Tab and Shift+Tab commit and move to the correct adjacent cell, including the last-cell behavior. |
| AC-08 | Empty, multiline, wrapping, pasted, and IME-composed text remain editable, respect the 2,000-character limit, and grow the row only when necessary. |
| AC-09 | Editing never leaks keystrokes into canvas delete, navigation, selection, dragging, or browser/application shortcuts. |
| AC-10 | Single-cell copy retains rich text; table-range copy, CSV, search, and accessible labels use readable plain text with no markup artifacts. |
| AC-11 | Spreadsheet/grid paste creates valid cells in the intended rectangular range and remains undoable. |
| AC-12 | Local persistence, reload, backup, and restore retain supported marks and safe links; schema versions 1–5 migrate without visible text loss. |
| AC-13 | SVG, PNG, and PDF preserve supported visual formatting; unsafe links never become interactive output. |
| AC-14 | Toolbar and editor are keyboard operable, visibly focused, correctly named, accurately expose toggle state, and produce no serious or critical Axe violations. |
| AC-15 | Zoom, pan, wheel routing, node selection, table range selection, resizing, add-row/add-column controls, lock/hide, duplicate, and multi-cell styling retain the behavior of other canvas layers. |
| AC-16 | The feature works in Chromium, Firefox, and WebKit without browser-specific failures. |

## Manual test cases

### Editing and toolbar

| ID | Steps | Expected result | AC | Status |
| --- | --- | --- | --- | --- |
| TC-01 | Add a 3×3 table. Double-click a populated cell. | The cell becomes an editor with its original text selected or caret available; the node does not drag. | AC-01 | PASS |
| TC-02 | While TC-01 is active, inspect the floating toolbar. Finish editing, then lock the table and try again. | The labeled toolbar is present only during unlocked editing and disappears on finish; locked cells do not edit. | AC-01, AC-02 | PASS |
| TC-03 | Select text and toggle bold, italic, underline, and strikethrough one at a time, then combine all four. Toggle each off. | The selected text and each control's `aria-pressed` state match the requested marks; selection and editor focus survive each toolbar click. | AC-03, AC-14 | PASS |
| TC-04 | Put the caret at the end, enable bold, type text, disable bold, and type again. | Only text typed while bold is active is bold; the caret remains in the editor. | AC-03 | PASS |
| TC-05 | Select text, open Link, enter `https://example.com`, and apply. Reopen the link and choose Unlink. | The text becomes a safe link, the URL is retained when reopened, and unlink removes the anchor without removing other marks or text. | AC-04 | PASS |
| TC-06 | Try empty text, malformed text, `javascript:alert(1)`, and `data:text/html,...` in the Link field. | Apply stays disabled or the value is rejected; no unsafe anchor is created. | AC-04 | PASS |

### Commit, cancel, keyboard, and history

| ID | Steps | Expected result | AC | Status |
| --- | --- | --- | --- | --- |
| TC-07 | Change text and marks; click Finish. Repeat and click outside. Repeat with `Cmd/Ctrl+Enter`. | Every method commits the visible content exactly once and closes the toolbar. | AC-05 | PASS |
| TC-08 | Begin with known rich content. Change text and marks, then click Cancel. Repeat with Escape. | The exact original rich content and row height return; no undo entry is created for the cancelled edit. | AC-05 | PASS |
| TC-09 | Commit multiple text and mark changes in one edit session. Click Undo once and Redo once. | One undo restores the complete pre-edit value; one redo restores the complete committed value. | AC-06 | PASS |
| TC-10 | Edit a middle cell and press Tab; edit again and press Shift+Tab. Repeat from the last cell. | Content commits; focus moves forward/backward correctly; end-of-table behavior matches the existing table contract. | AC-05, AC-07 | PASS |
| TC-11 | While editing, press arrows, Home/End, Enter, Backspace, Delete, and copy/paste shortcuts. | Keys operate inside the editor and do not move/delete the canvas node or trigger canvas shortcuts. | AC-08, AC-09 | AUTO |

### Data, sizing, clipboard, and output

| ID | Steps | Expected result | AC | Status |
| --- | --- | --- | --- | --- |
| TC-12 | Enter several lines and long wrapping text, then commit. Cancel a separate multiline edit. | Committed content is not clipped and the row grows as needed; cancelled text does not change row height. | AC-08 | PASS |
| TC-13 | Paste one rich-text value into an editor. Copy a selected table range and paste tab/newline spreadsheet data into a range. | Editor paste keeps supported marks; range copy is plain tabular text; grid paste fills the correct rectangle and is undoable. | AC-10, AC-11 | AUTO |
| TC-14 | Enter 2,000 characters, then attempt one more; also paste content longer than 2,000 characters. | Cell plain text never exceeds 2,000 characters and the UI remains responsive. | AC-08 | AUTO |
| TC-15 | Search for text that is split across multiple rich-text marks. | The table/layer is found by its visible plain text. | AC-10 | AUTO |
| TC-16 | Export the table as CSV, SVG, PNG, and PDF. Inspect text, marks, decorations, wrapping, and links. | CSV is readable plain text; visual exports preserve supported styling; no unsafe URL is emitted. | AC-10, AC-13 | AUTO |
| TC-17 | Commit mixed marks and a link, wait for save, reload, then exercise backup/restore. | Text, marks, links, alignment, and table dimensions survive each persistence path. | AC-12 | PASS |
| TC-18 | Load a schema v5 fixture with populated table cells. | Visible text, sizes, search, clipboard, and export remain correct after automatic migration. | AC-12 | AUTO |

### Canvas behavior and accessibility

| ID | Steps | Expected result | AC | Status |
| --- | --- | --- | --- | --- |
| TC-19 | Hover a committed table cell and zoom with the wheel/trackpad; pan from the cell surface. Repeat while editing. | Committed cells route zoom/pan like other layers; active editor gestures remain usable without trapping the canvas unexpectedly. | AC-15 | PASS |
| TC-20 | Select the table and a cell range; resize the table and columns/rows; use add-row/add-column controls; apply multi-cell styling. | Selection outlines, handles, centering, minimum sizes, additions, and properties behave consistently and content remains intact. | AC-15 | AUTO |
| TC-21 | Navigate into a cell and through every toolbar control using only the keyboard. Inspect names, focus, and toggle state; run Axe in edit mode. | The entire flow is operable without a mouse; focus is visible; names/state are announced; Axe has no serious or critical violations. | AC-14 | AUTO |
| TC-22 | Run the focused table-rich-text scenarios in Chromium, Firefox, and WebKit. | All supported-browser scenarios pass with only documented intentional skips. | AC-16 | AUTO |

## Automated coverage record

| Coverage | Command/spec | Latest result |
| --- | --- | --- |
| Cell helpers, schema migration, normalization, search, grid actions, export rendering | `npm test` | 83 passed |
| Table interaction, formatting, clipboard, persistence, export, accessibility, regression | `npm run test:e2e` | 192 passed, 6 intentional skips |
| Focused rich-cell browser coverage | `e2e/table.spec.ts` rich-cell scenario | Passed in Chromium, Firefox, and WebKit |
| Accessibility in rich-cell edit mode | `e2e/accessibility.spec.ts` | Passed in Chromium, Firefox, and WebKit |
| Static and production checks | `npm run typecheck`, `npm run lint`, `npm run build` | Passed |

## Computer-use execution record

Date: 2026-09-01  
Operator: Codex in-app browser  
Build: working tree based on `1e84024`  

| Case | Result | Evidence/notes |
| --- | --- | --- |
| TC-01 | PASS | Added a 3×3 table and entered row 2, column 1 by double-click; the cell textbox became active and the node remained stationary. |
| TC-02 | PASS | Toolbar appeared only during editing. After locking the table, double-click produced zero cell editors and zero formatting toolbars; the table was unlocked after the check. |
| TC-03 | PASS | `Cinema QA` rendered as nested `<strong><em><s><u>…</u></s></em></strong>`; all four controls exposed `aria-pressed="true"`, and focus returned to the cell editor. |
| TC-04 | PASS | At a collapsed caret, Bold exposed pressed state and a typed character rendered in `<strong>`; subsequent unbold text rendered without the mark. Physical Space followed by typed text also retained the stored mark. |
| TC-05 | PASS | `https://example.com/scene` applied to `Link me`, produced a safe anchor with `noopener noreferrer nofollow`, and returned focus to the editor. Unlink/cancel restoration is covered in TC-08 and the browser suite. |
| TC-06 | PASS | Physical keyboard input of `javascript:alert(1)` remained in the URL field, left Apply disabled, preserved `Link me`, and created no anchor. Valid HTTPS input enabled Apply. Empty/data/malformed variants are also covered by unit/browser validation. |
| TC-07 | PASS | Finish closed the toolbar and committed bold linked text. `Cmd/Ctrl+Enter` committed multiline content. Outside-click commit is covered by the focused browser scenario. |
| TC-08 | PASS | Removing the link and inserting a temporary line, then cancelling, restored the original bold link and the exact measured height (`61.57px` before and after). Escape is covered by the focused browser scenario. |
| TC-09 | PASS | One Undo cleared the complete newly committed rich cell; one Redo restored `Link me`, bold, and its HTTPS link. |
| TC-10 | PASS | Tab committed `Tab commit` and focused row 2, column 3. Shift+Tab committed `Next cell` and focused row 2, column 2. |
| TC-12 | PASS | Three paragraphs plus wrapping text increased the visible row height from `61.57px` to `159.53px`; the toolbar closed on commit. Cancelled multiline content did not change height in TC-08. |
| TC-17 | PASS | After local autosave and a full reload, `Link me`, bold, the HTTPS link, both Tab-created values, the multiline paragraphs, and the enlarged row remained present. Backup/restore is covered by the browser suite. |
| TC-19 | PASS | A physical wheel gesture over a committed cell changed the React Flow viewport translation while preserving zoom. Modifier-wheel zoom and active-editor scrolling pass in the cross-browser table scenario; the computer-use scroll primitive could not reliably hold the zoom modifier. |

## Defect found and resolved during computer-use testing

### QA-001 — Link URL keystrokes leaked into table-cell shortcuts

- Severity: high
- Reproduction: select cell text, open Add or edit link, and physically type a URL.
- Observed before fix: the link form closed after the first keydown, the typed URL replaced the selected cell, and end-of-table behavior could add a row.
- Root cause: the toolbar is rendered through a React portal. Synthetic keyboard and clipboard events from the URL form bubbled through the React tree to the table cell's keyboard/clipboard handlers. The existing test used `fill()`, which emits input events without physical keydown events and therefore missed the defect.
- Fix: stop keyboard, copy, cut, and paste propagation at the link form while preserving native input editing and Escape-to-close behavior.
- Regression: the focused end-to-end scenario now uses sequential physical keystrokes for the unsafe and valid URLs and asserts that the editor content and toolbar remain intact.
- Retest: PASS with in-app computer use and the focused Chromium browser test.

## Release gate

The table rich-text feature is ready to merge when:

1. Every acceptance criterion is covered by at least one passing manual or automated case.
2. No reproducible P0/P1 defect remains in editing, persistence, history, export, or canvas navigation.
3. Focused tests pass in Chromium, Firefox, and WebKit.
4. Typecheck, lint, production build, unit tests, and the full end-to-end suite pass locally.
5. Any intentional skip or known limitation is documented here before merge.
