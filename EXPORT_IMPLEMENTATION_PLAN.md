# SynapTable Export Implementation and Test Plan

## 1. Objective

Replace the SVG-only export dialog with a local, scope-aware export workflow for:

- PNG for convenient visual sharing;
- SVG for scalable vector handoff;
- PDF for a portable single-page document;
- CSV for a selected table or rectangular table selection.

Project backup is not an export format in this phase. The existing backup and restore utility remains a separate data-safety workflow.

## 2. Product contract

### Export scopes

| Scope | Availability | Content |
| --- | --- | --- |
| Full canvas | Always | Every visible node plus connectors whose endpoints are visible |
| Selected layers | One or more canvas layers selected | Selected visible layers plus connectors whose source and target are both selected |
| Selected table cells | A table cell/range/row/column is active | The smallest rectangular table slice containing the selection; no canvas connectors |

Hidden layers and collapsed descendants are excluded consistently. Export never mutates the canvas, selection, history, or autosave state.

### Format availability

| Scope | PNG | SVG | PDF | CSV |
| --- | --- | --- | --- | --- |
| Full canvas | Yes | Yes | Yes | No |
| Selected layers | Yes | Yes | Yes | Yes, only when exactly one selected layer is a table |
| Selected table cells | Yes | Yes | Yes | Yes |

### Shared visual settings

- Padding: none (0), compact (24), or generous (48, default).
- PNG scale: 1×, 2× (default), or 4×, clamped to safe browser canvas limits.
- SVG/PNG background: transparent or white (default for PNG).
- PDF always uses a white background.

### PDF settings

- Page size: fit to content, A4, or Letter.
- Orientation: automatic, portrait, or landscape.
- Margin: none, small (24 pt), or normal (48 pt).
- Quality: standard (1×), high (2×, default), or print (3×).
- The first version is a high-resolution raster PDF generated from the same SVG source as PNG. This prioritizes faithful Unicode, emoji, RTL, image, and table rendering over selectable vector text.
- Oversized sources are proportionally fitted and never stretched.

### CSV settings and rules

- CSV is UTF-8 with a BOM for common spreadsheet compatibility.
- Values are emitted in row-major order.
- Commas, quotes, CR/LF, multiline content, Unicode, and RTL text are escaped without loss.
- CSV contains cell values only. Canvas coordinates, colors, alignment, dimensions, IDs, and connectors are intentionally omitted.
- A whole-table export includes every row and column.
- A cell/range/row/column export includes the smallest selected rectangle.

## 3. Architecture

1. Keep the data-driven SVG renderer as the canonical visual export stage.
2. Extend the SVG renderer with explicit padding and background options and return its calculated dimensions.
3. Add a pure export-scope resolver that filters nodes/edges and can create a temporary sliced table node.
4. Convert SVG to PNG with an `Image` and an off-document `<canvas>`, using `toBlob` and explicit dimension/pixel limits.
5. Dynamically import `pdf-lib` only when PDF is requested; embed the generated PNG into one page.
6. Serialize CSV with a small purpose-built encoder rather than a spreadsheet dependency.
7. Download all formats through one Blob/Object URL helper that always revokes the URL.
8. Keep export progress and errors in the existing dialog/toast model.

The implementation does not use DOM screenshotting or experimental HTML-in-canvas APIs. The exported result comes from persisted editor data, so zoom, open panels, selection outlines, controls, and transient DOM state cannot leak into the file.

## 4. Dialog behavior

When export opens:

- default to selected table cells and CSV when an inner table selection is active;
- otherwise default to selected layers when a selection exists;
- otherwise default to full canvas and PNG;
- preserve no stale scope that is unavailable for the current selection;
- expose only settings relevant to the chosen format;
- show object count or table dimensions and the on-device processing label;
- disable dismissal and duplicate submissions while a download is being prepared;
- close after a successful download and remain open after an error.

## 5. Acceptance criteria

### Scope and safety

- **EXP-01:** Full-canvas export contains all and only visible, non-collapsed content.
- **EXP-02:** Selected-layer export excludes unselected nodes and unrelated connectors.
- **EXP-03:** Selected-cell export contains exactly the selected rectangular range in stable row/column order.
- **EXP-04:** Export does not change nodes, edges, selection, Undo/Redo, autosave, or the active table interaction.
- **EXP-05:** Empty or unavailable scopes are rejected with a specific user-facing error and no file download.

### SVG

- **EXP-06:** SVG remains well-formed, self-contained, and scalable with correct bounds.
- **EXP-07:** Padding changes SVG dimensions by the expected amount.
- **EXP-08:** White background emits one canvas-sized background rectangle; transparent emits none.
- **EXP-09:** Text, tables, images, connectors, Unicode, emoji, RTL, styles, and geometry match the canonical renderer.

### PNG

- **EXP-10:** PNG has a valid PNG signature and dimensions equal to logical bounds × effective scale.
- **EXP-11:** 1×, 2×, and 4× preserve aspect ratio and remain within configured dimension/pixel limits.
- **EXP-12:** Transparent and white backgrounds render correctly.
- **EXP-13:** Export failure releases temporary Object URLs and leaves the dialog usable.

### PDF

- **EXP-14:** PDF has a valid PDF signature and exactly one page.
- **EXP-15:** Fit-to-content, A4, and Letter produce the expected page dimensions and orientation.
- **EXP-16:** Margins and automatic orientation preserve aspect ratio without cropping or stretching.
- **EXP-17:** Unicode, emoji, RTL, images, tables, and connectors remain visually present through the embedded PNG.
- **EXP-18:** PDF support is dynamically loaded and does not enter the initial editor bundle.

### CSV

- **EXP-19:** Whole-table CSV round-trips the complete matrix.
- **EXP-20:** Cell/range/row/column CSV round-trips only the selected rectangle.
- **EXP-21:** Quotes are doubled; values containing commas, quotes, or line breaks are quoted.
- **EXP-22:** UTF-8 BOM, Unicode, emoji, RTL, empty cells, and trailing empty cells are preserved.
- **EXP-23:** CSV is disabled for full-canvas or heterogeneous selections.

### UX and accessibility

- **EXP-24:** Scope, format, and settings controls have explicit labels and keyboard focus.
- **EXP-25:** The primary action announces the chosen format and exposes a busy state during generation.
- **EXP-26:** Escape/Cancel closes only while idle; focus returns to the Export trigger.
- **EXP-27:** Success and failure messages identify the format without exposing internal errors.
- **EXP-28:** The workflow works in Chromium, Firefox, and WebKit.

## 6. Automated test matrix

### Unit tests

- scope filtering for full canvas, mixed selection, whole table, and selected cells;
- connector inclusion only when both endpoints are in scope;
- collapsed/hidden filtering;
- table-slice header flags, dimensions, IDs, content, and styles;
- CSV special characters, Unicode/RTL, multiline, empty/trailing cells, BOM, and deterministic output;
- SVG padding, background, dimensions, empty-state rejection, and existing content rendering;
- PDF page-size/orientation/margin calculations as pure functions;
- PNG scale clamping and safe output-dimension calculations as pure functions.

### Browser tests

- open-dialog defaults for no selection, canvas selection, whole table, and cell range;
- SVG full-canvas and selection downloads inspected as text;
- PNG download signature, MIME/filename, transparency/white controls, and scale;
- PDF download signature, filename, page count, A4/Letter/fit dimensions, and orientation;
- CSV whole-table and selected-range downloads inspected byte-for-byte;
- Unicode/emoji/RTL content in CSV and the visual export source;
- disabled CSV for invalid scopes;
- busy state prevents duplicate exports;
- empty canvas error produces no download;
- 2,000-cell table CSV/SVG export remains within the existing local performance budget;
- serious/critical axe scan of the expanded dialog;
- cross-browser smoke in Chromium, Firefox, and WebKit.

### Manual checks

- open PNG/PDF/SVG in Preview, Chrome, and Safari;
- import CSV into Google Sheets and Excel and verify multiline/Unicode cells;
- print A4 and Letter PDFs and check margins/readability;
- compare table styling, connector endpoints, and image quality at 100% and 400% zoom;
- verify keyboard-only export and VoiceOver dialog announcements.

## 7. Release gate

The export increment is ready to merge when all unit and cross-browser automated tests pass locally, the production build succeeds, downloads make no external requests, and the manual Google Sheets/Excel and PDF print checks have no data-loss or clipping defect. Project-file export remains out of scope.
