# Title

SynapTable

## One-line Summary

A local-first visual thinking canvas where people and agents turn connected ideas into structured tables—and turn table rows back into actionable canvas concepts.

## Inspiration

SynapTable began with a problem my girlfriend encountered as a medical student. She regularly creates concept maps to understand how ideas relate and tables to compare dense information, but her workflow required constantly moving between ChatGPT and Google Docs—copying responses, rebuilding tables, and manually turning explanations into visual structures.

One day, she complained that the generated table and concept-map experience did not match what she actually needed. The AI could suggest an organization, but it could not work directly inside the editable workspace where she was studying. That conversation gave me the idea for SynapTable: a visual canvas where people can think freely, organize concepts into tables, and move between both formats without leaving the workspace.

WebMCP made the next step possible. Instead of building another isolated chatbot, I could introduce an AI copilot that operates through bounded, transparent tools inside the same canvas. The person remains in control while the agent helps transform ideas into useful, editable structure.

## Problem

Students working with dense subjects often need two representations at once: concept maps for understanding relationships and tables for comparing facts. Existing AI workflows usually return text in a separate chat, leaving the student to copy it into a document, rebuild the structure, and keep both versions synchronized manually.

The problem is not simply generating a better table. It is the separation between the AI conversation and the editable visual workspace where the person is actually thinking and studying.

## Solution

SynapTable combines connected concept nodes, images, rich notes, and semantic tables on one local-first canvas. Its WebMCP integration gives an agent six bounded tools for understanding the active workspace and completing the core canvas-to-table workflow:

1. Summarize the active workspace.
2. Find visible layers by name and kind.
3. Create concept nodes.
4. Create structured tables.
5. Organize selected canvas layers into table rows.
6. Turn selected table rows back into canvas concepts.

The agent works against the same project, revision, undo history, and browser persistence as the human-facing editor. Agent changes appear directly on the canvas and remain editable, reversible, and visible to the user.

## Why This Matters

WebMCP is a strong fit because SynapTable is not a chat box wrapped around an API. The useful context already lives in a rich browser interface: spatial layout, connected concepts, and structured tables. WebMCP lets an agent collaborate through precise product actions instead of guessing at the DOM or returning instructions for the user to perform manually.

Before this integration, a student could ask an agent to organize a topic but still had to create nodes, copy text, build a table, and reconnect the result. With SynapTable, the user can brainstorm freely, ask an agent to structure the visible ideas, inspect the result, undo it if needed, and continue editing using the normal canvas controls.

The local-first model also keeps the interaction understandable: project content remains in browser storage, tool results are content-minimized, and mutations are limited to the active project.

## How We Used AI

The submitted feature uses WebMCP as the bridge between an agent and SynapTable's existing human interface. The initial catalog deliberately contains only two read tools and four reversible mutation tools. Each tool has a closed JSON Schema, runtime business validation, typed errors, a 1,500-byte result budget, cancellation handling, stale-revision protection, active-project isolation, and untrusted-content annotations.

The agent can reason over a bounded workspace summary and layer metadata, then call explicit product actions. It cannot request arbitrary document replacement, hidden content, downloads, formulas, deletion, or unrestricted cell editing. Table discovery exposes dimensions and header status without exposing cell contents. Row conversion uses bounded zero-based indexes that the agent can derive from the public table dimensions; internal row and column IDs remain private.

Every successful mutation creates one undo step and persists before returning success. Failed, stale, invalid, or cancelled operations leave no partial changes.

## How We Used Codex

Codex helped turn an existing canvas product into a tested WebMCP experience. It was used to:

- audit the existing canvas, table, persistence, export, accessibility, and security behavior;
- design the six-tool catalog and machine-readable schemas;
- extract and harden a typed editor-command facade shared by UI and agent actions;
- implement registration, feature detection, teardown, remount protection, cancellation, result normalization, and security headers;
- diagnose the native execution mismatch where the browser supplied only one execute argument;
- replace opaque table row and column IDs with a public index-based contract;
- build unit, integration, Playwright, isolation, malicious-content, output-budget, cancellation, and one-step-undo tests;
- run the real six-tool flow in the in-app agent browser and verify persistence after reload; and
- create the local narrated and captioned demo asset.

Codex did not replace human review. Destructive WebMCP actions were deferred, publishing and production deployment remain owner-controlled, and the final submission claims are tied to recorded test evidence.

## Key Features

- Local-first multi-project visual canvas using IndexedDB.
- Connected concepts, rich text, images, labeled connectors, layers, search, tidy layout, and project checkpoints.
- Semantic table layers with cell editing, formatting, range selection, spreadsheet-style paste, row and column operations, resizing, keyboard navigation, and canvas zoom/pan compatibility.
- Canvas-to-table and table-to-canvas conversions as reversible operations.
- PNG, SVG, PDF, CSV, and portable `.synaptable` exports.
- Six progressive-enhancement WebMCP tools, disabled by default unless the server flag and `document.modelContext` are both available.
- Closed schemas, generated CSP-safe validators, typed safe errors, project/revision guards, bounded outputs, persistence-before-success, and cancellation support.
- Same-origin `Permissions-Policy: tools=(self)` configuration.
- Responsive panels and automated accessibility coverage.

## Architecture

SynapTable is a React 19 and TypeScript web app built on Vinext/Next-compatible routing, React Flow, Tiptap, IndexedDB, and Cloudflare Workers.

```text
Human canvas controls ─┐
                      ├─> typed editor command facade ─> validation ─> state mutation
WebMCP tool adapter ──┘                                      ├─> one undo entry
                                                            └─> IndexedDB persistence
```

WebMCP registration is lazy and disabled by default. A capable same-origin browser receives six static tool definitions only when the server-side feature flag is enabled and `document.modelContext` exists. Unsupported browsers load the normal editor without the registration bundle changing product behavior.

The public schema contract lives in `WEBMCP_TOOL_SCHEMAS.json`. Validators are generated ahead of time to avoid runtime code generation under the content security policy. Read results expose only bounded counts, identifiers, names, kinds, and table dimensions. Mutation tools pass through the same project, revision, history, validation, and persistence boundaries as visible editor commands.

## Testing Instructions

### Local setup

Requirements: Node.js 24.15 or newer and npm.

```sh
npm ci
SYNAPTABLE_WEBMCP_ENABLED=true npm run dev
```

Open `http://localhost:3000` in a browser that exposes `document.modelContext`. Without that experimental API, the normal editor remains fully usable but no WebMCP tools register.

### Suggested WebMCP flow

1. Ask the agent for a workspace summary.
2. Ask it to create three concepts for a small plan.
3. Ask it to find those concepts.
4. Ask it to organize them into a table.
5. Ask it to create a 3-column table with a header and three data rows.
6. Ask it to turn data-row indexes 1–3 into canvas concepts using column indexes 0–2.
7. Undo once and confirm every generated concept disappears together; redo once to restore them.
8. Reload the page and confirm the table and generated concepts remain.

### Automated verification

```sh
npx playwright install chromium firefox webkit
npm run check
npm run typecheck
npm run lint
npm test -- --run
npm run generate:webmcp-validators
SYNAPTABLE_WEBMCP_ENABLED=true npm run build
npm run test:e2e
npm audit --audit-level=high
```

Latest audited results on 2026-09-02:

- 173 unit/integration tests passed across 22 files.
- 234 applicable production-browser tests passed across Chromium, Firefox, and WebKit.
- Six intentional browser-scoped stress/zoom cases were skipped in Firefox/WebKit; their Chromium equivalents passed.
- The native in-app browser completed all six WebMCP tools and preserved the final eight-node workspace after reload.
- The high-severity dependency audit reported zero vulnerabilities.

## Public Demo Link

https://synaptable-preview.elbertluta.workers.dev

The deployed HTTPS origin returned HTTP 200 with `Permissions-Policy: tools=(self)`, restrictive CSP, same-origin opener/resource policy, HSTS, frame denial, and privacy-oriented browser permissions. The native Codex in-app browser registered all six WebMCP tools on this origin, completed the full workflow, and preserved the resulting eight-layer workspace after reload without console errors.

## Public Repository Link

https://github.com/LutaElbert/synaptable

The repository is public and GitHub detects its MIT license. The working tree and Git history were scanned for high-confidence credentials, private-key material, and credential files before publication; no blocking findings were found.

## Demo Video

**Final unlisted demo:** https://youtu.be/le66BkSdxiM

The earlier private draft at https://youtu.be/yr6ZCCtQnPQ is superseded and must not be used for the submission.

Current local proof asset:

`artifacts/webmcp-demo/synaptable-product-demo-final.mp4`

The selected final demo is 38.27 seconds, 1920×1080 at 30 fps, H.264 video with stereo AAC audio. It passed a complete decode check. SHA-256: `14c11e20b768ca3b272bcd024e1caf825cb0a120b4f18504f5fcbfcb871a79aa`.

### Demo outline

1. Introduce SynapTable as a canvas where loose ideas and structured tables coexist.
2. Show the agent reading the current workspace through WebMCP.
3. Create ideas and organize them into a visible table.
4. Create a second table and turn selected rows back into canvas concepts.
5. Show the user-visible result, undo/redo behavior, and persistence after reload.
6. Close on the human-agent collaboration benefit and local-first safety boundaries.

## Screenshot Shot List

1. Full SynapTable canvas showing concepts, connectors, an image, and a semantic table.
2. Table editing state showing a selected range and the formatting toolbar.
3. Agent interaction alongside the canvas after creating and organizing concepts.
4. Before/after view of loose concepts becoming table rows.
5. Final table-to-canvas result showing generated concepts and the preserved source table.

## Submission Readiness Notes

Implementation, automated regression, dependency-security, and native WebMCP gates are green. The WebMCP contract fix is merged into `main` in pull request #12.

The repository, license, public HTTPS origin, Cloudflare header checks, public-origin native six-tool flow, reload persistence proof, official form answers, and final unlisted demo URL are complete. The project was submitted and verified live on Devpost. Named assistive-technology, physical-device, CSV, viewer, and print checks remain documented release-proof work rather than required WebMCP submission fields.

Official submission deadline: **2026-09-03 20:00 UTC / 2026-09-04 04:00 Asia/Manila**.

## What's Next

The next phase is a purpose-built study copilot—not a generic chat sidebar. Students could attach their own lecture notes, slides, PDFs, and approved references, then ask SynapTable to propose concept maps, comparison tables, study guides, and missing connections. Every generated claim should remain traceable to its source. Agent changes would follow a **propose → preview → approve** flow and continue through SynapTable's bounded WebMCP commands, so the result is visible, editable, reversible, and never silently written to the canvas.

### Near term: the Study Copilot

I plan to explore [Google Agent Development Kit (ADK)](https://adk.dev/) to orchestrate focused study workflows: a structure assistant that turns material into maps and tables, an evidence assistant that preserves citations and flags unsupported claims, and a review coach that finds knowledge gaps and suggests what to revisit. [AG-UI](https://docs.ag-ui.com/) could stream progress, tool activity, state changes, approvals, and cancellation between that agent backend and SynapTable. [A2UI](https://a2ui.org/introduction/what-is-a2ui/) could provide safe, declarative controls for tasks such as choosing comparison criteria, resolving ambiguous concepts, confirming a table schema, or configuring a quiz—without executing arbitrary agent-generated UI code.

### Next: structured study knowledge

SynapTable could add previewable actions such as “organize these concepts,” “cluster by body system,” “compare these conditions,” and “summarize this branch.” Tables could gradually gain typed study properties, tags, filters, and reusable views—for example topic, source, confidence, exam date, and review status—without turning the free-form canvas into a spreadsheet.

An optional user-controlled database could add authenticated cross-device sync, version history, source provenance, reusable course workspaces, and study-group collaboration while preserving a local-first/offline mode. Shared maps could support comments and instructor or peer review, with clear ownership and permissions for every project.

### Later: move from organizing to remembering

Students could turn selected concept nodes or table rows into editable flashcards that stay linked to the original map and source. SynapTable could then build review queues, surface weak areas visually, and let a learner jump from a missed card back to the surrounding concept map. Cloze cards and image-occlusion review would be especially useful for anatomy and other visually dense subjects.

The longer-term goal is a learning workspace where trusted source material, visual understanding, structured comparison, and active recall reinforce one another. These capabilities would support education and study; SynapTable would not present them as clinical diagnosis, patient-care guidance, or medical advice.

## Known Limitations

- WebMCP depends on an experimental browser API and is disabled by default.
- Agent tools do not delete, clear, import, restore, replace projects, download files, edit arbitrary cells, apply rich-text formatting, calculate formulas, filter, sort, or mutate hidden/locked layers.
- Content remains local to the current browser; there is no cloud synchronization or collaboration backend.
- PDF export is a single-page visual export rather than an editable document format.
- Manual VoiceOver/NVDA, exact 200% browser zoom, physical-device, spreadsheet interoperability, and A4/Letter print evidence remains to be recorded.

## TODO Official Form Fields

The answers below mirror the live Devpost form retrieved on 2026-09-02. Values marked **Suggested—confirm** must be approved before they are sent.

### Submitter Type — required

`Individual`

### Country of residence — required

`Philippines`

### Organization name — optional

Leave blank because the project is submitted by an individual.

### App Status — required

`Existing`

### Existing-app updates during the submission period

During the challenge period, I added SynapTable's WebMCP integration: a typed command facade, six registered canvas tools, closed and generated schemas, bounded content-safe results, stale-revision and project-isolation guards, cancellation and teardown support, same-origin policy headers, and persistence-before-success semantics. I also added native agent-browser validation, table-dimension discovery, public index-based table-row conversion, one-step undo coverage, and a complete cross-browser regression/security test pass.

### Live URL — required

https://synaptable-preview.elbertluta.workers.dev

### Private testing instructions — optional

No account is required. Open the URL in ChatGPT's in-app browser or Chrome with WebMCP enabled. Ask the agent to summarize the workspace, create three concepts, find them, organize them into a table, create a second table, and convert data rows back into canvas nodes. Undo once to confirm the generated nodes disappear as one operation, redo, then reload to confirm persistence.

### Public code repository — required

https://github.com/LutaElbert/synaptable

### Agent(s) or client(s) tested — required

Native `document.modelContext` execution was validated in the Codex in-app browser on the public Cloudflare URL, including all six tools and reload persistence. The progressive-enhancement and registration behavior was also exercised through Playwright in Chromium, Firefox, and WebKit; Firefox and WebKit verify the unsupported-browser path rather than claiming native WebMCP support.

### AI tools leveraged — required

OpenAI Codex was used to audit the existing product, design and implement the WebMCP command/tool architecture, generate and review tests, diagnose native browser integration, run cross-browser validation, and prepare the demo and submission evidence. The product itself uses the browser's WebMCP interface so a compatible agent can operate the approved tools; it does not send project content to a custom model backend.

### Learning level — required

`Significant`

The project moved from initial familiarity with the term WebMCP to designing and validating a real progressive-enhancement tool interface with schemas, lifecycle management, human-visible reversible mutations, privacy budgets, and native browser execution.

### Career AI value — required

`Yes`

The project produced reusable experience in agent-facing product design, typed tool contracts, least-privilege interfaces, prompt-injection boundaries, deterministic undo/persistence behavior, and native browser validation.
