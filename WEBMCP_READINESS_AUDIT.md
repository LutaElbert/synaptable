# SynapTable WebMCP Readiness Audit

**Audit date:** 2026-09-02  
**Status:** Pre-implementation audit  
**Overall verdict:** **AMBER — product baseline is healthy, but WebMCP tool registration should wait until the command and safety contracts below are complete.**

## Purpose and scope

This audit answers one question: **what must SynapTable have in place before WebMCP is added?**

It covers the current local-first canvas architecture, proposed agent-facing actions, security and privacy boundaries, browser/deployment requirements, and the tests needed before tools are exposed. It does not implement WebMCP or change current product behavior.

WebMCP is currently an experimental Draft Community Group Report. SynapTable must therefore treat it as progressive enhancement: the editor must remain fully functional when the API is unavailable.

## Executive findings

SynapTable already has a good foundation:

- Versioned project persistence with runtime validation and migration.
- Stable UUID-based project, node, and edge identities.
- Undo/redo and autosave behavior.
- Project isolation and local-first storage.
- A broad automated test suite around existing canvas behavior.
- A visible, user-controlled browser workspace, which is a good match for WebMCP's interaction model.

The main readiness gap is architectural. Most editor mutations still live as React callbacks in the large `Editor.tsx` component. Registering those callbacks directly as WebMCP tools would couple agent behavior to rendered UI state, make deterministic testing difficult, and risk inconsistent undo, persistence, selection, and error handling.

**Recommendation:** build a typed editor-command facade first. Both the UI and future WebMCP adapters should call the same commands.

```text
Toolbar / keyboard / canvas UI ─┐
                               ├─> Editor command facade ─> validated state mutation
Future WebMCP tool adapter ─────┘                         ├─> one undo entry
                                                         └─> autosave result
```

## Readiness scorecard

| Area | Status | Finding |
| --- | --- | --- |
| Product/data baseline | Green | Versioned schema, UUIDs, validation, persistence, and undo already exist. |
| Command architecture | Red | Mutations are concentrated in UI callbacks rather than reusable domain commands. |
| Initial tool strategy | Red | No approved tool catalog, risk classification, or input/output contracts exist. |
| Runtime validation | Amber | Project data is validated, but agent-tool arguments and results are not yet defined. |
| Human control | Amber | UI confirmations exist for some destructive actions; there is no agent-specific approval policy. |
| Security and privacy | Amber | Local-first design is strong; tool exposure, content trust, and data minimization rules are missing. |
| Registration lifecycle | Red | No feature detection, registration/unregistration, cancellation, or stale-state policy exists. |
| Deployment policy | Amber | Security headers exist, but the WebMCP `tools` policy and origin-keyed behavior need explicit verification. |
| Tests and evaluations | Red | Existing UI tests do not cover tool contracts, adversarial inputs, cancellation, or deterministic results. |
| Progressive enhancement | Green by design | Existing UI does not depend on WebMCP and must remain that way. |

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
- [ ] Every proposed tool has an approved risk class, hints, input/output schema, and data-return budget.
- [x] Initial destructive operations are explicitly excluded.
- [ ] Same-origin exposure, feature detection, cleanup, cancellation, and duplicate registration behavior are specified and tested.
- [ ] The deployed origin and Permissions Policy have a repeatable verification procedure.
- [x] Project isolation and untrusted-content adversarial tests pass at the command-safety boundary.
- [x] Existing non-WebMCP editor tests continue to pass.

**Progress evidence, 2026-09-02:** `editor-commands.ts` provides bounded workspace summary and layer search queries plus concept creation, table creation, layer-to-table conversion, row-to-canvas conversion, connection, and parent-aware relative-concept commands. `editor-command-safety.ts` adds active-project and revision guards, pre/post `AbortSignal` cancellation, serialized commits, safe exception containment, and a 1,500-byte public-result budget. The facade has 12 focused command tests and 11 focused safety tests; the full local gate passes 129 unit tests. Chromium and Firefox pass their browser projects, and the serial WebKit release-evidence run passes 72 cases with 3 intentional skips. Typecheck, lint, compatibility check, dependency audit, and production build also pass.

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

Do not add `document.modelContext.registerTool()` calls yet. First complete WMCP-01 through WMCP-09 at the design/command-contract level. Once the acceptance checklist passes, start `feat/webmcp-foundation` with read-only tools behind a flag, then add reversible canvas mutations one at a time.

## Primary references

- [WebMCP Draft Community Group Report](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [WebMCP tool design best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [Secure WebMCP tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Security considerations for agents](https://developer.chrome.com/docs/agents/security)
