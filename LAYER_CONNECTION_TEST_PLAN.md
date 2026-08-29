# Layer and connection test plan

## Purpose

Protect the editor's graph integrity and make layer editing predictable across pointer, keyboard, persistence, and recovery workflows. These checks run locally and in CI; they do not deploy or modify Cloudflare resources.

## Behavior contract

- Double-clicking a concept on the canvas enters rich-text editing. Double-clicking a layer name in the layer panel enters rename mode; `F2` is the keyboard equivalent.
- `Enter` commits a layer rename, while `Escape` cancels without creating a history entry. Focus returns to the edited concept or layer control after cancellation and to the renamed layer after commit.
- Locked layers cannot be renamed, edited on the canvas, moved, resized, styled, deleted through a mixed bulk operation, or used as an endpoint for a new or reconnected connector.
- A connector requires two existing, distinct, unlocked endpoints. Duplicate directed connectors are rejected; reverse-direction connectors and cycles are supported.
- Reconnecting a connector is one undoable operation. Deleting a layer removes its incident connectors in the same undoable operation.
- Undo/redo, autosave/reload, backup/restore, collapse, tidy, search, visibility, ordering, and duplication preserve valid layer and connector references.
- Strict project import rejects malformed graphs. Local saved-state recovery preserves valid layers and drops invalid connectors instead of discarding the whole document.

## Automated coverage

| Area | Coverage |
| --- | --- |
| Double-click and keyboard editing | Canvas concept edit/cancel, layer-panel rename commit/cancel, `F2`, raster/vector parity, clean history, focus restoration |
| Connection rules | Missing endpoints, self-edge, duplicate direction, reverse cycle, locked endpoints, reconnection, duplicate reconnect rejection |
| Mutation safety | Keyboard and inspector deletion, cascade cleanup, mixed locked selection, ordering, duplicate-layer isolation, undo/redo |
| Persistence | Drag and resize autosave/reload, project backup/restore, malformed graph rejection and saved-state repair |
| Graph algorithms | Cyclic collapse and tidy termination, deterministic positioning, hidden descendants, integrity diagnostics |
| Accessibility | Serious/critical axe scan, semantic selected/locked/hidden state, keyboard entry and cancellation, reduced motion, 200% text, mobile panels |
| Scale | 500 layers and 800 connectors restored, searched, tidied, autosaved, and reloaded without runtime errors |
| Browser regression | Production-built Worker in Chromium, Firefox, and WebKit |

## Release gate

Before review, all of the following must pass against the built local Worker:

```sh
npm run check
npm run typecheck
npm run lint
npm test
npm run build
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test
npm audit --audit-level=high
```

The local Worker must return the configured CSP, framing, MIME-sniffing, referrer, permissions, HSTS, and cross-origin headers. `git diff --check` must report no whitespace errors.

## Latest local evidence — 2026-08-29

- 28/28 unit tests passed.
- 70 production-Worker browser checks passed: 24 Chromium, 23 Firefox, and 23 WebKit. The scale test is intentionally Chromium-only.
- The double-click layer scenarios passed in all three engines.
- The Chromium scale fixture passed with 500 layers and 800 connectors.
- Vinext compatibility is 100%, the production build succeeds, the dependency audit reports zero vulnerabilities, and the required security headers are present.

## Manual acceptance still required

- Try representative real concept-map screenshots and confirm the resulting layer names, vector paths, and intended connections are useful.
- Repeat pointer editing and drag/resize on at least one physical touch device.
- Review VoiceOver/Safari or another screen-reader/browser combination.
- Approve the release candidate before any preview deployment, merge, or production deployment.
