# SynapTable WebMCP Readiness Audit

**Audit date:** 2026-09-02  
**Status:** Local implementation complete; preview and manual gates pending
**Overall verdict:** **AMBER — the six-tool implementation and local regression/security gates are green, but real agent-capable Chromium, Cloudflare Preview, release-proof, Devpost, and production approval gates remain open.**

## Purpose and scope

This audit began with one question: **what must SynapTable have in place before WebMCP is added?** It now records that the local implementation gate is complete and identifies the remaining external evidence.

It covers the local-first canvas architecture, implemented agent-facing actions, security and privacy boundaries, browser/deployment requirements, and the tests required before tools are enabled beyond local validation.

WebMCP is currently an experimental Draft Community Group Report. SynapTable must therefore treat it as progressive enhancement: the editor must remain fully functional when the API is unavailable.

## Executive findings

SynapTable already has a good foundation:

- Versioned project persistence with runtime validation and migration.
- Stable UUID-based project, node, and edge identities.
- Undo/redo and autosave behavior.
- Project isolation and local-first storage.
- A broad automated test suite around existing canvas behavior.
- A visible, user-controlled browser workspace, which is a good match for WebMCP's interaction model.

The audit's original architectural gap has been remediated. The approved actions use a typed editor-command facade plus project/revision, cancellation, serialization, persistence, and output-budget guards. The WebMCP adapter, CSP-safe schema validation, registration lifecycle, same-origin headers, and six tool mappings are implemented behind a disabled-by-default server flag.

**Current recommendation:** use [`WEBMCP_RELEASE_VALIDATION_RECORD.md`](./WEBMCP_RELEASE_VALIDATION_RECORD.md) to complete real agent-browser and approved Cloudflare Preview evidence. Keep production and final Devpost submission behind their separate explicit approvals.

```text
Toolbar / keyboard / canvas UI ─┐
                               ├─> Editor command facade ─> validated state mutation
WebMCP tool adapter ────────────┘                         ├─> one undo entry
                                                         └─> autosave result
```

## Readiness scorecard

| Area | Status | Finding |
| --- | --- | --- |
| Product/data baseline | Green | Versioned schema, UUIDs, validation, persistence, and undo already exist. |
| Command architecture | Green | The UI and future adapter share typed commands/queries with atomic safety guards. |
| Initial tool strategy | Green | Six tools, risk classes, schemas, budgets, and policies are defined in [`WEBMCP_TOOL_STRATEGY.md`](./WEBMCP_TOOL_STRATEGY.md). |
| Runtime validation | Green locally | Typed errors, precompiled closed schemas, business limits, and bounded result envelopes are implemented and tested. |
| Human control | Green for initial scope | The initial catalog contains only reads and reversible mutations with visible results and undo; destructive tools are deferred. |
| Security and privacy | Green locally | Same-origin policy, untrusted annotations, content minimization, project isolation, budgets, and content-safe failures are enforced and tested. |
| Registration lifecycle | Green locally | Feature detection, static registration, abort cleanup, remount protection, cancellation, and unsupported-browser behavior are tested. |
| Deployment policy | Amber | Both response paths configure `tools=(self)`, but the actual Cloudflare Preview response and origin behavior need approved verification. |
| Tests and evaluations | Amber | Unit and mocked cross-browser WebMCP cases pass; real agent-capable Chromium and manual release environments remain. |
| Progressive enhancement | Green | Default-off mode loads no registration chunk; unsupported browsers retain the existing editor. |

## Existing release proof remains required

The manual validations already recorded in [`RELEASE_VALIDATION_RECORD.md`](./RELEASE_VALIDATION_RECORD.md) remain open release gates. They are **not known bugs**, and this WebMCP audit does not replace or close them.

| Validation | Before command-facade work | Before enabling WebMCP in preview | Before production |
| --- | --- | --- | --- |
| Safari + VoiceOver and keyboard-only core workflow | Capture a baseline if the required environment is available. | Re-run affected core workflows to prove progressive enhancement caused no regression. | Required evidence. |
| Chrome/Edge at 200% zoom | Capture a baseline. | Re-run editor and any WebMCP status/approval UI. | Required evidence. |
| Firefox + NVDA when available | Optional baseline when the environment is available. | Confirm the unsupported/non-agent browser workflow remains unchanged. | Required when the agreed Windows environment is available; otherwise record the limitation and substitute coverage explicitly. |
| Physical iPhone/iPad and Android touch testing | Not a blocker for command extraction. | Smoke the unchanged editor; WebMCP must not alter touch behavior. | Required evidence on both platform families. |
| CSV interoperability with Google Sheets and Excel | Not a blocker because export is excluded from the initial tool catalog. | No WebMCP-specific rerun unless a tool later reads or exports tables. | Required evidence. |
| PNG/SVG/PDF opening and A4/Letter printing | Not a blocker because download/export tools are excluded initially. | No WebMCP-specific rerun unless export becomes tool-accessible. | Required evidence. |
| Cloudflare preview headers, persistence, downloads, privacy, logs, and rollback | Preserve the current preview checklist. | Required on the actual preview origin, including WebMCP Permissions Policy, feature flag, same-origin exposure, and rollback. | Required evidence and approval. |
| Production deployment | Never implied by passing local or preview tests. | Not applicable. | Separate explicit owner approval is mandatory. |

This creates two distinct gates:

1. **Ready to start WebMCP preparation:** command-facade refactoring may begin while device, assistive-technology, export interoperability, and deployment approvals remain pending.
2. **Ready to enable/release WebMCP:** relevant accessibility and browser regressions, the real Cloudflare preview, security/privacy behavior, observability, and rollback must have recorded evidence. Production still requires a separate approval.

The authoritative status, tester, date, environment, result, and evidence links belong in `RELEASE_VALIDATION_RECORD.md`, not duplicated here.

## P0 requirements before registering tools

### WMCP-01: Introduce a typed editor-command facade

Extract state-changing operations from React event handlers into commands that can run without clicking or querying the DOM.

Each command must:

- Accept explicit project and entity identifiers instead of relying on transient selection when practical.
- Validate the active project and referenced entities.
- Enforce current size, table, connection, lock, and visibility rules.
- Produce exactly one undo transaction for one successful command.
- Complete the corresponding persistence update before reporting success.
- Return a deterministic result object instead of UI-only side effects.
- Be callable by both the current UI and unit/integration tests.

The first extraction should cover concept creation, table creation, converting layers to table rows, converting table rows to nodes, and connections. Table commands are a direct WebMCP prerequisite because they are central to the intended agent workflow.

### WMCP-02: Approve a small, non-overlapping tool catalog

Start with tools that map to the critical canvas journey. Avoid generic tools such as `edit_canvas` or multiple tools that perform the same action.

Every tool specification must document:

- Name and plain-language purpose.
- Risk class: read-only, reversible mutation, or destructive.
- Input JSON Schema plus runtime business validation.
- Concise output schema.
- Project, layer, row, and size limits.
- Whether visible user confirmation is required.
- `readOnlyHint` and `untrustedContentHint` values.
- Undo, autosave, cancellation, and partial-failure behavior.

**Completed specification:** [`WEBMCP_TOOL_STRATEGY.md`](./WEBMCP_TOOL_STRATEGY.md) defines the approved six-tool catalog and policies. [`WEBMCP_TOOL_SCHEMAS.json`](./WEBMCP_TOOL_SCHEMAS.json) is the machine-readable versioned contract for tool definitions, input/output schemas, hints, and budgets.

### WMCP-03: Validate at both schema and runtime boundaries

JSON Schema describes the interface but does not replace application validation. Commands must reject:

- Unknown project, layer, table, row, column, or handle IDs.
- Invalid or oversized dimensions and content.
- Connections disallowed by the existing graph rules.
- Attempts to mutate locked or otherwise protected content.
- Operations against stale or inactive projects.
- Payloads that exceed defined text, row, column, or result budgets.

Errors must be safe, actionable, and must not expose raw document state, stack traces, or browser/storage internals.

### WMCP-04: Define atomic history and persistence behavior

For every mutating tool:

- One successful invocation creates one undo step.
- A failed or cancelled invocation creates no partial state and no undo entry.
- The result is returned only after the in-memory mutation and scheduled persistence outcome are known.
- Duplicate/retried requests must not silently repeat a destructive or expensive mutation.
- Concurrent invocations must either serialize or fail clearly when their starting revision is stale.

Add a project/document revision to command context or implement an equivalent stale-write guard before agent mutations are enabled.

### WMCP-05: Implement a controlled registration lifecycle

The future WebMCP adapter must:

- Feature-detect `document.modelContext` without changing unsupported-browser behavior.
- Register only approved tools.
- Unregister state-dependent tools when they are no longer valid, or preferably keep tools static and validate state at execution time.
- Respect the `AbortSignal` passed to execution and avoid committing cancelled work.
- Prevent duplicate registration during React remounts or development strict mode.
- Clean up registrations on editor teardown.
- Put WebMCP behind a feature flag until contract and browser tests pass.

### WMCP-06: Establish security and privacy boundaries

- Keep the WebMCP surface same-origin only. Do not opt cross-origin frames into `tools`.
- Explicitly set `Permissions-Policy: tools=(self)` so the intended deployment policy is auditable, even though the current default allowlist is `self`.
- Verify that production runs in a secure, origin-keyed agent cluster supported by the API.
- Treat canvas titles, notes, URLs, image metadata, cell values, imported text, and tool results derived from them as untrusted content.
- Mark read-only tools with `readOnlyHint: true` and content-bearing results with `untrustedContentHint: true` where appropriate.
- Minimize returned content. Prefer IDs, names, counts, and short summaries over complete project documents.
- Never include image bytes, local storage snapshots, full backups, secrets, stack traces, or unrelated projects in results.
- Do not log full tool inputs/results in production.
- Preserve the current safe-link and URL validation rules inside commands rather than bypassing them.

### WMCP-07: Define the human-in-the-loop policy

Initial tools should be read-only or reversible mutations. Do not initially expose:

- Project or layer deletion.
- Checkpoint restore.
- Backup import or project replacement.
- File download/export actions.
- Bulk destructive formatting or clearing.
- Mutations of hidden or locked layers.

Before any destructive tool is introduced, define a visible confirmation experience that states the target, consequence, and recovery path. Agent text alone is not sufficient confirmation for irreversible actions.

### WMCP-08: Verify deployment behavior

Before enabling the feature flag in production, test the actual deployed response rather than only configuration source:

- HTTPS/secure context.
- `Permissions-Policy: tools=(self)` on the document response.
- Origin-keyed agent-cluster compatibility.
- Existing Content Security Policy and cross-origin headers remain valid.
- No tool registration inside unexpected embeds or cross-origin frames.
- Unsupported browsers render and operate exactly as before.

### WMCP-09: Add contract, integration, and adversarial tests

Each approved tool needs:

- Schema acceptance and rejection tests.
- Runtime validation tests for unknown, stale, locked, hidden, and oversized targets.
- Deterministic command-result tests.
- One-command/one-undo tests.
- Persistence and reload tests.
- Cancellation tests that prove no partial changes remain.
- Duplicate-registration and teardown tests.
- Unsupported-browser tests.
- Prompt-injection/adversarial content tests using text stored in nodes and table cells.
- Data-leak tests proving one project cannot return another project's content.
- Output-budget tests.
- Manual browser validation through an agent-capable browser when available.

## Recommended initial tool catalog

Keep the first release intentionally small. Six tools are enough to demonstrate a coherent workflow.

| Tool | Risk | Purpose | Important limits and hints |
| --- | --- | --- | --- |
| `get_workspace_summary` | Read-only | Return the active project ID/name, layer counts by type, table count, and current selection IDs. | No cell bodies or full notes by default. `readOnlyHint: true`; use `untrustedContentHint` when names are returned. |
| `find_layers` | Read-only | Find layers in the active project by short query and optional layer kind. | Cap matches; return stable IDs, kind, and short labels only. `readOnlyHint: true`, `untrustedContentHint: true`. |
| `create_concept` | Reversible mutation | Add one concept/note with validated text and optional position. | Enforce text and canvas bounds; return created ID; one undo step. |
| `create_table` | Reversible mutation | Add a table with bounded rows/columns and optional initial cell values. | Reuse current table limits; reject oversized matrices; one undo step. |
| `organize_layers_into_table` | Reversible mutation | Create/populate rows from explicit layer IDs. | Source layers remain unchanged in v1; explicit IDs; one undo step. |
| `create_canvas_nodes_from_rows` | Reversible mutation | Create concept nodes from explicit table rows. | Source table remains unchanged; cap row count; one undo step. |

Consider `connect_layers` only after parent-aware handle selection and graph-validation logic are part of the command facade. Its contract must choose the correct source/target handles using the same rules as the UI.

## Common result envelope

All tools should return a concise, predictable envelope:

```ts
type ToolResult = {
  ok: boolean;
  summary: string;
  affectedIds?: string[];
  undoAvailable?: boolean;
  warnings?: string[];
};
```

Guidelines:

- Keep ordinary serialized output near or below 1,500 characters.
- Use stable IDs for follow-up actions.
- Do not return the entire node, table, project, or backup unless a future approved use case requires it.
- A failure must have `ok: false`, no affected IDs, and a short corrective message.

## Acceptance criteria for “ready to implement WebMCP”

SynapTable is ready to begin WebMCP integration only when all of the following are true:

- [x] The six proposed actions have command/query APIs callable without DOM events.
- [x] The existing UI calls the command facade for the four migrated mutating actions; direct connections and parent-aware relative concepts use it as well.
- [x] Each command has typed inputs, runtime validation, deterministic results, and explicit limits.
- [x] Each successful migrated mutation creates exactly one undo entry and survives reload through the existing persistence controller.
- [x] Failed, stale, and cancelled commands leave state unchanged.
- [x] Every proposed tool has an approved risk class, hints, input/output schema, and data-return budget.
- [x] Initial destructive operations are explicitly excluded.
- [x] Same-origin exposure, feature detection, cleanup, cancellation, and duplicate registration behavior are specified and tested.
- [x] The deployed origin and Permissions Policy have a repeatable verification procedure; execution on the actual preview origin remains pending approval.
- [x] Project isolation and untrusted-content adversarial tests pass at the command-safety boundary.
- [x] Existing non-WebMCP editor tests continue to pass.

**Progress evidence, 2026-09-02:** implementation commit `e6c969dda1a29057e774c384e3f3c8e81585d732` adds stable typed failures, six CSP-safe schema-validated tools, server-side default-off feature gating, registration cleanup, persisted atomic mutation handling, and shared same-origin response policy. The supported Node 24.19 local gate passes 167 unit tests in 22 files. Chromium passes 79/79 browser cases; Firefox and WebKit each pass 76 with 3 intentional skips. Typecheck, lint, Vinext compatibility, dependency audit, and production build pass. See [`WEBMCP_RELEASE_VALIDATION_RECORD.md`](./WEBMCP_RELEASE_VALIDATION_RECORD.md) for exact evidence and remaining gates.

### Implemented command-safety contract

- Every guarded request names the active project and expected document revision.
- Wrong-project, stale, already-aborted, and post-execution-aborted requests return the original state.
- Pure commands run before commit, so cancellation and validation failures cannot leave partial canvas state.
- The queue waits for the atomic persistence/publish callback before the next request can inspect state.
- Unexpected command, read, and persistence exceptions return generic messages without leaking document or storage details.
- Read queries use the same project, revision, and cancellation guards.
- Public mutation summaries are separately bounded to 1,500 serialized bytes; omitted IDs are disclosed without returning the complete document.

## Recommended implementation sequence

Use focused conventional branch names and keep WebMCP registration out of the preparatory refactors:

1. `refactor/editor-command-facade`
   - Define command context/results and extract the six candidate actions.
   - Migrate the UI to use those commands.
2. `feat/editor-command-safety` — completed
   - Added atomicity, cancellation, stale-state, active-project isolation, serialized commit, safe-error, and output-budget coverage.
3. `docs/webmcp-tool-strategy`
   - Finalize tool schemas, limits, hints, approval rules, result envelopes, and threat model.
4. `feat/webmcp-foundation`
   - Only after the readiness checklist passes: add feature detection, registration lifecycle, feature flag, types, and explicit deployment policy.
5. `feat/webmcp-canvas-tools`
   - Register the approved read-only and reversible tools and run browser/evaluation testing.

## Relationship to the current remediation plan

The existing audit remediation work remains valuable, but not every remaining refactor blocks WebMCP:

- **Direct prerequisite:** extracting table/canvas commands and connection rules from `Editor.tsx`.
- **Strongly recommended:** reducing editor orchestration complexity and strengthening test helpers.
- **Can proceed independently:** panel decomposition and stylesheet organization.
- **Not a prerequisite for the first tool release:** export-controller extraction, because export/download tools are explicitly excluded from the initial catalog.

## Exit recommendation

Keep WebMCP disabled by default outside controlled testing. The next authorized step is real agent-capable Chromium validation, followed by an owner-approved Cloudflare Preview. Do not enable production or submit to Devpost until the remaining record gates and explicit confirmations are complete.

## Primary references

- [WebMCP Draft Community Group Report](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [WebMCP tool design best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [Secure WebMCP tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Security considerations for agents](https://developer.chrome.com/docs/agents/security)
