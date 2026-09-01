# Table Canvas Navigation Fix Plan

## Problem

When the pointer is over a table, trackpad or mouse-wheel canvas navigation stops working. The same gestures work over concept, image, and vector layers.

The current table markup renders the static grid as:

```tsx
<table className="canvas-table nowheel">
```

React Flow 12.11.5 uses `nowheel` as its default `noWheelClassName`. Its zoom/pan controller excludes wheel events whose target is inside that class. The table is therefore opting out of both normal wheel panning and modifier-wheel zooming.

This is not caused by table cell click handlers: wheel events are being filtered by React Flow before they can become canvas navigation.

## Intended behavior

The table should follow the same interaction contract as existing layers:

| Pointer location | Wheel/trackpad | Modifier + wheel | Pointer drag |
| --- | --- | --- | --- |
| Static table cell or caption | Pan canvas | Zoom canvas | Preserve existing table selection/drag behavior |
| Concept/image/vector surface | Pan canvas | Zoom canvas | Existing behavior unchanged |
| Cell text editor | Scroll editor content | Do not unexpectedly zoom canvas | Edit text |
| Table mutation control or resize boundary | Do not accidentally move the canvas during control use | Do not interfere with the control | Run the control action |

Pinch zoom should continue to use React Flow's existing `zoomOnPinch` behavior. Toolbar zoom buttons and fit-view must remain unchanged.

## Implementation

1. Remove `nowheel` from the static `.canvas-table` element in `TableNode.tsx`.
2. Keep `nodrag` on cells so selecting or editing a cell does not start a node drag.
3. Keep `nowheel` on `.table-cell-editor` so multiline text can scroll without moving the canvas while the user is editing.
4. Keep the table direct-control region protected while the pointer is over an actionable row/column/add/resize control, matching the protected action bars on existing layers.
5. Do not add custom `wheel` handlers, call `preventDefault`, or manually change the viewport. Let React Flow's configured navigation policy remain the single source of truth:
   - `panOnScroll`
   - `zoomOnScroll={false}`
   - `zoomActivationKeyCode={['Meta', 'Control']}`
   - `zoomOnPinch`
   - `minZoom={0.15}` and `maxZoom={4}`

No document schema, persistence, history, export, or table data changes are required.

## Acceptance criteria

- **NAV-01:** A plain wheel/trackpad gesture over any static table cell pans the viewport.
- **NAV-02:** The same gesture over the table caption pans the viewport.
- **NAV-03:** Control/Command plus wheel over a static table cell changes viewport zoom.
- **NAV-04:** Table navigation matches the result of the same gestures over a concept, image, or vector layer.
- **NAV-05:** Wheel navigation does not change the selected table, selected cell range, cell values, or Undo/Redo history.
- **NAV-06:** Hovering a table does not prevent toolbar Zoom In, Zoom Out, or Fit View.
- **NAV-07:** Multiline cell editors retain independent scrolling and do not pan the canvas while editing.
- **NAV-08:** Row/column selectors, add buttons, resize boundaries, and whole-table resizing keep their current pointer and keyboard behavior.
- **NAV-09:** Canvas navigation still respects the configured 15% minimum and 400% maximum zoom.
- **NAV-10:** The behavior passes in Chromium, Firefox, and WebKit without page scrolling or console errors.

## Automated test cases

Add a focused Playwright test to `e2e/table.spec.ts`:

1. Create a table and record the `.react-flow__viewport` transform.
2. Move the pointer to the center of a body cell and issue a vertical wheel gesture.
3. Assert the viewport translation changed while the table/cell selection did not.
4. Move the pointer to the caption and repeat the pan assertion.
5. Hold `Control` (and cover `Meta` where the browser platform exposes it), wheel over a body cell, and assert the transform's zoom component changed.
6. Repeat the pan/zoom helper over an existing concept node and assert both surfaces support the same navigation modes.
7. Enter a cell containing enough multiline content to scroll, wheel inside its textarea, and assert:
   - `scrollTop` changes;
   - viewport transform does not change;
   - the editor remains focused and active.
8. Verify the selected table/cell and Undo/Redo availability are unchanged after navigation.
9. Exercise the React Flow Zoom In, Zoom Out, and Fit View buttons after hovering the table.
10. Run the test in all configured Playwright projects.

## Regression validation

- Run the focused table navigation test in Chromium, Firefox, and WebKit.
- Run the complete table browser suite to cover selection, editing, resizing, direct controls, and persistence.
- Run the canvas navigation suite to ensure the global React Flow policy did not change.
- Run unit tests, type-check, lint, and the production build.

## Release gate

The fix is ready when all acceptance criteria pass locally, the full table and canvas-navigation suites remain green, and the diff contains only the table wheel opt-out removal plus its regression tests.
