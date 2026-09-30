# Frame packet: 05-structure-flows-both-ways

## Project inputs

- Project: /Users/elbert/Documents/ChatGPT/SynapTable/videos/synaptable-webmcp-demo
- Design tokens: /Users/elbert/Documents/ChatGPT/SynapTable/videos/synaptable-webmcp-demo/frame.md
- RULES_DIR: /Users/elbert/.agents/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 5 — Structure flows both ways

- scene: Rows are selected in the real table and return to the canvas as connected concept nodes.
- voiceover: "And the structure is not a dead end. Choose the rows you need, then bring them back as connected canvas nodes — ready to keep evolving."
- duration: 10.083s
- poster: 8.5s
- transition_in: push-slide LEFT
- status: built
- src: compositions/frames/05-structure-flows-both-ways.html
- type: benefit_highlight
- persuasion: Feature-to-benefit translation through reversibility
- beat: possibility + ease
- blueprint: camera-journey (Adapt)
- focal: assets/source/existing-webmcp-demo-captioned.mp4
- roles: existing-webmcp-demo-captioned = background · product-demo-06 = supporting
- sfx: gentle lateral whoosh, connected-node resolve
- asset_candidates: assets/source/existing-webmcp-demo-captioned.mp4 — real table-to-canvas node sequence; assets/source/product-demo-06.png — approved authentic connected-node hold

Adapt: keep the motivated cause-to-effect travel signature, but make it a flat lateral camera journey across one authentic SynapTable canvas rather than a stylized 3D flight.
Scene 1 (0.0–3.0s): begin on the real source table and selected rows; the tool label and headline settle above the caption-safe workspace while the camera holds on the cause.
Scene 2 (3.0–7.8s): as the real capture creates nodes from rows, the camera travels laterally from the table region toward the returned concepts (`viewport-change`, `multi-phase-camera`); the move is motivated by the result appearing, with matched directional velocity.
Scene 3 (7.8–9.5s): land on the connected returned nodes; the approved node highlight resolves only after the final node is visible, and the subline names that the source table remains.
Scene 4 (9.5–11.0s): hold the changed canvas completely still so reversibility reads; no camera drift after the landing.

narrativeRole: Show that table organization expands the canvas workflow instead of replacing it.
keyMessage: Ideas can move from canvas to table and back again.

## Selected blueprint: camera-journey

# camera-journey — Camera Journey

**intent**: The real viewport camera is the STORYTELLER — a multi-leg journey (dive in → a mid-journey beat fires → travel to the consequence / reposition → landing push, at rest) across ONE continuous world, where the travel itself carries the narrative. Two folded sub-shapes: **(A) action roundtrip** — the camera dives into a UI panel, a cursor/typed action fires, and the camera swoops/pans to another region where the consequence renders as element motion; **(B) cursorless flight** — pure cinematic 3D flight (motion blur, depth-of-field, tilt-to-flatten rotations) over static or self-animating content, no cursor anywhere.

**boundary**: This is NOT `cursor-ui-demo` — there the camera _chases_ the cursor (a servo following the actor); here the camera IS the actor, moving on its own narrative motivation, and in sub-shape A the cursor acts only at the leg hinge (in B it never appears). This is NOT `device-surface-showcase` — there one DEVICE/surface is hero and the camera merely presents it; here no single surface is hero — the journey traverses multiple regions/panels/depth planes and the traversal is the story. This is NOT `spatial-pan-stations` — there pre-placed stations on a flat canvas are visited by repeated pans of the same type; here the legs are heterogeneous (push-in, swoop, pull-back-rotate, whip, dive) and each leg is _motivated_ (by a fired action, or by the reveal it lands on).

**roles served**

- Benefits (from `camera-swoop-panel-action-roundtrip`): when the benefit IS a cause→effect round trip — "do this small thing here, get this big thing there" (comment → chart morphs; agent finding → verified commit; chat message → receipt + ledger). The camera physically connects the action to its payoff, so the viewer _travels_ the value chain instead of being told it.
- Key_Feature (from `cursorless-camera-flight`): when the feature should feel cinematic and inevitable — a payout form or a generated content-plan calendar explored by a flying camera (dives, whip sweeps, tilt-to-flatten, violent final push onto the CTA/hero card), the content acting by itself (a dropdown self-selects; keyword cards simply exist in depth) with no hand on the wheel.

**duration**: 5.6–11.1s (sub-shape A 5.6–9.0s: 001 5.6s · 066 8.6s · 004 9.0s; sub-shape B 6.3–11.1s: Outrank 6.3s · 094 11.1s)

**shot structure** (one oversized `[world]` — a `[UI canvas: design tool / GitHub + agent panels / phone + desktop ledger]` (A) or a `[3D-laid-out space: floating form card / calendar grid with standing keyword cards]` (B) — wrapped by a single virtual camera; content animates as elements _inside_ the world while the camera travels; every leg is a sequential tween on the same camera state)

- **Scene 0 (optional, 0.0–~1.8s) — static prologue.** Camera locked on a `[prologue beat: static promo card with a floating 3D product card / typed headline with an accent word / wide establishing shot of the app]`. A typewriter line may finish (`[headline]` types on, accent word in `[accent color]`). The prologue BREAKS by a hard cut or by the headline shrinking and slipping away as the first dive begins — the stillness exists to make the journey's launch land.

- **Scene 1 (~0.5–2.0s) — LEG 1: dive in.** The camera pushes in FAST and TIGHT onto `[the focal element]`:
  - _Sub-shape A_: a flat whole-viewport push onto `[an actionable element: comment box / agent panel / chat bubble]` where `[typed text]` finishes typing or `[response text]` streams in. The header/context leaves the frame — commitment, not a polite zoom.
  - _Sub-shape B_: the push lands at an ANGLE — a tilted 3D close-up of `[the form region / the calendar grid]`, foreground elements motion-blurred during the travel, neighbors soft under depth-of-field. A huge `[foreground prop: date number / field label]` may dominate the frame, blurred by speed.

- **Scene 2 (~1.5–6.0s) — LEG 2: the mid-journey beat (the hinge).** The camera holds, drifts, or pulls slowly while the content ACTS:
  - _Sub-shape A — the action fires_: a `[cursor]` clicks `[Send / Create PR]` (or a `[message]` sends implicitly) and the acted element CLEARS/vanishes. Optional theater before the click: a `[status spinner]` cycles `[status words]`, `[to-do items]` strike through, `[response text]` streams. The click is the hinge that _motivates_ the next leg.
  - _Sub-shape B — the content self-acts_: a `[dropdown]` expands by itself (pushing `[the field below]` down), shows a `[row hover highlight]` with no cursor, and collapses with the new value selected; OR the flight decelerates INTO FOCUS on `[one card]` — its `[metrics]` sharp, neighboring cards blurred.

- **Scene 3 (~4.0–8.0s) — LEG 3: travel to the consequence / reposition.**
  - _Sub-shape A_: the camera pulls back / swoops / pans to `[region B]` while the CONSEQUENCE builds as element motion — `[bars shrink into the baseline while a node-dotted line draws left→right / a verified commit row slides into the timeline + a reaction pill pops / a receipt card expands row-by-row from a skeleton]`. An optional SECOND leg extends the trip: `[pan up-right to a toolbar → a dropdown cascades open / match cut into an extreme close-up → a fast decelerating zoom-out reveals a ledger table]`.
  - _Sub-shape B_: a repositioning move — a slow pull-back that ROTATES the world flat and centered (3D → straight-on 2D), or a heavily motion-blurred WHIP SWEEP that resolves into a flat lateral pan across `[a month calendar / the full card]`. On the flat hold, quiet element beats may play: a thin `[focus outline]` fades in around one `[field]` and sweeps down to the next; the card keeps a near-imperceptible tilt/scale drift so the hold never dies.

- **Scene 4 (final ~1–2s) — LEG 4: landing.** The journey resolves on the payoff:
  - _Sub-shape A_: the camera comes to REST; the `[cursor]` hovers or drifts toward `[the payoff: an open Export menu item / the commit link / the View-transaction button]`; ends still, on the changed state — the world is visibly different from where the trip began.
  - _Sub-shape B_: a sudden VIOLENT push-in/dive (motion-blurred) onto `[the CTA button scaled huge in frame / the hero keyword card]`, ending holding tight — or holding MID-DIVE (the last frames are still traveling; the flat overview is explicitly not the final image).

**motion vocabulary**: whole-viewport camera push-in (fast/tight and slow/subtle); camera pull-back reframe; camera pan up/right/down; dive/swoop between stacked panels; fast decelerating zoom-out to rest; sudden violent push-in onto a button scaled huge; continuous 3D flight through a card grid; dive into an angled 3D close-up; slow pull-back that rotates/flattens the world to straight-on; heavily motion-blurred whip sweep; motion blur on camera travel; depth-of-field with blurred neighbors; decelerate-into-focus; hard cut / match cut into extreme close-up; near-imperceptible tilt/scale drift on holds; typed text finishing in an input; typewriter headline; headline shrinks and slips away as the camera dives; streaming AI response text; status-word spinner cycling labels; to-do strikethrough draw; cursor click; clicked element clears/vanishes; dropdown cascades open / self-expands and collapses with a row hover highlight (displacing the field below); bar-to-line chart morph (bars shrink into the baseline while a node-dotted line draws left→right, labels persist); commit row slide-in on a timeline; reaction pill appears; skeleton→content card build; receipt/label rows expand row-by-row; thin focus outline fades in and sweeps between fields; camera drift toward a button; 3D card subtle float; cursor hover at rest.

**rule mapping**

- the multi-leg camera itself — sequential push / pull-back / pan / dive phases on one wrapper, plus the micro-drift that keeps holds alive → `multi-phase-camera` (phase sequencing + drift) over `viewport-change` (the base virtual-camera primitive: single `.world` wrapper, one `cam {scale,x,y}` state — one source of truth for every leg)
- diving TIGHT onto an off-center element (comment box, chat bubble, Send button, one keyword card) → `coordinate-target-zoom` (scale + counter-translate; measure the target, don't hand-derive — a journey amplifies centering error on every leg)
- fast decelerating zoom-out from an extreme close-up to rest (066's ledger reveal) → `coordinate-target-zoom` zoom-out variation / `multi-phase-camera` (pull phase, hard `power4.out`)
- motion blur on camera travel (dive, whip sweep, violent final push) → `motion-blur-streak` (Camera-travel carve-out — the blur envelope rides the `.world` wrapper during a leg: the world never leaves frame, the blur peaks at peak velocity and resolves sharp at each landing)
- depth-of-field on neighbors while one card is in focus; decelerate-into-focus → `depth-of-field-blur` (focal pull + blur-the-cluster-while-pushing-in are explicitly in scope; run the DoF tween at the same position as the camera leg)
- the 3D flight itself (sub-shape B's core) — a perspective camera traveling with `rotateX/rotateY/translateZ` through a 3D-laid-out world: the dive into an angled calendar grid, the tilt-to-flatten pull-back (angled 3D → straight-on 2D), the continuous flight between standing cards → `3d-camera-flight` (perspective wrapper + preserve-3d; the 2D camera rules keep owning any flat legs)
- whip sweep → composition: `nudge-curve` (burst-dominant tuning of the slow-fast-slow slide, applied to the world) + `motion-blur-streak` (camera-travel carve-out) on the same window
- typed text finishing in an input; typewriter headline; streaming AI response text; status spinner cycling `[status words]`; skeleton→content state swap → `discrete-text-sequence` (+ `gsap-effects` typewriter; `context-sensitive-cursor` for the input caret)
- which content appears per leg / receipt rows and findings arriving on script windows → `dynamic-content-sequencing`
- cursor click on `[Send / Create PR]` (sub-shape A's hinge) → `cursor-click-ripple` + `press-release-spring` (or `physics-press-reaction` for a weightier press)
- clicked element clears/vanishes; panel state A → B on the return leg → `scale-swap-transition` / `card-morph-anchor`
- to-do strikethrough draw; row hover highlight → `css-marker-patterns` (strike-through) · `asr-keyword-glow` (accent glow on the hovered/selected row)
- bar-to-line chart morph → composite, decomposes cleanly: `stat-bars-and-fills` (bars `scaleY` → baseline) + `svg-path-draw` (node-dotted line draws left→right) at the same timeline position — no single rule names the coordinated chart-type morph, but no new rule needed
- commit row slide-in; reaction pill appears; receipt rows expand row-by-row → `spring-pop-entrance` (single arrivals) / `waterfall-entry` (the row-by-row cascade)
- dropdown self-expands, displacing the field below (094) → `anchored-layout-expand` (the masked edge-anchored expansion of the dropdown body — never tween `height`) + `reactive-displacement` (the expansion tween drives the sibling's displacement)
- focus-ring travel between fields (094: a thin outline fades in on `From`, then sweeps down onto `Amount`) → `ai-tracking-box` restyled as a plain outline (offsets baked at setup; size morphed via scale, never width/height)
- 3D card subtle float; near-imperceptible tilt/scale drift on holds → `sine-wave-loop` (+ `multi-phase-camera`'s drift for the camera-side micro-motion; the _tilt_ component of the drift belongs to `3d-camera-flight`)
- camera drift toward a button; slow subtle zoom-ins riding a hold → `multi-phase-camera` (steady-push mode, tiny spread)

**camera grammar** (the defining layer — this blueprint IS its camera): every leg is a tween on ONE camera state (`viewport-change`'s single `.world` wrapper / `cam` object), sequenced by `multi-phase-camera`, aimed by `coordinate-target-zoom`. Legs must be _motivated_: sub-shape A moves because an action fired (click → swoop to the consequence); sub-shape B moves because the next reveal demands it (dive → focus → reposition → final dive). Vary the leg verbs — a journey of four identical pushes reads as a slideshow. Ease law: hard `out`-family on dives and landings (`power4.out` — violent arrival, sharp settle), `power2.inOut` on repositioning legs; spring/back easing on a camera feels wrong (per `multi-phase-camera`). Sub-shape B layers `3d-camera-flight`'s perspective wrapper under the same single-state discipline.

**Seek-safety (non-negotiable for this much camera):** the entire journey — every leg, every blur envelope, every DoF pull — lives on the ONE paused GSAP timeline, so any frame seek reproduces the exact mid-leg camera pose. One camera state object, transform composed in a single writer (`applyCamera()`), no CSS `transition` anywhere near the wrapper, blur via proxy-tweened attributes / `--dof` vars (both seek-safe), and ending mid-dive is fine — a seek to the last frame just lands mid-tween. Per-leg targets are measured ONCE at setup (after `fonts.ready`) and baked; never `getBoundingClientRect` in `onUpdate`.

**Overflow (required for a clean `check`):** a traveling camera deliberately moves world content past the frame edges on every leg. Keep `overflow: hidden` on the scene root AND mark the moving `.world` wrapper with `data-layout-allow-overflow` — otherwise `check` reports `text_box_overflow` / `container_overflow` for every panel the journey leaves behind (see the same note on `device-surface-showcase`).

## Selected motion rule: multi-phase-camera

---
name: multi-phase-camera
description: Sequential camera zoom with 2-3 distinct phases (pull-back / focus / push) plus continuous micro-drift for organic cinematic feel.
metadata:
  tags: camera, zoom, phase, drift, scale, cinematic
---

# Multi-Phase Camera

A camera wrapper around the ENTIRE scene that progresses through discrete zoom phases at scripted triggers, with continuous sine-driven micro-drift overlaid so the camera never feels static between phases. Distinct from a single linear zoom — multi-phase creates cinematic pacing (anticipation → reveal → settle).

## How It Works

The camera is one wrapping `<div>` whose `transform: scale() translate(x, y)` is composed from two channels inside a single `onUpdate` writer:

1. **Phase scale** — a proxy object `{ scale }` stepped through phases at trigger times (`PHASE_1_SCALE` at t=0 → `PHASE_2_SCALE` at `PHASE_2_AT` → `PHASE_3_SCALE` at `PHASE_3_AT`).
2. **Drift offset** — a continuous sine-based `translateX` / `translateY` (small amplitude, slow frequency) ADDED to the phase transform. X and Y run at slightly different frequencies (`DRIFT_FREQ_RATIO ≈ 1.3`) — equal frequencies produce a perfect diagonal that reads mechanical; ~1.3 gives an organic Lissajous.

## Recipe

```html
<div class="camera" id="camera">
  <div class="content">
    <div class="hero">{Brand}</div>
    <div class="tagline">{tagline}</div>
    <div class="cta">{ctaText}</div>
  </div>
</div>
```

```css
.scene {
  overflow: hidden; /* REQUIRED — any phase scale < 1 exposes the content's edges */
  background: {sceneBgColor}; /* background on .scene, NOT .camera — a camera-borne
     background warps/translates with the transform and reveals the outer void */
}
.camera {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  transform-origin: 50% 50%; /* off-center origin creates phase-to-phase drift */
  will-change: transform;
}
```

```js
const camera = document.getElementById("camera");

// Three-phase scale plan: pullback → focus → push.
const phase = { scale: PHASE_1_SCALE }; // Phase 1 is the initial value — no tween

// Phase 2 — settle to neutral focus
tl.to(phase, { scale: PHASE_2_SCALE, duration: PHASE_2_DUR, ease: PHASE_2_EASE }, PHASE_2_AT);

// Phase 3 — slow push-in for the climax
tl.to(phase, { scale: PHASE_3_SCALE, duration: PHASE_3_DUR, ease: PHASE_3_EASE }, PHASE_3_AT);

// Drift driver — continuous sine motion overlaid on the phase scale.
// The ONE writer of camera.style.transform.
const drift = { p: 0 };
tl.to(
  drift,
  {
    p: Math.PI * 2 * DRIFT_CYCLES,
    duration: TOTAL_DURATION, // spans the whole composition
    ease: "none",
    onUpdate: () => {
      const dx = Math.sin(drift.p) * DRIFT_AMP_X;
      const dy = Math.sin(drift.p * DRIFT_FREQ_RATIO) * DRIFT_AMP_Y;
      camera.style.transform = `scale(${phase.scale}) translate(${dx}px, ${dy}px)`;
    },
  },
  0,
);

// Content reveals happen INSIDE the camera frame (hero/tagline/cta beats).
```

## Phase Patterns

| Pattern             | Scale sequence (1 → 2 → 3)        | Feel                            | When to use                   |
| ------------------- | --------------------------------- | ------------------------------- | ----------------------------- |
| **Focus-in**        | back → neutral → slight push      | Approach → settle → slight push | Default product reveal        |
| **Dramatic reveal** | push → neutral → pull             | Wide → focus → settle back      | Hero shot with breathing room |
| **Steady push**     | neutral → slight push → more push | Gradual forward momentum        | Continuous narrative push     |
| **Bookend pull**    | neutral → strong push → neutral   | Settle → push → release         | CTA emphasis then release     |

## Variations

- **Phase trigger by content beat**: align a camera tween's start with a content tween's end (entry completes → push begins) rather than a fixed clock value.
- **Camera shake (panic / impact)**: a brief higher-amplitude, higher-frequency drift tween over a short window — same `drift` mechanism with `SHAKE_AMP` / `SHAKE_CYCLES` / `SHAKE_DUR` at `SHAKE_AT`.
- **Targeted zoom into an off-center element**: combine scale with counter-translation so the target lands at viewport center — divide the measured offset by the current scale before feeding it into the writer:

```js
const tRect = document.querySelector(".cta").getBoundingClientRect();
const offsetX = (STAGE_W / 2 - (tRect.left + tRect.width / 2)) / phase.scale;
const offsetY = (STAGE_H / 2 - (tRect.top + tRect.height / 2)) / phase.scale;
// then in onUpdate: translate(offsetX + dx, offsetY + dy)
```

(Full counter-translate doctrine: [coordinate-target-zoom.md](coordinate-target-zoom.md).)

## Values

| token                       | range                                    | notes                                                                               |
| --------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| PHASE_1 / 2 / 3_SCALE       | 0.88–0.96 / 0.98–1.02 / 1.04–1.15        | tighter spread = subtler camera; scale < 1 REQUIRES `overflow: hidden` on `.scene`  |
| PHASE_2_AT / PHASE_2_DUR    | 0.3–1.0s / 1.0–1.8s                      | longer DUR = slower settle, more cinematic                                          |
| PHASE_3_AT / PHASE_3_DUR    | 2.0–4.0s / 1.0–2.0s                      | PHASE_3_AT ≥ PHASE_2_AT + PHASE_2_DUR or focus is preempted                         |
| PHASE_2_EASE / PHASE_3_EASE | `power2.out` `power3.out` `power2.inOut` | spring/back easing on a camera feels uncomfortable; each later phase settles deeper |
| TOTAL_DURATION              | = `data-duration`                        | the drift tween must span the whole composition                                     |
| DRIFT_CYCLES                | 1–3                                      | 1 = one slow breath; high values read as mechanical wobble                          |
| DRIFT_AMP_X / DRIFT_AMP_Y   | 2–8 px / 1–4 px                          | imperceptible per-frame, visible over time — if it reads as a shake, it's too much  |
| DRIFT_FREQ_RATIO            | 1.2–1.5                                  | 1.0 = perfect diagonal (mechanical); ~1.3 = organic Lissajous                       |
| HERO_AT (etc.)              | after Phase-2 settle lands               | a hero fading in mid-pull-back feels like it's flying away                          |

## Critical Constraints

- **Camera wraps EVERYTHING in the scene** — a per-element camera creates parallax bugs and breaks the "one viewpoint" read.
- **One writer**: phase scale and drift compose inside the single drift `onUpdate`; nothing else touches `camera.style.transform`.
- **`overflow: hidden` on `.scene`** — required whenever any phase scale < 1.
- **`transform-origin: 50% 50%` on `.camera`** — off-center origin creates unpredictable phase-to-phase drift.
- **Scene background on `.scene`, not `.camera`** — otherwise scaling/translating reveals the outer void.
- **Hero reveal starts AFTER the initial pull-back ease lands** — otherwise the headline feels like it's flying away.

## See also

[coordinate-target-zoom.md](coordinate-target-zoom.md) (counter-translate math for the targeted variation) · [orbit-3d-entry.md](orbit-3d-entry.md) (orbit inside a drifting camera) · [counting-dynamic-scale.md](counting-dynamic-scale.md) (climax push synced to counter peak) · [3d-text-depth-layers.md](3d-text-depth-layers.md) (depth-stacked hero under camera moves) · [sine-wave-loop.md](sine-wave-loop.md) (element idle inside the camera).

## Selected motion rule: viewport-change

---
name: viewport-change
description: Virtual camera — simulate zoom / pan / focus-lock by transforming a wrapper around all scene content. Camera moves right → world translates left.
metadata:
  tags: viewport, camera, zoom, pan, focus-lock, virtual-camera
---

# Viewport Change (Virtual Camera)

Simulates camera effects (zoom / pan / focus-lock on a moving element) by transforming a wrapper around ALL scene content. The "world" moves opposite to the perceived camera. Distinct from [multi-phase-camera](multi-phase-camera.md) (2-3 discrete phases + drift) — viewport-change is a single continuous zoom/pan, often used for focus-lock following a moving element.

## How It Works

Camera intent → world transform. Camera **pans right** → world `translateX(-distance)`; camera **zooms in** → world `scale(>1)`; camera **follows element X** → world `translateX(viewportCenter - elementWorldX)` per-frame. Get the sign right or everything moves the wrong way. The single `.world` wrapper holds the camera transform; elements inside are positioned in world space, unchanged.

**Single-element composite transform (this rule's form).** Both scale and translate live on ONE wrapper as `translate(x, y) scale(S)`. CSS applies scale FIRST, then translate (right-to-left matrix composition), so a point at world offset `(ox, oy)` lands on screen at `(S × ox + x, S × oy + y)`. To map the target to viewport center, solve `S × offset + T = 0`:

```
T = -offset × S
```

This is **different from [coordinate-target-zoom](coordinate-target-zoom.md)**, which uses two nested wrappers (outer scales, inner translates) and derives `T = -offset` (independent of S). Mixing up the two forms drifts the target off-center as scale changes. Use this single-wrapper form when you want one source of truth for camera state (`cam.scale`, `cam.x`, `cam.y`) written via `onUpdate`; use nested wrappers when scale and translate can tween independently with shared ease.

## Recipe

```html
<div class="world" id="world">
  <div class="content">
    <div class="hero">{Brand}</div>
    <div class="tagline">{tagline}</div>
    <div class="cta" id="cta">{ctaUrl}</div>
  </div>
</div>
```

```css
.scene {
  overflow: hidden; /* REQUIRED — any non-1.0 scale reveals edges or pushes content off-frame */
  background: {bgGradient}; /* on .scene, NOT .world — a world-borne background warps with the camera */
}
.world {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  transform-origin: 50% 50%; /* centered scaling is what the math assumes */
  will-change: transform;
}
```

```js
const world = document.getElementById("world");

// Camera state — single source of truth. The world transform is composed from
// this object in ONE place so the transform string order is stable.
const cam = { scale: 1, x: 0, y: 0 };
function applyCamera() {
  world.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`;
}
applyCamera(); // seed frame 0

// Zoom in on the CTA: single-element composite transform → T = -offset × S.
// TARGET_OFFSET_Y is the target's measured offset from viewport center at
// neutral camera (sign matters — positive = below center).
const counterY = -TARGET_OFFSET_Y * TARGET_SCALE;

tl.to(
  cam,
  {
    scale: TARGET_SCALE,
    y: counterY,
    duration: ZOOM_DUR,
    ease: "power3.inOut",
    onUpdate: applyCamera,
  },
  ZOOM_START,
);
```

## Scale Value Guide

| Effect      | Scale       | Feel                                |
| ----------- | ----------- | ----------------------------------- |
| Subtle      | 1.02 - 1.05 | Barely perceptible — "professional" |
| Medium      | 1.05 - 1.15 | "Ta-da" emphasis                    |
| Noticeable  | 1.15 - 1.30 | Focus on region                     |
| Dramatic    | 1.5 - 2.5   | Element fills screen                |
| Full-screen | 3.0+        | Element covers viewport             |

Perception: < 5% scale change is imperceptible; 10-15% is comfortable emphasis; > 30% is cinematic/dramatic. For a natural product feel, prefer 1.05-1.15× over 2-3s; save big > 1.3× zooms for dramatic narrative moments.

### Extreme range — 4–12× outward (workspace reveal)

The same single-cam math runs far past the table: a zoom-out workspace reveal opens punched-in at **4–12×** on one detail (a single cell, message, or button) and pulls out to the full workspace in one continuous move. The mechanics don't change — one `cam` object, `T = -offset × S`, one `applyCamera()` writer — only the authoring direction does:

- **Build the workspace at its final (1×) layout and OPEN scaled-in** (`cam.scale = 8`, counter-translate aiming the opening detail; state it in a `fromTo` / seed via `applyCamera()` so a seek to t=0 lands punched-in). The wide landing frame is then everything at native design size — text crisp, raster assets at source resolution.
- **Never the inverse** — authoring the close-up at 1× and scaling the world down to 0.08–0.25 for the wide frame drops every label below legible pixel size and softens raster media; the reveal lands on mush.
- **Measure the opening target** — at S = 8, a 1 px error in the baked offset is 8 px on screen at the opening pose. Take the offset from the target's real laid-out center (`getBoundingClientRect` after `fonts.ready`, once at setup — the measuring doctrine in [coordinate-target-zoom.md](coordinate-target-zoom.md)), never from a layout formula.
- **The opening detail must survive ×S** — it renders at `S ×` its design size on the first frames (vector/DOM text is safe; raster needs `sourceResolution ≥ rendered × S`).

## Variations

- **Focus-lock (camera follows a moving cursor/character)** — keep the element at a fixed screen X by computing the world offset per-frame inside the driver's `onUpdate`:

```js
const focusEl = document.querySelector(".moving-cursor");
const targetScreenX = VIEWPORT_WIDTH * FOCUS_SCREEN_X_FRAC; // 0.4–0.7; 0.5 = dead center
const focusUpdate = { p: 0 };
tl.to(
  focusUpdate,
  {
    p: 1,
    duration: FOLLOW_DUR, // matches how long the focused element is in motion
    ease: "power2.inOut",
    onUpdate: () => {
      const rect = focusEl.getBoundingClientRect();
      cam.x = targetScreenX - (rect.left + rect.width / 2);
      applyCamera();
    },
  },
  FOLLOW_START,
);
```

- **Composite scale (multi-phase)** — two proxy tweens multiplied through one writer: `cam.scale = scaleUp.v * scaleDown.v; applyCamera()`. Combine a slow push-in (~1.15) with a brief release (~0.9) for a breath/punch shape.
- **Camera mode transition (centered → follow)** — crossfade two camera modes via a 0→1 weight tween; intermediate frames interpolate between the modes' offsets.

## Values

| token           | range                                | notes                                                                                       |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| TARGET_OFFSET_Y | measured, not a free parameter       | target's offset from viewport center at neutral camera; measure via `getBoundingClientRect` |
| TARGET_SCALE    | 1.3× modest → 1.6–2.0× typical → 3×+ | raster media needs `sourceResolution ≥ rendered × TARGET_SCALE`                             |
| ZOOM_START      | content landed + ~0.5s scan time     | let the viewer read before the camera moves                                                 |
| ZOOM_DUR        | 1.0–2.0s                             | under 0.8s teleports, over 2.5s drags                                                       |
| DWELL           | ≥ 1.0s after the zoom settles        | the viewer must be able to read the focal point (climax dwell)                              |
| VIEWPORT_WIDTH  | = the root's `data-width`            | real value, not abstract                                                                    |

## Critical Constraints

- **One `.world` wrapper carries the whole camera** — every scene element lives inside it; a second transformed wrapper is a second camera.
- **Single source of truth via the `cam` object + `applyCamera()`** — when scale and translate both change, write them in ONE place; never split them across tweens that touch `world.style.transform` directly (the transform string composition order becomes unpredictable).
- **Single-wrapper counter-translate is `T = -offset × S`** — don't import the nested-wrapper `T = -offset` formula.
- **`overflow: hidden` on `.scene`**; **`transform-origin: 50% 50%` on `.world`**; **background on `.scene`, never on `.world`**.

## See also

[coordinate-target-zoom.md](coordinate-target-zoom.md) (nested-wrapper alternative, `T = -offset`) · [multi-phase-camera.md](multi-phase-camera.md) (viewport-change inside one phase) · [sine-wave-loop.md](sine-wave-loop.md) (idle micro-drift after the viewport settles).
