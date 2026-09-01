# SynapTable release validation record

Use a copy of this record for each release candidate. Production deployment remains a separate owner-approved action.

## Candidate

| Field | Value |
| --- | --- |
| Date | 2026-09-01 |
| Branch | `feat/audit-remediation-workflows` |
| Commit | `a37ab1f7dfde7410f1019e5088fc54b10c828f4a` |
| Tester | Codex automated local validation; physical-device and assistive-technology owner checks pending |
| Host | Apple M4, arm64, macOS 26.5.2 (25F84) |
| Content model | Local-only IndexedDB; no project-content backend |

## Automated local gate

| Command/evidence | Result |
| --- | --- |
| `npm run check` | Pass — Vinext reports 100% compatibility, 0 issues |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | Pass — 106 tests in 14 files |
| `npm run build` | Pass |
| `npm audit --audit-level=high` | Pass — 0 vulnerabilities |
| Playwright Chromium | 75/75 cases pass, including both stress fixtures |
| Playwright Firefox | 72 pass, 3 intentional skips; the skipped cases are the two Chromium-only stress budgets and browser-specific zoom-extreme geometry check |
| Playwright WebKit | 72 pass, 3 intentional skips for the same documented reasons |

The complete suite defines 225 browser cases: 219 passing executions and 6 intentional skips. Run browser projects serially with one worker when collecting release evidence; concurrent cold browser workers previously produced React Flow handle-measurement timeouts that did not reproduce in the serial verification. The editor now explicitly refreshes React Flow node internals after project hydration to make connector rendering deterministic.

## Bundle evidence

| Asset | Uncompressed | Gzip | Budget result |
| --- | ---: | ---: | --- |
| Editor application chunk | 272,070 B | 77,861 B | Pass — about 8% above the approximate 72 KB Phase-0 gzip baseline and below the 10% review threshold |
| Dynamically loaded PDF-related chunk | 510,588 B | 203,159 B | Pass — remains outside the editor chunk |

Build filenames are content-hashed and will change. Re-run the measurements for the final release commit.

## Automated feature evidence

- Version-3 IndexedDB `documents/current` and legacy checkpoints migrate once into version 4, remain recoverable, and reload without duplication.
- Project creation, open, rename, deep duplicate, inactive deletion, active selection, autosave isolation, project-scoped checkpoints, backup, and non-destructive import are covered.
- Canvas→table and table rows/ranges→canvas both preserve source content and are one-step undoable operations.
- Table-size picker pointer/keyboard/fallback paths, `Shift+T` guards, unique naming, spreadsheet paste, and pre-mutation size rejection are covered.
- Keyboard entry, focus return, non-blocking onboarding, table semantics, rich editing, export dialogs, and automated serious/critical accessibility scans are covered.
- Responsive side-panel dismissal and cross-browser table-picker focus restoration are covered on Chromium, Firefox, and WebKit.
- PNG, SVG, PDF, CSV, Unicode/RTL, large graph, and 2,000-cell fixtures are covered.

## Manual release gates — not yet completed

Record a tester, date, device/browser version, and result for every row. Do not mark the release ready based only on automation.

| Environment | Required workflow | Tester/date | Result |
| --- | --- | --- | --- |
| Safari + VoiceOver on macOS | Keyboard-only ideas→table→canvas→backup/export; project dialog and status announcements | — | Pending |
| Chrome or Edge on macOS/Windows | Large canvas/table interaction, storage, all downloads, 200% zoom | — | Pending |
| Firefox + NVDA on Windows when available | Project dialog, semantic table, cell/range selection, conversion announcement | — | Pending |
| Physical iPhone/iPad Safari | Touch panels, cell edit, scrolling, pan/zoom, backup/export, VoiceOver spot check | — | Pending |
| Physical Android Chrome | Touch panels, cell edit, scrolling, pan/zoom, backup/export, TalkBack spot check | — | Pending |
| Google Sheets and Excel | Open CSV containing commas, quotes, newlines, Unicode, emoji, and RTL | — | Pending |
| Preview, Chrome, and Safari | Open PNG/SVG/PDF; print A4 and Letter without unexpected clipping | — | Pending |

## Cloudflare preview gates — approval required

- [ ] Deploy this exact commit to a non-production preview Worker.
- [ ] Record preview URL and deployment identifier.
- [ ] Verify HTML/assets MIME types, cache headers, CSP, and clean console/network behavior.
- [ ] Verify IndexedDB persistence across reload and preview revision.
- [ ] Verify project switching, backup/import, and PNG/SVG/PDF/CSV downloads on the preview origin.
- [ ] Confirm request/error logs contain no project names or content.
- [ ] Record rollback command and execute a preview smoke test after rollback.
- [ ] Obtain explicit approval before production deployment.
