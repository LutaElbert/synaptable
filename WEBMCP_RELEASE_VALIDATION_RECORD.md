# SynapTable WebMCP release validation record

This record covers the local WebMCP implementation candidate. Cloudflare Preview, real agent-capable Chromium, physical-device, assistive-technology, production, and Devpost gates remain separate and must not be inferred from these results.

## Candidate

| Field | Value |
| --- | --- |
| Date | 2026-09-02 |
| Branch | `feat/webmcp-integration` |
| Tested implementation commit | `e6c969dda1a29057e774c384e3f3c8e81585d732` |
| Starting commit | `004be48` |
| Tester | Codex automated local validation; owner/manual gates pending |
| Host | Apple M4, arm64, macOS 26.5.2 |
| Supported test runtime | Node.js 24.19.0 from the Codex workspace runtime |
| Content model | Local-only IndexedDB; no project-content backend or tool telemetry |
| Feature flag | `SYNAPTABLE_WEBMCP_ENABLED`; absent by default |

## Local automated gate

| Command/evidence | Result |
| --- | --- |
| `npm run check` | Pass — Vinext 100% compatible, 0 issues |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | Pass — 167 tests in 22 files |
| `npm audit --audit-level=high` | Pass — 0 vulnerabilities |
| `npm run build` | Pass — default-off production build |
| `git diff --check` | Pass |
| Playwright Chromium, serial | 79/79 pass, including both stress fixtures and four WebMCP cases |
| Playwright Firefox, serial | 76 pass, 3 intentional skips |
| Playwright WebKit, serial | 76 pass, 3 intentional skips |

The complete browser suite defines 237 cases: 231 passing executions and 6 intentional skips. Firefox and WebKit skip the two Chromium-only stress fixtures and their existing browser-specific zoom-extreme hit-target case.

## WebMCP evidence

- The server-side flag accepts only `1` or `true`; absent, blank, malformed, and false values remain disabled.
- A disabled production session with a mocked `document.modelContext` registered zero tools, requested no `webmcp-registration` resource, rendered the existing three-node editor, and showed no error toast.
- An enabled production session registered exactly the six approved tools and no `exposedTo` option.
- Tool definitions carry the approved input schemas; both reads have `readOnlyHint: true`, all mutations have `readOnlyHint: false`, and every result is marked with `untrustedContentHint: true`.
- The browser journey proves persisted concept creation, one-step undo/redo, reload restoration, registration after reload, concurrent same-revision serialization, stale replay rejection, already-aborted cancellation, and old-project-context rejection after a visible project switch.
- Focused tests cover schema defaults and rejection, 256 KiB input and 1,500-byte result budgets, table aggregate/product limits, duplicate IDs, invalid positions, prompt-like plain cell text, searchable-but-undisclosed concept bodies, hidden/locked protection, header-row rejection, cancellation, persistence failure, strict-mode cleanup/remount, and late registration abortion.
- Ajv generates committed standalone validators. Production CSP does not require `unsafe-eval`, and a fingerprint test fails if the approved input schemas and generated validators diverge.
- `Permissions-Policy: tools=(self)` is shared by Next.js and Cloudflare Worker response configuration while camera, geolocation, microphone, payment, and USB remain disabled. Worker responses also retain same-origin resource policy and frame denial.

## Bundle evidence

| Asset | Uncompressed | Gzip | Finding |
| --- | ---: | ---: | --- |
| Editor application chunk | 285,187 B | 81,702 B | Existing startup chunk; WebMCP registration remains separate |
| Lazy WebMCP registration/validator chunk | 50,132 B | 7,494 B | Loaded only when both the server flag and capability detection pass |

Build filenames are content-hashed and will change. Re-measure the exact preview/submission commit.

## Environment-limited and approval-gated work

| Gate | Status | Required next evidence |
| --- | --- | --- |
| Real agent-capable Chromium/WebMCP inspector | Pending environment | Browser/build version, experimental flag state, six-tool discovery, core journey, screenshots/recording |
| Cloudflare Preview | Pending owner approval | Exact URL/commit, HTTPS, actual headers, same-origin isolation, persistence, downloads, content-safe logs, rollback |
| Safari + VoiceOver keyboard workflow | Pending manual test | Tester/date/browser/OS/result |
| Chrome or Edge at 200% zoom | Pending manual test | Tester/date/browser/OS/result |
| Firefox + NVDA | Pending environment | Tester/date/browser/OS/result or explicit unavailable limitation |
| Physical iPhone/iPad and Android | Pending devices | Touch, pan/zoom, tables, backup/export, screen-reader spot checks |
| Google Sheets and Excel CSV interoperability | Pending installed/external apps | Unicode, commas, quotes, multiline, emoji, RTL mapping |
| PNG/SVG/PDF opening and A4/Letter printing | Pending manual output inspection | Format/page/orientation/result |
| Devpost rules and registration | Pending explicit workflow gate | Live official eligibility, deadline, judging, asset, access, and submission requirements |
| Production deployment | Not authorized | Separate explicit owner approval |
| Final Devpost submission | Not authorized | Prepared assets, fresh-browser judge smoke, and explicit final confirmation |

## Local implementation verdict

**Pass.** The WebMCP code, disabled-mode progressive enhancement, command safety, browser regressions, and local production build satisfy the local implementation gate. This is not yet a preview-complete or submission-ready verdict; the environment-limited and approval-gated rows above remain open.
