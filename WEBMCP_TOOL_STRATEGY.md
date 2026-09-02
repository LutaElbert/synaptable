# SynapTable WebMCP Tool Strategy

**Strategy date:** 2026-09-02
**Catalog version:** 1.0.0
**Status:** Approved implementation baseline; WebMCP registration remains disabled
**Machine-readable contract:** [`WEBMCP_TOOL_SCHEMAS.json`](./WEBMCP_TOOL_SCHEMAS.json)

## Decision

SynapTable will begin with six narrow tools that cover one coherent canvas workflow:

```text
Inspect the active workspace
        ↓
Find explicit layers
        ↓
Create a concept or table
        ↓
Organize layers into table rows
        ↓
Create canvas concepts from explicit rows
```

The tools use the imperative WebMCP API because SynapTable actions operate on React canvas state rather than native form submission. WebMCP remains progressive enhancement: without `document.modelContext`, SynapTable must render and behave exactly as it does today.

The current WebMCP draft defines `document.modelContext.registerTool`, an input JSON Schema, annotations, an execution callback with an `AbortSignal`, and registration cleanup through an `AbortSignal`. It is experimental, browser-tab based, and gated by origin isolation and the `tools` Permissions Policy. This strategy follows the [WebMCP draft](https://webmachinelearning.github.io/webmcp/), [Chrome imperative API guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices), and [tool security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools), all checked on 2026-09-02.

## Non-negotiable boundaries

- Register tools only when a disabled-by-default feature flag is enabled and the API is present.
- Use the active visible project only. No tool accepts an arbitrary project as a data source.
- Keep registrations same-origin. Do not set `exposedTo` and do not opt cross-origin frames into `tools`.
- Require the active `projectId` and latest `expectedRevision` after the bootstrap call.
- Serialize mutations through the existing command queue and return only after commit/persistence succeeds.
- Pass the WebMCP execution `AbortSignal` into every guarded read or mutation.
- One successful mutation equals one undo entry. Failure or cancellation equals no state change and no undo entry.
- Treat every result as untrusted because project names, layer labels, summaries, and errors may contain user-authored text.
- Keep each serialized result at or below 1,500 UTF-8 bytes.
- Do not log full inputs, canvas content, or results in production.
- Do not register delete, restore, import, export, download, or project-replacement tools in the initial release.

## Context and revision protocol

`get_workspace_summary` is the only bootstrap tool. It accepts `{}` and binds to the active tab and active project at execution time. It returns the active `projectId` and `revision` without accepting a caller-selected project.

Every other tool requires that returned `projectId` and `expectedRevision`:

```text
get_workspace_summary() → projectId=P1, revision=12
find_layers(P1, 12, ...) → projectId=P1, revision=12
create_table(P1, 12, ...) → projectId=P1, revision=13
next mutation must use P1, 13
```

If the project or revision changed, the operation fails without reading or changing document state. The caller must invoke `get_workspace_summary` again. A successful mutation returns the incremented revision; a successful read preserves it.

This protocol prevents a tool call prepared for one project or canvas revision from being replayed against another.

## Approved catalog

| Tool | Risk | Confirmation | Source API | Primary result |
| --- | --- | --- | --- | --- |
| `get_workspace_summary` | Read-only | No app confirmation | `getWorkspaceSummary` | Active identity, revision, counts, visible selection IDs |
| `find_layers` | Read-only | No app confirmation | `findLayers` | Bounded visible matches with stable IDs |
| `create_concept` | Reversible mutation | Visible result and undo | `createConceptCommand` | Created concept ID |
| `create_table` | Reversible mutation | Visible result and undo | `createTableCommand` | Created table ID |
| `organize_layers_into_table` | Reversible mutation | Visible result and undo | `organizeLayersIntoTableCommand` | Created table ID; source layers unchanged |
| `create_canvas_nodes_from_rows` | Reversible mutation | Visible result and undo | `createCanvasNodesFromRowsCommand` | Created concept IDs; source table unchanged |

All six use `untrustedContentHint: true`. The two reads use `readOnlyHint: true`; the four mutations use `readOnlyHint: false`.

For reversible mutations, SynapTable does not add a second blocking dialog in v1. The resulting layer selection, success/error notice, and one-step undo keep the user in control. An agent or browser may still apply its own confirmation policy. Any future destructive tool requires a separate, browser-owned confirmation design and a new security review.

## Schema rules

The machine-readable catalog is normative for names, descriptions, annotations, input schemas, output schemas, and defaults. Every input object rejects unknown properties with `additionalProperties: false`.

WebMCP currently registers an `inputSchema`, not an `outputSchema`. The catalog's output schemas are SynapTable's application contract for validation and tests. Catalog-level `$defs` are the resolution scope for output-schema references. Input schemas passed to `registerTool` must be complete standalone objects.

### Shared mutation context

All tools except the bootstrap summary require:

| Field | Contract |
| --- | --- |
| `projectId` | Non-empty string, maximum 160 characters; must exactly equal the active project ID |
| `expectedRevision` | Safe integer at least 0; must exactly equal the current document revision |

### Position

`create_concept` and `create_table` accept an optional `position` containing finite `x` and `y` canvas coordinates between -1,000,000 and 1,000,000. Coordinates describe the visual center of the new layer, not its top-left corner. If omitted, the adapter resolves the current visible canvas center immediately before command execution.

### Tool-specific input limits

| Tool | Additional limits and defaults |
| --- | --- |
| `get_workspace_summary` | Exactly `{}`; returns no note body or cell value |
| `find_layers` | Query ≤200 characters; kinds are `concept`, `raster`, `vector`, or `table`; limit 1–20, default 10; hidden layers excluded |
| `create_concept` | Title/eyebrow ≤500 characters; body ≤20,000; defaults to `New concept`, empty body, and `Concept` |
| `create_table` | 1–100 rows, 1–30 columns, ≤2,000 cells; each initial cell ≤2,000 characters; default 3×3 with header; name ≤500 |
| `organize_layers_into_table` | 1–99 unique explicit layer IDs; every source exists, is visible, and is unlocked; originals remain unchanged |
| `create_canvas_nodes_from_rows` | 1–25 unique data-row IDs and 1–30 unique column IDs; source table exists, is visible, and is unlocked; header rows rejected |

The WebMCP adapter adds two input budgets beyond the current UI command limits:

- Any serialized input must be at most 256 KiB.
- `create_table.values` may contain at most 100,000 aggregate characters, even when its dimensions and individual cells are otherwise valid.

These agent limits do not reduce what a user can edit through the existing UI.

## Runtime validation

JSON Schema is only the first boundary. The adapter and command facade must also enforce:

1. Feature flag, secure API availability, active tab, active project, and registration ownership.
2. Serialized input byte budget before command construction.
3. Exact project and revision match before any read or mutation.
4. Finite position values and visible-center resolution when position is absent.
5. Unique IDs, entity existence, correct entity type, active-project membership, visibility, and lock state.
6. Table dimension product, matrix dimensions, aggregate initial text, row/header rules, and generated-node cap.
7. One pure command execution followed by one serialized atomic commit.
8. Cancellation before command execution, after pure execution, and before commit publication.
9. Output normalization, user-content truncation, and the 1,500-byte serialized result budget.

Schema defaults are descriptive; the adapter must apply them explicitly before constructing a command. The browser or an agent is not trusted to populate defaults.

## Result contract

Successful reads return:

```ts
type ReadSuccess<T> = {
  ok: true;
  projectId: string;
  revision: number;
  summary: string;
  data: T;
};
```

Successful mutations return:

```ts
type MutationSuccess = {
  ok: true;
  projectId: string;
  revision: number;
  summary: string;
  affectedIds: string[];
  affectedCount: number;
  undoAvailable: true;
  warnings?: string[];
};
```

`affectedCount` records the complete count even if IDs must be omitted to meet the output budget. `affectedIds` contains at most 25 stable IDs. `find_layers` truncates each returned layer name to 80 characters and sets `truncated: true` whenever the request limit or output budget omits matches. `get_workspace_summary.selectedIds` likewise returns at most 25 IDs.

Failures return no canvas data and no affected IDs:

```ts
type ToolFailure = {
  ok: false;
  projectId: string;
  revision: number;
  code: ToolErrorCode;
  summary: string;
  retryable: boolean;
  refreshRequired: boolean;
};
```

### Stable error policy

| Code | Meaning | Retryable | Refresh required |
| --- | --- | --- | --- |
| `CANCELLED` | Caller aborted the operation | Yes, only if still desired | No |
| `PROJECT_CHANGED` | Requested project is no longer active | Yes | Yes |
| `STALE_REVISION` | Canvas changed after the context was read | Yes | Yes |
| `INVALID_INPUT` | Schema-valid input violates a business rule | No, until corrected | No |
| `NOT_FOUND` | A referenced layer, table, row, or column is absent | Yes, after refresh | Yes |
| `PROTECTED_CONTENT` | A referenced layer is hidden or locked | No, until user changes it | No |
| `LIMIT_EXCEEDED` | Input, table, text, node, or result limit was exceeded | No, until reduced | No |
| `CONFLICT` | IDs are duplicated or the requested graph/state operation conflicts | No, until corrected | No |
| `PERSISTENCE_FAILED` | Atomic commit could not be saved | Yes | Yes |
| `INTERNAL_ERROR` | Safe generic failure with no internals exposed | Yes once | Yes |

The current command-safety layer returns safe summaries but not stable codes. The foundation phase must introduce typed command failures or a deterministic adapter mapping. It must not infer codes from localized or user-visible message text.

## Tool behavior and acceptance criteria

### `get_workspace_summary`

- Binds to the current active project; the caller cannot select another project.
- Returns project ID/name, current revision, layer/connector counts, counts by layer type, hidden/locked counts, and up to 25 visible selected IDs.
- Returns no concept body, table cell, image bytes, URL, backup, or unrelated project metadata.
- Repeated calls at unchanged state are deterministic apart from safe result truncation.

### `find_layers`

- Searches only the active project and rejects stale context.
- Uses the current case-insensitive search behavior but returns visible layers only.
- Returns ID, kind, and a label truncated to 80 characters; never returns searchable bodies or cells.
- Marks the result truncated when matches are omitted because of the requested limit or output budget.

### `create_concept`

- Creates exactly one concept at the supplied canvas-center position or current visible center.
- Applies explicit defaults and current text limits.
- Selects the created concept and deselects previous nodes/edges consistently with UI creation.
- Reports success only after persistence and creates exactly one undo entry.

### `create_table`

- Creates exactly one table and applies explicit defaults.
- Rejects dimensions above 100 rows, 30 columns, or 2,000 cells, mismatched matrices, oversized cells, excessive aggregate text, and oversized serialized input.
- Treats all values as plain text; it does not interpret formulas, URLs, Markdown, HTML, or instructions.
- Reports success only after persistence and creates exactly one undo entry.

### `organize_layers_into_table`

- Requires explicit unique IDs for 1–99 visible, unlocked layers in the active project.
- Uses canvas reading order and creates one table near the sources.
- Leaves every source node and connector unchanged.
- Fails atomically if any source becomes missing, hidden, locked, or stale.

### `create_canvas_nodes_from_rows`

- Requires explicit table, row, and column IDs; no implicit “all rows” behavior is exposed to agents.
- Accepts at most 25 data rows per call and rejects a header-row ID.
- Creates one concept per accepted data row using only selected columns.
- Leaves the source table unchanged and fails atomically on any missing/protected/stale target.

## Threat model and mitigations

| Threat | Required mitigation |
| --- | --- |
| Prompt injection in project names, notes, cells, URLs, or imported data | `untrustedContentHint: true` on every tool; plain-data outputs; no tool instructions derived from canvas content |
| Cross-project disclosure or mutation | Bootstrap from active project; exact project/revision guard; project-scoped reads; adversarial two-project tests |
| Stale replay or duplicate mutation | Expected revision on every non-bootstrap call; serialized queue; revision increments only on successful commit |
| Oversized input/output or denial of service | Schema bounds, 256 KiB input cap, table aggregate text cap, 25-row conversion cap, 1,500-byte output cap |
| Partial mutation on cancel or storage failure | Pure command before commit; propagate execution signal; atomic commit; no undo entry on failure |
| Hidden or locked content manipulation | Command and adapter checks; no automatic unlocking or revealing |
| React remount or strict-mode duplicate registration | One registration owner, abort previous registration set, cleanup signal on teardown, duplicate-registration tests |
| Cross-origin observation or execution | No `exposedTo`; `Permissions-Policy: tools=(self)`; no iframe `allow="tools"`; deployed-header verification |
| Sensitive production logging | Metadata-only event fields; no full input/result/canvas/local-storage logging |
| Unsupported or disabled browser behavior regression | Feature detection and disabled-by-default flag; no WebMCP-dependent UI or state initialization |

## Registration lifecycle contract

The foundation implementation must keep the catalog static and validate state at execution time:

1. Exit without side effects when the feature flag is off or `document.modelContext` is absent.
2. Create one registration `AbortController` owned by the mounted editor instance.
3. Register the six approved definitions with the controller's signal and no `exposedTo` option.
4. In every execute callback, validate/normalize input and pass the callback's `AbortSignal` into the guarded read or queue request.
5. On remount, abort the prior registration set before registering a new set.
6. On teardown, abort once and remove all tools.
7. Do not dynamically rename tools or include project content in descriptions.

Registration lifecycle behavior is specified here but remains unimplemented and unchecked in the readiness audit until code and tests exist.

## Test plan

### Catalog and schema tests

- Parse the catalog and prove exactly six unique names, each no longer than 30 characters.
- Prove descriptions are ≤500 characters and parameter descriptions are ≤150.
- Prove all input schemas reject additional properties, incorrect types, missing required context, overlong strings, duplicate IDs, and out-of-range counts.
- Prove defaults are applied by the adapter, not assumed from schema metadata.
- Validate representative success/error results against each output schema.
- Prove every serialized public result is ≤1,500 UTF-8 bytes.

### Tool-to-command integration tests

- Verify each tool invokes only its approved command/query mapping.
- Verify bootstrap context, wrong-project rejection, stale-revision rejection, and post-success revision propagation.
- Verify one successful mutation produces one commit and one undo entry; failure, cancellation, and persistence failure produce none.
- Verify hidden, locked, unknown, wrong-type, duplicate, oversized, and header-row targets return stable codes without partial changes.
- Reload persisted state after each mutation and compare the expected project state.

### Lifecycle and browser tests

- Feature absent: no error, no registration, and unchanged editor behavior.
- Flag off: no registration even in a capable browser.
- Flag on: exactly six tools registered once.
- React strict-mode/remount: no duplicate tools.
- Teardown: registration signal aborts and tools disappear.
- Execution cancellation: no partial state before or after pure command execution.
- Same-origin: tools discoverable in the top-level document; unavailable to unapproved cross-origin frames.
- Actual preview response includes `Permissions-Policy: tools=(self)` and remains origin-isolated.

### Adversarial tests

- Store instruction-like text in project names, concept bodies, table cells, and imported content; prove it is returned only as bounded untrusted data and never changes tool behavior.
- Prepare valid IDs from Project A, switch to Project B, and prove every read/mutation rejects them without disclosing A.
- Retry the same successful mutation with its old revision and prove it cannot duplicate the result.
- Fuzz nested arrays, large Unicode content, unexpected keys, prototype-like property names, non-finite positions, and boundary counts.
- Force storage failure and verify the result contains no stack, storage key, local path, or canvas snapshot.

## Deferred tools

`connect_layers` is implemented in the command facade, including current graph rules and parent-aware handles, but is deferred from the initial catalog. Before exposure it needs a separate contract for handle selection, direction, duplicate/cycle policy, and agent confirmation behavior.

Also deferred:

- Delete or clear operations.
- Checkpoint restore and backup import.
- Project creation, rename, replacement, or switching.
- PNG, SVG, PDF, CSV, and project export/download.
- Rich-text formatting, arbitrary table-cell mutation, formulas, filters, and sorting.
- Hidden/locked layer mutation.

## Implementation gate

The tool strategy and schemas are ready for the foundation phase when:

- [x] Six non-overlapping tools have exact names, descriptions, risk classes, hints, and source-command mappings.
- [x] Every input rejects unknown properties and defines exact types, bounds, defaults, and required context.
- [x] Read and mutation result schemas, a 1,500-byte budget, and stable error taxonomy are defined.
- [x] Project/revision bootstrap, stale recovery, undo, autosave, cancellation, and atomic-failure behavior are defined.
- [x] Confirmation, untrusted-content, same-origin, logging, and destructive-operation policies are defined.
- [x] Schema, integration, lifecycle, browser, and adversarial acceptance tests are defined.
- [ ] The foundation adapter implements typed error codes without parsing user-facing summaries.
- [ ] Feature detection, flagging, registration cleanup, and duplicate prevention pass automated tests.
- [ ] `Permissions-Policy: tools=(self)` is implemented and verified on the real preview response.
- [ ] Manual validation passes in an agent-capable Chromium build before the flag is enabled in preview.

Production enablement remains a separate decision after the release-validation and Cloudflare-preview gates in `RELEASE_VALIDATION_RECORD.md` are complete.
