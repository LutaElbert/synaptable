# SynapTable production-readiness plan

> **Historical readiness record.** Current work and release gaps are tracked in `CURRENT_FEATURE_AUDIT.md` and `AUDIT_REMEDIATION_IMPLEMENTATION_PLAN.md`. Image vectorization is disabled through the centralized editor feature switch and is not part of the current release acceptance path. Test counts and verification notes below describe the earlier 2026-08-30 baseline.

## Outcome

Ship SynapTable as a reliable public Cloudflare Workers application while preserving its current core promise: image import, editable concept and reference layers, local document persistence, and SVG export without sending user images to a server.

The original MVP implementation phases are complete. This plan reopens release work because the former GPT Sites deployment was deleted and Cloudflare is now the production target.

## Local implementation status — 2026-08-29

Phases 1–5 are implemented and verified locally. Deployment phases 6–7 have deliberately not been executed so the release candidate can be reviewed first.

- Vinext reports 100% compatibility with zero partial or hard issues.
- The production Cloudflare Worker build succeeds and runs locally through Wrangler with enforced security headers.
- Forty-six unit tests pass for rich-text validation/utilities, schema migration, SVG export, project validation and repair, connection rules, mixed image/concept layout, cyclic graphs, cascade deletion, collapse, and deterministic tidy behavior.
- One hundred twelve production-Worker end-to-end checks pass across Chromium, Firefox, and WebKit, with two intentional non-Chromium stress-test skips. They cover browse/drop/paste import, corrupt-file rejection, image child/sibling actions, double-click and keyboard layer editing, title/body formatting and toggle-off behavior, outside-click geometry restoration, connection validation and reconnection, locked layers, cascade deletion, focus restoration, search, branches, checkpoints, bulk arrangement, undo/redo, backup/restore, drag/resize persistence, SVG download, accessibility, and mobile panels. The 500-layer/800-connector stress scenario passes in Chromium.
- The automated workflow confirms that the local-only editor makes no off-origin requests.
- Mobile Lighthouse scores 98 performance and 100 accessibility, best practices, SEO, and agentic browsing; LCP is 2.2 seconds, CLS is 0, and total blocking time is 0 milliseconds in the local test profile.
- `npm audit` reports zero vulnerabilities.
- Remaining pre-deployment acceptance is owner testing with representative real images and a physical iOS/Android device. A Cloudflare preview, domain setup, and production release remain approval-gated.

## Recommended v1 contract

- Host the app on Cloudflare Workers, first on a preview `workers.dev` URL and then on the production domain.
- Keep images, vectors, and documents local to the browser. Do not add accounts, D1, R2, or cloud sync in this release.
- Keep image vectorization disabled and hidden until the product direction explicitly brings it back.
- Hide or feature-gate semantic AI reconstruction until a real provider, privacy policy, error handling, and usage controls exist.
- Support the current and previous major versions of Chrome, Edge, Firefox, and Safari, including current mobile Safari and Chrome. File browsing is the universal fallback when drag, drop, or paste is unavailable.
- Treat cloud sync, collaboration, video vectorization, and AI diagram reconstruction as separate post-v1 tracks.

## Current baseline

- Local development works at `http://localhost:3000`; the built Worker is also verified locally through Wrangler.
- GPT Sites-specific packages, configuration, and hosting metadata have been removed.
- Cloudflare Worker configuration, immutable asset caching, security headers, CI, privacy documentation, and deployment scripts are present.
- IndexedDB autosave, validated backup/restore, layer editing, undo/redo, connector creation, and SVG export are implemented. The isolated image-vectorization implementation remains feature-gated off with no user-facing controls.
- Automated unit and cross-browser end-to-end coverage protects the release-critical workflows.
- The layer and connector behavior contract, test matrix, and local evidence are recorded in `LAYER_CONNECTION_TEST_PLAN.md`.
- Schema-v3 rich concept titles and bodies, version-1/2 migration, lazy-loaded single-editor operation, local checkpoints, templates, search, branch collapse, quick-add, bulk arrangement, connector labels/styles, and rich editable-SVG export are implemented.

## Definition of done

Production readiness is achieved only when all of these gates pass:

- **Functionality:** import, edit, create image/concept branches, undo/redo, reload recovery, and SVG export work on every supported desktop browser and at least one iOS and Android browser.
- **Privacy:** a network trace proves imported images and document contents never leave the device in local-only mode.
- **Reliability:** oversized, corrupt, unsupported, and memory-intensive images fail safely without losing the current document.
- **Accessibility:** the complete primary workflow is keyboard operable, status changes are announced appropriately, focus is preserved, and the layer list provides a semantic alternative to spatial canvas navigation.
- **Performance:** mobile Lighthouse performance is at least 90; accessibility and best-practices scores are 100; LCP is below 2.5 s, INP below 200 ms, and CLS below 0.1 in the agreed test profile.
- **Compatibility:** `vinext check` has no hard issues, production build succeeds, and the font warning is resolved or explicitly accepted with a tested fallback.
- **Security:** no secrets ship to the client, generated SVG is safely serialized, dependency audit has no unresolved high/critical findings, and production security headers are verified without breaking workers, blobs, or downloads.
- **Operations:** a preview deployment, production deployment, smoke test, logging policy, and tested rollback procedure exist.

## Phase 1 — Cloudflare-native foundation

### Work

1. Commit the confirmed deletion cleanup so the obsolete GPT Sites project ID cannot return.
2. Remove `@openai/sites-vite-plugin`, the `sites()` Vite plugin call, placeholder Sites bindings, and `.openai/hosting.json`.
3. Rename the package from `sites-project` to `synaptable`.
4. Run the current Vinext Cloudflare initializer on a controlled branch and review its changes instead of overwriting the existing Vite configuration blindly.
5. Add and commit the canonical `wrangler.jsonc`, pin the Workers compatibility date, and add `check`, production preview, and deploy scripts.
6. Replace `next/font/google` with locally bundled font files or a tested system-font stack so runtime rendering does not depend on a font CDN.
7. Document the required Node version and local commands in a project README.

### Gate

- `npm ci`, lint, unit tests, `vinext check`, production build, local development, and local production preview all pass from a clean clone.
- The build contains no GPT Sites package, route, sign-in behavior, or project identifier.
- `wrangler.jsonc` contains no secret and does not hardcode a personal API token.

## Phase 2 — Data safety and processing resilience

### Work

1. Strengthen image validation with decoded pixel/dimension limits in addition to the 15 MB compressed-file limit.
2. Handle corrupt decodes, unsupported color profiles, worker crashes, timeouts, cancellation, and out-of-memory-style failures with actionable messages.
3. Revoke object URLs, release image bitmaps, terminate abandoned workers, and prevent duplicate conversions.
4. Bound undo/redo by both operation count and estimated memory, especially for documents containing many SVG paths.
5. Version the IndexedDB schema and add safe migration, corruption recovery, storage-quota handling, and an explicit autosave status.
6. Add a portable project backup/restore format so local-only storage is not the user's only copy. Validate imported project data before applying it.
7. Preserve the current document until a new import has decoded and validated successfully.
8. Keep sanitization and escaping at the SVG export boundary and add adversarial tests for names, colors, path data, and metadata.

### Gate

- Automated tests cover corrupt files, oversized decoded images, worker failure/cancellation, quota errors, invalid saved state, project backup/restore, and malicious export strings.
- Repeated imports and deletes do not produce a growing memory trend in a DevTools heap comparison.
- Failure during import or tracing does not damage the previously saved document.

## Phase 3 — Production UX and accessibility

### Work

1. Audit landmarks, heading order, labels, accessible names, focus order, and visible `:focus-visible` styling.
2. Define and test keyboard commands for canvas selection, movement, layer actions, undo/redo, deletion, and escape/cancel behavior. Avoid positive `tabindex` values.
3. Use a small centralized polite live region for import, vectorization, autosave, export, and error status; reserve assertive announcements for data-loss risks.
4. Ensure every dialog traps focus correctly, closes with Escape when safe, restores focus to its trigger, and never hides a focused control from assistive technology.
5. Keep the layer panel as the semantic, searchable alternative to the spatial graph. Do not depend on experimental HTML-in-canvas APIs for core accessibility.
6. Verify 200% zoom, text resizing, forced colors/high contrast, reduced motion, touch targets, mobile tool panels, and portrait/landscape layouts.
7. Make unavailable functionality honest: hide the AI reconstruction action or present a clearly non-actionable future-feature explanation.
8. Add a concise privacy explanation near import: processing is on-device and browser storage can be cleared by the user or browser.

### Gate

- Lighthouse accessibility is 100 with no serious automated findings.
- A keyboard-only run completes the primary workflow without a pointer.
- VoiceOver/Safari and one second screen-reader/browser combination can identify the selected object, layer state, progress, errors, and successful export.
- Browse-to-import remains usable when drag/drop and clipboard APIs are unavailable.

## Phase 4 — Performance and browser robustness

### Work

1. Capture a repeatable mobile and desktop baseline for load, import, vectorization, layer editing, and export.
2. Keep tracing in a dedicated module worker and ensure progress updates are throttled so they do not create excessive main-thread work.
3. Profile large-path documents; reduce unnecessary React rerenders, history copies, layout recalculation, and layer-list work.
4. Split or defer code that is not needed for the first usable editor frame. Keep the vectorization worker as a separately cached asset.
5. Establish a compressed JavaScript budget based on the current production baseline, allowing no more than a 10% regression without an explicit review.
6. Test cold cache, warm cache, slow CPU, slow network, offline-after-load behavior, background/foreground transitions, and low-storage scenarios.
7. Verify hashed assets are cached immutably while HTML and Worker entry responses remain safely updateable.

### Gate

- Core Web Vitals meet the definition-of-done thresholds in the agreed mobile profile.
- Dragging, selection, and layer edits remain responsive during realistic large documents.
- Vectorization never creates an unbroken main-thread long task from the tracing algorithm.
- Bundle and memory budgets are recorded in CI or a checked-in release report.

## Phase 5 — Automated quality, security, and CI

### Work

1. Add unit coverage for vectorization options, document reducers/history, persistence migrations, validation, reconstruction feature flags, and SVG serialization.
2. Add Playwright end-to-end tests for browse import, drag/drop, paste, conversion, layer edits, visibility/locking/reorder, reload persistence, undo/redo, reset, and SVG download.
3. Test the generated Worker locally through Wrangler, not only through the Vite development server.
4. Add CI gates for clean install, lint, tests, Vinext compatibility, production build, Worker smoke tests, and dependency audit.
5. Add deterministic test fixtures: small raster map, large raster, transparent image, malformed file, and a known expected SVG structure.
6. Add an error boundary and verify that recoverable errors do not expose stack traces or document contents to users or logs.
7. Add and verify security headers. Roll out CSP in report-only mode first, then enforce it after validating Web Workers, blob images, inline framework behavior, and downloads.
8. Define dependency update policy and require focused regression testing for Vinext, Vite, React Flow, ImageTracer, and DOMPurify updates.

### Gate

- CI is green from a clean checkout and blocks merging on a failed required check.
- No high/critical dependency vulnerability remains without a written risk acceptance.
- End-to-end tests pass against both the local production Worker and the preview deployment.
- Browser console and network panels are clean during all primary workflows.

## Phase 6 — Cloudflare preview release

### Work

1. Have the owner authenticate Wrangler and select the exact Cloudflare account. Keep personal credentials outside the repository.
2. Deploy to a non-production Worker name or preview environment first.
3. Validate static-asset MIME types, cache headers, Worker module loading, image object URLs, IndexedDB persistence, and SVG downloads on the real preview origin.
4. Run the complete browser QA matrix with Chrome DevTools for agents: responsive emulation, accessibility tree, console, network, Lighthouse, performance trace, and memory inspection.
5. Enable Cloudflare request/error observability without logging image content, SVG data, document names, or other user-created content.
6. Record the deployed Worker version and test the rollback command before production traffic exists.

### Gate

- Preview smoke tests and end-to-end tests pass.
- There are no unexpected outbound requests containing user data.
- Production configuration, observability, and rollback are reviewed and documented.
- The owner approves the final Worker name, access model, and domain.

## Phase 7 — Production release and operations

### Work

1. Configure the production custom domain, DNS, TLS, canonical URL, and social metadata. Use `workers.dev` as the fallback until the domain is healthy.
2. If the app should be private rather than public, configure Cloudflare Access and test owner and denied-user flows before launch.
3. Publish a short privacy notice explaining local processing, browser storage, exports, and what Cloudflare can observe at the request level.
4. Tag the release commit, deploy the exact tested artifact/configuration, and record the resulting Worker version.
5. Run post-deploy smoke tests from a clean browser profile and at least one physical mobile device.
6. Monitor errors, availability, and Core Web Vitals during the launch window without collecting document content.
7. Update the implementation plan and README with the production URL, support policy, backup behavior, known limitations, and rollback steps.

### Gate

- Domain, TLS, privacy page, metadata, and all production smoke tests pass.
- No P0/P1 defects remain open.
- The previous Worker version can be restored using the documented rollback procedure.
- Local development continues to work without Cloudflare credentials.

## Explicit post-v1 backlog

These items are not blockers for the local-first production release:

- AI-based semantic concept-map reconstruction.
- Cloud accounts, multi-device sync, sharing, or collaboration.
- D1/R2 persistence.
- Video-to-vector conversion.
- Native SVG/PDF import with semantic layer recovery.
- Offline installation/PWA support.
- Billing, usage quotas, or organization administration.

Each needs a separate product, privacy, security, cost, and data-retention plan before implementation.

## Execution order and commit discipline

Implement phases in order. Use one focused commit per completed phase, and do not advance past a gate with known failures. Phase 6 requires Cloudflare account access; Phase 7 additionally requires the final access model and domain decision. All earlier phases can be completed locally without deploying anything.

## Primary references

- [Cloudflare Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Vinext deployment and compatibility](https://github.com/cloudflare/vinext)
- [Chrome DevTools for agents](https://developer.chrome.com/docs/devtools/agents)
- [Chrome Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance)
