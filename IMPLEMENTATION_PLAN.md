# SynapTable implementation plan

> **Archived implementation record.** Current work is governed by `CURRENT_FEATURE_AUDIT.md` and `AUDIT_REMEDIATION_IMPLEMENTATION_PLAN.md`. Image vectorization is disabled through the centralized editor feature switch; this historical plan is retained only for possible future evaluation.

## Outcome

Build a local-first diagram workspace where a user can drag, paste, or browse for a PNG, JPEG, or WebP; keep it as a reference; trace it into editable vector paths without AI; edit layers; and export an SVG.

## Completed phases

1. **Workspace foundation** — responsive three-pane editor, React Flow canvas, concept nodes, connectors, minimap, keyboard-accessible controls, and precision-workspace visual system.
2. **Image ingestion** — drag/drop, paste, and file browsing with type and 15 MB size validation; insertion occurs at the drop point.
3. **Local conversion** — ImageTracer runs inside a Web Worker; images are decoded and sampled on-device; generated SVG is sanitized before paths enter editor state.
4. **Editable layers** — raster, concept, vector, and per-path layers support selection, visibility, locking, reordering, naming, color, and opacity controls.
5. **Document workflow** — IndexedDB autosave, reload persistence, undo/redo, duplication, deletion, new-document reset, and SVG export.
6. **Progressive enhancement** — the AI reconstruction action has an explicit provider boundary and never implies that local tracing is AI reconstruction.
7. **Quality and release** — desktop/mobile browser QA, live PNG-to-vector verification, SVG export verification, unit tests, typecheck, lint, production build, dependency audit, Lighthouse, and deployment.

## Guidance applied

- Chrome DevTools for Agents drove a real-browser loop across snapshots, screenshots, file ingestion, interaction, console/network checks, responsive emulation, Lighthouse, and a performance trace.
- Modern Web Guidance informed semantic controls, visible focus, keyboard-operable canvas objects, CSS Grid/container-query layout, resilient native dialog behavior, local Web Worker processing, and touch-target sizing.

## Extension boundary

Diagram reconstruction from a screenshot is intentionally modeled as a separate provider interface. A future provider can return structured concept nodes and connectors without changing the local raster/vector editing pipeline.
