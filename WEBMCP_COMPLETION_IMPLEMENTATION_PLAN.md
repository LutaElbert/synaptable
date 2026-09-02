# SynapTable WebMCP Completion Implementation Plan

**Created:** 2026-09-02
**Implementation branch:** `feat/webmcp-integration`
**Source contracts:** [`WEBMCP_TOOL_STRATEGY.md`](./WEBMCP_TOOL_STRATEGY.md), [`WEBMCP_TOOL_SCHEMAS.json`](./WEBMCP_TOOL_SCHEMAS.json), and [`WEBMCP_READINESS_AUDIT.md`](./WEBMCP_READINESS_AUDIT.md)
**Plan status:** Ready for implementation; no WebMCP runtime behavior is enabled by this document

## 1. Objective

Make SynapTable ready for a WebMCP hackathon submission without weakening its local-first behavior or implying production approval.

The completed work must:

1. progressively enhance an already-working editor;
2. register exactly the six approved WebMCP tools only when explicitly enabled;
3. route every tool through the existing project/revision and atomic command-safety boundary;
4. keep mutations reversible, persisted, cancellable, and free of partial state;
5. prevent cross-project disclosure, prompt-injection behavior, oversized payloads, and cross-origin exposure;
6. produce automated, browser, Cloudflare Preview, release-proof, and submission evidence;
7. conserve GitHub Actions quota by validating locally before one final pull request; and
8. require separate approval before production deployment or final Devpost submission.

## 2. Current baseline

Already complete:

- Typed editor commands and read queries for the six approved actions.
- Active-project, expected-revision, cancellation, serialized commit, safe-exception, and 1,500-byte command-result guards.
- One-command/one-undo and persistence behavior at the command boundary.
- Approved WebMCP tool names, descriptions, risk classes, annotations, schemas, budgets, threat model, and error taxonomy.
- Existing cross-browser editor regression coverage and release-validation record.

Still missing:

- Typed command failure codes.
- Runtime schema validation and WebMCP result normalization.
- WebMCP API types, feature flag, registration lifecycle, and React integration.
- The six tool adapters.
- `Permissions-Policy: tools=(self)` in both response paths.
- WebMCP-specific automated and manual browser proof.
- Cloudflare Preview evidence.
- Official Devpost requirements, submission assets, and verified submission.

## 3. Delivery and quota strategy

- Use the existing `feat/webmcp-integration` branch. Do not use a `codex/` prefix.
- Work in local commits by phase, but do not push each phase as a separate pull request.
- Run focused tests during implementation and the complete local gate once at the end.
- Push only after the complete local gate passes.
- Open one final pull request. The normal pull-request CI and post-merge `main` CI are the only planned GitHub Actions runs.
- Do not use GitHub Actions as a debugging loop.
- Do not deploy to production. Cloudflare Preview deployment is a separate approval gate.
- Preserve unrelated user changes and stop if the implementation overlaps them materially.

Suggested local commits:

1. `docs: add WebMCP completion plan`
2. `refactor: add typed editor command failures`
3. `feat: add WebMCP registration foundation`
4. `feat: expose approved canvas tools`
5. `test: validate WebMCP security and lifecycle`
6. `docs: record WebMCP preview and submission evidence`

## 4. Target architecture

```text
WEBMCP_TOOL_SCHEMAS.json
        ↓ compile once when enabled
WebMCP input validator and result normalizer
        ↓
Six static tool definitions
        ↓ execute with active session + AbortSignal
Editor command/query safety boundary
        ↓ serialized mutation
Undo transaction + local persistence + revision increment
        ↓
Bounded untrusted result returned to the agent
```

Recommended modules:

```text
app/editor/webmcp/
  webmcp-types.ts           experimental browser API and catalog types
  webmcp-feature.ts         disabled-by-default flag and capability detection
  webmcp-schema.ts          catalog loading, Ajv compilation, defaults, byte limits
  webmcp-results.ts         typed errors and bounded public result envelopes
  webmcp-tools.ts           six tool adapters mapped to editor commands/queries
  webmcp-registration.ts    register-once lifecycle and AbortController cleanup
  webmcp-*.test.ts          focused schema, tool, lifecycle, and security tests
```

Use a direct, pinned-compatible Ajv 2020 dependency for runtime input validation. Compile the six schemas once in a dynamically loaded WebMCP chunk after both the feature flag and browser capability pass. Do not rely on an undeclared transitive dependency. Record the resulting lazy-chunk size and keep Ajv out of the ordinary editor startup path.

The React editor owns one registration controller. Tool callbacks read the current session, active project metadata, viewport-center resolver, command queue, commit callback, and notification callback through stable refs. Canvas state changes must not re-register the tools.

## 5. Phase 0 — establish requirements and baseline

### Work

1. Initialize the repository's Devpost workflow with `$start-hackathon` before submission preparation.
2. Fetch and acknowledge the official rules through the Devpost workflow.
3. Record the exact eligibility, deadline, judging criteria, required fields, demo/repository visibility, video, and testing-access requirements.
4. Record the starting commit and rerun focused command-safety tests before WebMCP changes.
5. Add a new WebMCP candidate section or dated copy of `RELEASE_VALIDATION_RECORD.md` rather than overwriting earlier evidence.

### Acceptance criteria

- [ ] `.devpost-hackathon-state.json` exists and identifies the intended event workflow.
- [ ] Official rules are acknowledged through the required explicit Devpost gate.
- [ ] Submission requirements are recorded from the official source, not memory or web search.
- [ ] The implementation starting commit and baseline focused-test results are recorded.
- [ ] No application or deployment behavior changes during baseline collection.

## 6. Phase 1 — typed command and safety failures

### Work

1. Introduce the stable `ToolErrorCode` values already approved in the strategy:
   - `CANCELLED`
   - `PROJECT_CHANGED`
   - `STALE_REVISION`
   - `INVALID_INPUT`
   - `NOT_FOUND`
   - `PROTECTED_CONTENT`
   - `LIMIT_EXCEEDED`
   - `CONFLICT`
   - `PERSISTENCE_FAILED`
   - `INTERNAL_ERROR`
2. Make editor command results a discriminated success/failure union while preserving the existing user-facing `summary`.
3. Require every command failure site to provide a code directly. Do not infer codes from message text.
4. Update project, revision, cancellation, invalid-outcome, exception, and commit-failure paths in `editor-command-safety.ts` with explicit codes.
5. Keep current UI behavior unchanged; existing UI callers continue to display `summary` and may ignore the code.
6. Update result bounding so failure codes survive truncation while canvas data, stack traces, storage details, and local paths cannot appear.

### Focused test cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| FND-001 | Execute with an already-aborted signal | `CANCELLED`; original nodes/edges/revision; no commit |
| FND-002 | Execute with another active project ID | `PROJECT_CHANGED`; `refreshRequired: true`; no state disclosure |
| FND-003 | Execute with an old revision | `STALE_REVISION`; no mutation or undo |
| FND-004 | Command receives a missing entity | `NOT_FOUND` from the command, not message parsing |
| FND-005 | Command targets a hidden or locked entity | `PROTECTED_CONTENT`; no automatic reveal/unlock |
| FND-006 | Command exceeds a defined content/count limit | `LIMIT_EXCEEDED`; original state retained |
| FND-007 | Command throws unexpectedly | `INTERNAL_ERROR`; generic summary; no stack or document data |
| FND-008 | Atomic commit rejects | `PERSISTENCE_FAILED`; no success publication or revision advance |
| FND-009 | Bound a long failure result | Code and corrective summary remain; serialized output ≤1,500 bytes |
| FND-010 | Existing UI invokes migrated commands | Visible behavior, selection, undo, and announcements remain unchanged |

### Acceptance criteria

- [ ] Every failure path produces one stable code without inspecting its summary.
- [ ] Existing successful command result shapes remain usable by the UI.
- [ ] Failed, stale, cancelled, and unsaved operations retain their original state and revision.
- [ ] Unit tests cover every approved error code.
- [ ] Existing editor command, safety, undo, persistence, and UI tests remain green.

## 7. Phase 2 — WebMCP registration foundation

### 2A. Feature flag and API boundary

#### Work

1. Add `NEXT_PUBLIC_SYNAPTABLE_WEBMCP_ENABLED` with an explicit parser that treats only `1` or `true` as enabled.
2. Default to disabled when absent, blank, malformed, or false.
3. Define the minimum experimental `Document.modelContext` types locally. Do not broaden global types beyond the API members used.
4. Capability-detect the API at runtime after the client mounts.
5. Dynamically load the WebMCP implementation only when the flag and capability are both present.
6. Do not add a required WebMCP status UI. Unsupported and disabled browsers retain the current editor.
7. Do not fall back to the deprecated `navigator.modelContext` API and do not implement an `unregisterTool` shim.

#### Test cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| REG-001 | Flag absent and API present | No dynamic import and no registration |
| REG-002 | Flag false and API present | No registration |
| REG-003 | Flag true and API absent | No exception, warning spam, UI change, or registration |
| REG-004 | Flag true and API present | WebMCP module loads once |
| REG-005 | Malformed flag value | Treated as disabled |
| REG-006 | Server rendering | No access to `document` or browser-only API |

### 2B. Schema validation and normalization

#### Work

1. Import the catalog as the single source for definitions and input schemas.
2. Compile all six standalone input schemas once using Ajv 2020.
3. Reject invalid JSON objects, unknown properties, incorrect types, missing context, duplicate IDs, and schema boundary violations before calling commands.
4. Apply schema defaults explicitly in normalization code.
5. Enforce the 256 KiB serialized-input budget before deep processing.
6. Enforce `create_table`'s 100,000 aggregate initial-character budget and 2,000-cell product rule.
7. Reject non-finite positions and positions outside ±1,000,000.
8. Normalize results into the approved read, mutation, and failure envelopes.
9. Enforce the final 1,500 UTF-8 byte budget after adding project ID, revision, count, warnings, and data.

#### Test cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| SCH-001 | Catalog loads | Exactly six unique definitions compile |
| SCH-002 | Unknown input property | `INVALID_INPUT`; adapter not invoked |
| SCH-003 | Missing project/revision on non-bootstrap tool | `INVALID_INPUT` |
| SCH-004 | Duplicate layer/row/column IDs | Schema rejection before command execution |
| SCH-005 | NaN, Infinity, or out-of-range position | `INVALID_INPUT` |
| SCH-006 | 100×30 table request | `LIMIT_EXCEEDED` because product exceeds 2,000 |
| SCH-007 | Initial table text exceeds 100,000 aggregate characters | `LIMIT_EXCEEDED` |
| SCH-008 | Serialized input exceeds 256 KiB | `LIMIT_EXCEEDED` without document access |
| SCH-009 | Optional fields omitted | Adapter applies approved defaults |
| SCH-010 | Result contains long names and many IDs | Names/IDs truncate safely; count preserved; output ≤1,500 bytes |
| SCH-011 | Unicode and RTL input at limits | Valid data is preserved without byte-budget overflow |
| SCH-012 | Prototype-like keys such as `__proto__` | Closed schema rejects them and state is unchanged |

### 2C. Registration lifecycle

#### Work

1. Keep six definitions static; validate active state during execution rather than re-registering on selection changes.
2. Create one registration `AbortController` per mounted editor registration owner.
3. Pass the registration signal to every `registerTool` call and omit `exposedTo`.
4. Pass each execution callback's `AbortSignal` through input normalization and the guarded command/read request.
5. Abort the previous registration set before a replacement is installed.
6. Abort registrations on teardown.
7. Use a generation token or equivalent guard so late asynchronous registration completion cannot revive an obsolete set.
8. Keep input/result contents out of production logs.

#### Test cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| REG-007 | First capable mount | Exactly six tools register |
| REG-008 | Canvas state or selection changes | No re-registration |
| REG-009 | React Strict Mode mount-cleanup-remount | One current set; obsolete signal aborted |
| REG-010 | Component teardown | All registrations are removed through abort |
| REG-011 | Late registration resolves after teardown | It cannot become active |
| REG-012 | Execution signal aborts before validation | `CANCELLED`; no state read |
| REG-013 | Execution signal aborts after pure command | No commit or partial state |
| REG-014 | Registration definition inspection | Exact catalog name, description, schema, and annotations; no project content |
| REG-015 | Production logging spy | No full input, result, project name, note, or cell text logged |

### 2D. Permissions Policy

#### Work

1. Append `tools=(self)` to the existing `Permissions-Policy` value in `next.config.ts`.
2. Append the identical policy to the Cloudflare `worker.ts` response headers.
3. Preserve the existing camera, geolocation, microphone, payment, and USB restrictions.
4. Do not add an iframe `allow="tools"` attribute or WebMCP `exposedTo` origin.
5. Add focused header tests or configuration assertions for both response paths.

#### Acceptance criteria for Phase 2

- [ ] WebMCP is disabled by default and ordinary startup does not load its implementation chunk.
- [ ] A capable, explicitly enabled browser registers exactly six static definitions.
- [ ] Unsupported browsers and server rendering retain current behavior without errors.
- [ ] All tool inputs pass schema and runtime validation before state access.
- [ ] Cancellation and teardown cannot leave active or partial work.
- [ ] Duplicate registrations do not survive remounts.
- [ ] Both configured response paths contain `tools=(self)` and all existing restrictions.
- [ ] No cross-origin exposure option is present.

## 8. Phase 3 — connect the six tools

### Shared adapter rules

- `get_workspace_summary` is the only tool without project/revision input.
- It binds to the active project at invocation and bootstraps the current revision.
- Every other tool requires an exact active `projectId` and `expectedRevision`.
- Successful reads preserve the revision; successful mutations return the incremented committed revision.
- Mutations go through `EditorCommandQueue`; reads use `readEditorStateSafely`.
- Resolve an omitted position from the visible canvas center immediately before constructing the command.
- All success/failure results use the catalog's bounded public envelopes.

### Tool cases and acceptance criteria

#### `get_workspace_summary`

| ID | Scenario | Expected result |
| --- | --- | --- |
| TOOL-001 | Active project with mixed layers | Correct ID, revision, counts by type, connector/hidden/locked counts |
| TOOL-002 | Selection includes hidden layer | Only visible selected IDs returned |
| TOOL-003 | More than 25 selected layers | At most 25 IDs; complete counts retained; bounded output |
| TOOL-004 | Project contains notes, cells, images, and URLs | None of those bodies/bytes/URLs are returned |
| TOOL-005 | Two unchanged calls | Deterministic project/revision/count result |

Acceptance:

- [ ] Caller cannot select an arbitrary project.
- [ ] Result provides sufficient context for the next tool without exposing full content.
- [ ] `readOnlyHint` and `untrustedContentHint` are both true.

#### `find_layers`

| ID | Scenario | Expected result |
| --- | --- | --- |
| TOOL-006 | Empty query | Bounded visible layer list |
| TOOL-007 | Case-insensitive concept/table search | Correct IDs, kinds, and short names |
| TOOL-008 | Kind filter | Only approved requested kinds returned |
| TOOL-009 | Hidden matching layer | Excluded |
| TOOL-010 | Long labels and more matches than limit | Names ≤80 characters and `truncated: true` |
| TOOL-011 | Wrong project or stale revision | Typed refresh-required failure and no match data |

Acceptance:

- [ ] Bodies and table cells may be searched internally but are never returned.
- [ ] Requested limit is 1–20 and output budgeting may safely reduce it.
- [ ] `readOnlyHint` and `untrustedContentHint` are both true.

#### `create_concept`

| ID | Scenario | Expected result |
| --- | --- | --- |
| TOOL-012 | Defaults and no position | One concept at visible canvas center |
| TOOL-013 | Explicit valid position/text | Exact plain text and centered placement |
| TOOL-014 | Boundary and over-limit text | Boundary accepted; over-limit rejected atomically |
| TOOL-015 | Cancel before commit | No concept, undo, persistence write, or revision advance |
| TOOL-016 | Successful creation | Created ID, affected count 1, new revision, one undo, reload persistence |

Acceptance:

- [ ] Exactly one concept is created and selected on success.
- [ ] Existing nodes/edges are not otherwise modified beyond current selection behavior.
- [ ] `readOnlyHint` is false and `untrustedContentHint` is true.

#### `create_table`

| ID | Scenario | Expected result |
| --- | --- | --- |
| TOOL-017 | Defaults | One 3×3 header table at visible center |
| TOOL-018 | Valid explicit matrix | Values map row-major as plain text |
| TOOL-019 | Matrix exceeds requested dimensions | Atomic `INVALID_INPUT` failure |
| TOOL-020 | Rows, columns, product, cell, aggregate, or byte limit exceeded | `LIMIT_EXCEEDED`; no table |
| TOOL-021 | Formula-, HTML-, URL-, or instruction-like cell text | Stored as plain text; never executed/interpreted |
| TOOL-022 | Successful creation | One table ID, new revision, one undo, reload persistence |

Acceptance:

- [ ] Table dimensions and initial values match normalized input exactly.
- [ ] No partial table is created on any invalid cell or dimension.
- [ ] `readOnlyHint` is false and `untrustedContentHint` is true.

#### `organize_layers_into_table`

| ID | Scenario | Expected result |
| --- | --- | --- |
| TOOL-023 | Valid explicit visible layers | One table created in canvas reading order |
| TOOL-024 | Duplicate, missing, hidden, or locked source | Typed atomic failure |
| TOOL-025 | Source belongs to inactive project | Project/revision rejection without disclosure |
| TOOL-026 | 99 sources | Accepted within table limit and bounded result |
| TOOL-027 | Successful conversion | Originals and connectors byte-for-byte unchanged; one undo; reload persistence |

Acceptance:

- [ ] Only explicit source IDs are used.
- [ ] Originals are retained and not reformatted, moved, hidden, or disconnected.
- [ ] Result contains the new table ID, not source content.

#### `create_canvas_nodes_from_rows`

| ID | Scenario | Expected result |
| --- | --- | --- |
| TOOL-028 | Valid explicit data rows/columns | One concept per row using only selected columns |
| TOOL-029 | Header-row ID | Rejected before mutation |
| TOOL-030 | Duplicate/missing row or column | Typed atomic failure |
| TOOL-031 | Hidden, locked, or wrong-type table | Typed protected/not-found failure |
| TOOL-032 | More than 25 rows | Schema rejection before command execution |
| TOOL-033 | Successful conversion | Table unchanged; all created IDs/count; one undo; reload persistence |

Acceptance:

- [ ] There is no implicit “all rows” agent behavior.
- [ ] Source table, cells, formatting, dimensions, and position remain unchanged.
- [ ] Output remains ≤1,500 bytes while `affectedCount` remains complete.

### Phase 3 acceptance criteria

- [ ] Exactly six tools are exposed and each maps to only its approved query/command.
- [ ] All four mutations create exactly one undo entry and persist before success.
- [ ] Every failure/cancellation leaves nodes, edges, history, persistence, and revision unchanged.
- [ ] Returned revisions support safe sequential multi-tool workflows.
- [ ] No deferred operation becomes reachable indirectly.

## 9. Phase 4 — security and adversarial validation

### Automated cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| SEC-001 | Prompt-injection text in project name | Returned only as truncated untrusted data; no tool behavior change |
| SEC-002 | Prompt-injection text in concept body | Search may match; body is never returned or executed |
| SEC-003 | Prompt-injection text in table cell | Search/conversion treats it as plain data |
| SEC-004 | Project A IDs used after switching to Project B | Rejected; no A names/counts/content disclosed |
| SEC-005 | Repeat successful mutation using old revision | `STALE_REVISION`; no duplicate object |
| SEC-006 | Two concurrent mutations share a revision | Queue commits at most one; the other fails stale |
| SEC-007 | Oversized nested Unicode arrays | Rejected within input budget without UI freeze or document access |
| SEC-008 | Storage exception includes sensitive internal message | Public result is generic and contains no internal details |
| SEC-009 | Cross-origin iframe attempts discovery | Tools unavailable without an explicit opt-in |
| SEC-010 | Inspect registered definitions | No secrets, project content, user names, or dynamic instructions |

### Acceptance criteria

- [ ] Stored text cannot alter tool definitions, validation, routing, confirmation, or follow-up behavior.
- [ ] No tool can read or mutate a non-active project.
- [ ] Stale/repeated/concurrent requests cannot silently duplicate mutations.
- [ ] No public failure leaks stack traces, IndexedDB keys, local paths, storage contents, or unrelated IDs.
- [ ] Cross-origin access remains disabled by headers, registration options, and iframe policy.

## 10. Phase 5 — local automated and browser regression gate

### Focused loop during implementation

- Run only affected Vitest files after each code change.
- Run only affected Playwright specs when UI/editor integration changes.
- Use serial browser execution when collecting final cross-browser evidence.

### Final local gate

Run once after all implementation and focused tests pass:

```text
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
npm run test:e2e -- --project=chromium --workers=1
npm run test:e2e -- --project=firefox --workers=1
npm run test:e2e -- --project=webkit --workers=1
```

Record test counts, intentional skips, bundle sizes, and the commit in the release-validation record.

### Browser acceptance criteria

- [ ] Chromium, Firefox, and WebKit existing editor suites have no new unexplained failure or skip.
- [ ] Feature disabled produces no behavioral or accessibility regression.
- [ ] The editor startup bundle does not eagerly absorb the WebMCP/Ajv implementation.
- [ ] Any new lazy chunk and gzip size are recorded and reviewed.
- [ ] The working tree has no generated browser artifacts or unrelated changes.

## 11. Phase 6 — agent-capable Chromium computer-use validation

Use the in-app browser/computer-use tool when an agent-capable Chromium build and WebMCP inspector are available. Current project guidance checked on 2026-09-02 identifies Chromium 146.0.7672.0 or newer with `#enable-webmcp-testing` as the preview baseline; re-check the official WebMCP documentation before execution because the API is evolving. Automated unit tests remain the source for edge cases; computer use proves the visible end-to-end workflow.

### Manual cases

| ID | Operator workflow | Expected visible/evidence result |
| --- | --- | --- |
| BRW-001 | Open with flag disabled | No tools discovered; editor works normally |
| BRW-002 | Enable flag and reload | Exactly six tools discovered with approved hints/schemas |
| BRW-003 | Ask agent for workspace summary then layer search | Correct active project/revision and bounded results |
| BRW-004 | Ask agent to create concept and table | Visible selected layers, success result, revision increment |
| BRW-005 | Organize explicit nodes into table | New table; originals visibly unchanged |
| BRW-006 | Convert explicit table rows to concepts | New concepts; source table visibly unchanged |
| BRW-007 | Undo each mutation | One undo reverses one tool action |
| BRW-008 | Reload after mutations | Successful actions persist |
| BRW-009 | Change canvas between context read and mutation | Agent receives stale-context recovery instruction |
| BRW-010 | Cancel an invocation | No partial layer or undo entry |
| BRW-011 | Switch projects and replay old IDs | Rejection with no old-project disclosure |
| BRW-012 | Open unsupported browser | Existing UI remains functional without tool errors |

### Evidence

- Record browser version, WebMCP flag/origin-trial state, inspector version, tester, date, commit, result, and screenshots or recordings where useful.
- Redact project content from screenshots if it is not intended for the submission.
- Do not mark a case passed based only on unit tests when the case explicitly requires computer use.

### Acceptance criteria

- [ ] All twelve manual cases pass or have an explicit, non-blocking environment limitation.
- [ ] The core six-tool journey passes without developer-console intervention.
- [ ] Visible canvas state, agent result, undo state, and reload state agree.

## 12. Phase 7 — Cloudflare Preview validation

Preview deployment requires owner approval. It does not authorize production deployment.

### Deployment procedure

1. Build locally and deploy using the existing preview command.
2. Enable `NEXT_PUBLIC_SYNAPTABLE_WEBMCP_ENABLED=true` only for the approved preview environment.
3. Capture the exact preview URL and commit.
4. Use browser/network inspection or `curl -I` to verify the actual document response.
5. Run the core agent workflow against the deployed origin.
6. Disable the flag or roll back the preview if a security, persistence, or registration gate fails.

### Preview test cases

| ID | Check | Expected result |
| --- | --- | --- |
| CF-001 | HTTPS and secure context | Both present |
| CF-002 | `Permissions-Policy` response | Contains `tools=(self)` plus existing restrictions |
| CF-003 | Origin isolation | WebMCP available; no `Origin-Agent-Cluster: ?0` opt-out |
| CF-004 | Same-origin discovery | Six tools discoverable on the top-level preview page |
| CF-005 | Cross-origin iframe | Tools not discoverable without explicit opt-in |
| CF-006 | Persistence/reload | Successful mutation survives reload in the same browser profile |
| CF-007 | Existing downloads | PNG/SVG/PDF/CSV behavior remains available and unchanged |
| CF-008 | Privacy-safe logs | No full input/result, note, table cell, image data, or local state logged |
| CF-009 | Unsupported/flag-off preview | Editor works and registers no tools |
| CF-010 | Rollback | Previous deployment or disabled flag can be restored and verified |

### Acceptance criteria

- [ ] All actual response headers match the intended configuration.
- [ ] The deployed core six-tool journey passes.
- [ ] Persistence remains browser-local; no project-content backend is introduced.
- [ ] Logs and errors are content-safe.
- [ ] Rollback is documented and exercised or otherwise proven repeatable.
- [ ] Production remains untouched.

## 13. Phase 8 — existing release-proof gates

These checks remain required for full product release evidence. They are hackathon-submission blockers only when the official requirements or judge workflow depend on them. Otherwise, record the untested environment or limitation honestly.

| ID | Environment/workflow | Required evidence |
| --- | --- | --- |
| REL-001 | Safari + VoiceOver, keyboard-only ideas→table→canvas→backup/export | Tester/date/version/result |
| REL-002 | Chrome or Edge at 200% zoom | Core canvas/table/tools remain visible and operable |
| REL-003 | Firefox + NVDA when available | Project dialog, semantic table, selection, conversion announcements |
| REL-004 | Physical iPhone/iPad Safari | Touch panels, cells, pan/zoom, backup/export, VoiceOver spot check |
| REL-005 | Physical Android Chrome | Touch panels, cells, pan/zoom, backup/export, TalkBack spot check |
| REL-006 | CSV in Google Sheets and Excel | Unicode, commas, quotes, multiline content, expected column mapping |
| REL-007 | PNG/SVG/PDF opening and A4/Letter printing | Files open; Letter/A4 portrait/landscape output checked |

Acceptance:

- [ ] Every available environment has tester, date, version, and result recorded.
- [ ] Unavailable environments are marked unavailable, not passed.
- [ ] Any failure in the core submission demo is fixed before submission.
- [ ] Non-core limitations are disclosed in submission testing notes when relevant.

## 14. Phase 9 — submission preparation and verification

Do not invent the official checklist. Populate required fields only after Phase 0 retrieves the live Devpost requirements.

### Submission assets

- Public or judge-accessible Cloudflare Preview URL.
- Repository URL and README with setup, architecture, privacy, and testing instructions.
- Two-to-three-minute demonstration showing discovery and use of the six tools.
- Thumbnail and screenshots.
- Problem, target user, solution, and why WebMCP is essential.
- Technical architecture, command safety, local-first privacy, and security explanation.
- Challenges, accomplishments, known limitations, and next steps.
- Third-party libraries/assets and usage rights or attribution.
- Judge test script using a fresh browser profile.

### Judge smoke test

| ID | Scenario | Expected result |
| --- | --- | --- |
| SUB-001 | Open public demo in fresh supported browser | App loads without local setup errors |
| SUB-002 | Discover tools | Exactly six approved tools |
| SUB-003 | Run summary→create→organize→convert journey | Complete visible workflow succeeds |
| SUB-004 | Undo and reload | Mutations are reversible and persistent |
| SUB-005 | Follow README/testing instructions | Another tester can reproduce the demo |
| SUB-006 | Open every submitted link/video/image | Publicly accessible and correct |
| SUB-007 | Compare submission claims with product | No unsupported or production-readiness claim |

### Acceptance criteria

- [ ] Every officially required field and asset is present.
- [ ] Demo, repository, video, screenshots, and testing instructions open without owner-only access.
- [ ] The demo video clearly shows WebMCP performing product actions, not only UI clicking.
- [ ] Known limitations and local-first persistence are explained accurately.
- [ ] The final form is reviewed before submission.
- [ ] Devpost submission occurs only after the user's explicit final confirmation.
- [ ] The public submitted project page is fetched and verified after submission.

## 15. Deferred and prohibited scope

Do not add these to the initial WebMCP catalog or expand this branch to include them:

- `connect_layers`.
- Project/layer deletion or clearing.
- Checkpoint restore, backup import, or project replacement.
- PNG, SVG, PDF, CSV, or project export/download tools.
- Arbitrary table-cell mutation.
- Agent-driven rich-text formatting.
- Formulas, calculations, filtering, grouping, or sorting.
- Hidden or locked layer mutation.
- Cross-origin `exposedTo` registration.
- Project-content telemetry or backend sync.
- Production deployment.

Any deferred tool requires a new strategy/schema review, threat-model update, tests, and explicit approval.

## 16. Stop conditions

Stop implementation or deployment and report the blocker when:

- the WebMCP API or schema differs materially from the approved current draft;
- correct cancellation cannot be guaranteed before commit;
- typed error migration changes existing UI behavior unexpectedly;
- Ajv is added to the ordinary startup bundle or creates an unacceptable size regression;
- any cross-project content is returned;
- duplicate registrations survive cleanup;
- actual Cloudflare headers differ from both configured response paths;
- production deployment would be required without explicit approval;
- official Devpost requirements conflict with the planned scope; or
- unrelated user changes overlap the same code and cannot be preserved safely.

## 17. Final definition of done

### Implementation complete

- [ ] Typed failures, schema validation, feature flag, registration lifecycle, headers, and six adapters are implemented.
- [ ] All focused foundation, schema, lifecycle, tool, and security tests pass.
- [ ] Complete local compatibility, type, lint, unit, build, audit, and serial browser gates pass.

### Preview complete

- [ ] Agent-capable Chromium computer-use validation passes.
- [ ] Approved Cloudflare Preview validation passes, including actual headers, privacy, persistence, and rollback.
- [ ] Release record contains the exact candidate commit and evidence.

### Submission ready

- [ ] Official rules and requirements are confirmed and acknowledged.
- [ ] Required release-proof checks are complete or honestly documented as limitations.
- [ ] Demo, video, README, screenshots, thumbnail, write-up, credits, and judge instructions are complete.
- [ ] Fresh-browser judge smoke passes.
- [ ] One final PR passes CI and is merged.

### Submitted

- [ ] User gives explicit final submission confirmation.
- [ ] Devpost accepts the project.
- [ ] The public project page is verified live.

Production release remains a separate future approval even after all hackathon submission boxes are checked.
