# Frame packet: 02-meet-synaptable

## Project inputs

- Project: /Users/elbert/Documents/ChatGPT/SynapTable/videos/synaptable-webmcp-demo
- Design tokens: /Users/elbert/Documents/ChatGPT/SynapTable/videos/synaptable-webmcp-demo/frame.md
- RULES_DIR: /Users/elbert/.agents/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 2 — Meet SynapTable

- scene: The real SynapTable surface settles into a clear hero view while the promise appears beside it.
- voiceover: "SynapTable keeps that freedom, then adds structure when you need it — on a local-first visual workspace that stays editable."
- duration: 9.436s
- poster: 6.5s
- transition_in: zoom-through
- status: built
- src: compositions/frames/02-meet-synaptable.html
- type: product_intro
- persuasion: Future pacing grounded in the current product
- beat: relief + clarity
- blueprint: device-surface-showcase (Adapt)
- focal: assets/source/product-demo-02.png
- roles: product-demo-02 = background · logo-2eefabe1 = supporting
- sfx: soft settle, fine line draw
- asset_candidates: assets/source/product-demo-02.png — approved real selected-concept state with Properties pane; svgs/logo-2eefabe1.svg — captured SynapTable header mark candidate

Adapt: keep the persistent product-surface hero and restrained showcase camera, but show one authentic selected-concept state instead of cycling reconstructed screens.
Scene 1 (0.0–1.4s): the zoom-through lands on the real selected concept and Properties relationship at a readable crop; the product surface establishes cleanly, centered and dominant, while the SynapTable label appears.
Scene 2 (1.4–6.5s): one controlled push reframes the selected concept and right-side properties together (`coordinate-target-zoom`); the approved callout hairline draws once and the headline/subline reveal only as the voice names freedom, structure, and editability.
Scene 3 (6.5–9.0s): camera and interface hold completely still for a calm product read; no ambient drift or additional UI state is implied.

narrativeRole: Land the video's promise by the second beat: free-form thinking can become structured knowledge without leaving the canvas.
keyMessage: SynapTable combines visual freedom, editable structure, and local-first ownership.

## Selected blueprint: device-surface-showcase

# device-surface-showcase — Device / Surface Showcase

**intent**: A product surface — a device mockup or a floating browser/app window — is the hero held in frame while its screens cycle through a real flow, showcased by a camera move that ranges from a static hold to a continuous 3D push.

**roles served**

- Key_Feature (from key-feature-device-screen-tour, key-feature-floating-window-scroll, key-feature-3d-device-hand-demo): show a feature being \_experienced inside its real interface\* — the surface houses the action and its screens advance through a flow, rather than enumerating tiles or chasing a cursor across a workflow. (Note: the three founding drafts are Key_Feature and variants differ by MECHANIC, not role; the mined stepwise-flow variant widens the blueprint to Product_Intro.)
- Key_Feature (from demo-page-scroll-spotlight): the floating-window push-scroll variant carried to a spotlight climax — a real webpage rendered as a tilted 3D card coasts in (power2, like a phone held up — no spring), header keywords flare on a karaoke glow as the VO names them, the page rolls to the demoed section, and one element LIFTS off the surface (translateZ + scale) under a radial spotlight that dims the rest.
- Product_Intro (from stepwise-flow-completion): a compact end-to-end product flow — setup/auth → action → success/confirm — plays out cursorless as successive screen states inside the held surface, capped by a confirming button press; bookended by title-card beats. The surface introduces the product by \_completing its core loop\*, not by touring screens.
- Key_Feature (from `showcase-carousel`): the showcase-carousel — two surfaces in sequence (a widget card cycling brand skins, a phone frame with app screens sliding through it) gated by interstitial claim words; the screen cycle is a breadth carousel ("N brands / N apps"), not a flow.

**duration**: 5–11.3s (page-scroll-spotlight 5–9s · floating-window 7.8s · 3d-hand 7.9s · in-device approval 7.9s · stepwise-flow 8.5–9.4s · device-tour 9.6s · showcase-carousel 11.3s)

**shot structure** One product surface — a `[device mockup]` or a `[floating browser/app window]` — is the persistent hero on a `[styled backdrop: gradient / radial / stylized 3D void]`; its `[screens/sections]` cycle through a real `[product flow]` while a showcase camera (static-hold, push-in→zoom-out, or one continuous push) presents it. Each screen state holds ~1.0–1.5s.

- Scene 1 (0.0–~1.5s): The surface ESTABLISHES — it `[slides in from an edge / drifts in from a tilt / dissolves from a full-frame title card]` and settles, with a `[accent shape or backdrop]` resolving behind it; the first `[screen]` is visible. The showcase camera begins (see variants).
- Scene 2 (~1.5–~Xs): The surface is OPERATED on its own face — a `[tap/select/scroll]` triggers the first screen advance: old content `[pushes out / scrolls up]`, new `[screen/section]` `[pulls up / pushes in from the side]`; concurrently a `[label / header word / side headline]` updates. The camera continues its move.
- Scene 3+ (~Xs–end, repeat for `[2–4 screen beats]`): The surface ADVANCES through successive `[screens/sections]`, each a discrete swap or scroll synced to the surface's flow, while the secondary copy `[swaps out-up / in-up]` or stays marked to hold reading position. HOLDS on the final `[screen]` (or, for one variant, blooms out — see variant).

- Variant — static-tour (key-feature-device-screen-tour, 9.6s): a `[device mockup]` slides in from off-screen and settles (ease-out); an `[accent-color shape]` scales up behind it (spring overshoot). Camera STAYS STATIC the entire clip — all motion is element/UI-level: a tap COMPRESSES a button (95%→100%), the UI scrolls/transitions to the next view (old pushes out, new pulls up), and a `[side headline]` SWAPS beside the device (old slides up + fades, new slides up + in) per screen. Holds on the final screen. No camera move, no cursor.
- Variant — floating-window (key-feature-floating-window-scroll, 7.8s): OPENS on a full-frame `[title card]` (a small `[icon]` draws in at center, `[feature name]` below; holds ~2s), which DISSOLVES to a `[macOS-style browser/app window]` floating on a `[vivid gradient]` (traffic-lights + `[URL pill]` + tabs; left nav, central content, right `[sidebar]`). Camera PUSHES IN on a `[target region/sidebar]` (active item highlighted `[accent]`, a cursor drifts down the list), then ZOOMS BACK OUT to re-frame the whole window while the content SCROLLS through `[sections]`; the `[highlighted item]` stays marked. One push-in→zoom-out arc, gated by the title-card opener.
- Variant — 3d-hand (key-feature-3d-device-hand-demo, 7.9s): FULLY 3D — a `[3D device]` drifts in a `[stylized 3D void / bloom + particles]`, opening tilted and self-rotating to face the lens nearly flat as ONE CONTINUOUS forward camera push begins (no cuts). A glossy `[3D hand]` rises from the bottom-foreground and GESTURE-DRIVES the surface: it swipes to scroll a `[picker/sidebar panel]` of `[option cards]` and taps `[option]` (while a `[header word]` letter-flips in place); the selection APPLIES — a `[new layout]` grows from center to fill the device face, nav flips, a `[marquee]` scrolls horizontally; the hand swipes again to scroll the page upward through `[sections]`, then drifts out. The camera never stops pushing; the bright device face keeps growing toward the lens until it BLOOMS into a `[light]` wash — a zoom-through "portal" exit that fills the frame.
- Variant — stepwise-flow (Product_Intro, 8.5–9.4s; in-device Key_Feature sub-mode 7.9s): CURSORLESS end-to-end flow — the surface completes `[setup/auth → action → success]` as a narrative arc. Opens on a `[title card]` that fades in/out on an ambient gradient (or a typed `[command]` running character-by-character on a terminal field). The `[flow surface]` arrives (phone mock slides up oversized and settles / bordered log panel replaces the command) and step 1 completes via rapid sequential pops — `[OTP digits]` fill boxes left-to-right capped by a green check, or `[log steps]` pop top-down with highlighted tokens, ending on a trailing-dots waiting state. State advances laterally (old content slides out left, new in from right, chrome persists) or via a dark-to-light scene swap into a white `[detail/confirm card]` whose elements stagger in. COMMIT: the `[CTA button]` is pressed (press dip / spinner "Processing") and a `[success state]` renders with check bullets — in the in-device sub-mode the commit runs a biometric ritual: dim overlay, `[squircle]` spring-pops, a ring draws around an icon, the icon morphs to a checkmark and holds; a slight camera push-in fires ONLY at the state transition (camera punctuates the commit, then re-locks). EXIT: the surface leaves and closing `[title cards]` pop in and ease smaller — the surface exits before the coda instead of holding. Camera otherwise static. For this variant the persistent hero is the FLOW, not one surface: a terminal panel may hand off wholesale to a confirm card.
- Variant — showcase-carousel (Key_Feature, 11.3s): TWO surfaces in sequence on a slowly drifting `[pastel mesh gradient]`, static camera, gated by centered interstitial `[claim words]` (fade in with gentle scale-up, fade out). Act 1: a white `[widget card]` scales in, flips/morphs into a tilted vertical widget and CYCLES `[N brand skins]` (~0.8s each) — one shared layout, per-skin content and accent swaps — while a large `[brand logo]` crossfades below per flip; the widget scales away. Act 2: a `[phone frame]` enters oversized and tilted, settles upright at center; full `[app screens]` slide left through it (~1s each), holding on the last. The screen cycle is a breadth carousel, not a flow — no taps, no cursor, no camera.

**motion vocabulary** surface establish (edge slide-in + settle / tilt drift-in + self-rotate-to-camera / title-card dissolve); accent shape spring behind surface; element-level screen-cycling (scroll-swap, push-in-from-side, scale-swap); button tap-compress; staggered side-headline reveal + copy swap (out-up / in-up); in-place header-word letter-flip; floating browser-window-on-gradient idle float; full-frame title-card opener (icon draw-in + label); camera push-IN on a region; camera zoom-OUT re-frame; content scroll-through; one continuous 3D camera-follow push (no cuts); 3D device drift + self-rotate; stylized-environment bloom/particles; 3D-hand entrance + swipe-scroll + tap (gesture-driven); picker-panel slide-in; template-apply grow-from-center; horizontal marquee scroll; gesture-driven page scroll; zoom-through bloom/portal exit; static-hold (no camera) as the floor of the camera range. Stepwise-flow additions: title-card bookends (fade-in/out opener; closers pop in then ease smaller); typed terminal command with prompt chevron; sequential top-down log pops with sub-line reveals; animated trailing-dots wait state; sequential digit pops left-to-right + green check confirm; lateral screen slide with persistent chrome; dark-to-light scene swap; staggered card element build-in (fade + slide-up); button press dip + fill flip; spinner processing state; success check-bullet reveal; notification banner spring-in with overshoot; lockscreen fade/blur-away as a card expands to fill the device face; commit-synced micro push-in; dim overlay; squircle spring pop; circular ring draw; icon morph to checkmark; surface exit before a title coda. Showcase-carousel additions: interstitial claim-word gate; brand-skin cycling with per-flip logo crossfade; card flip/morph into a tilted widget; oversized-tilted surface entry settling upright; fast slide-left screen carousel inside a static frame; drifting mesh-gradient backdrop.

**rule mapping** (per motion verb → backing rule, or flagged special)

- screen-cycling — UI scrolls/sections scroll inside the surface (device-tour, floating-window scroll, 3d-hand page scroll) → `3d-page-scroll` (webpage/app as a tilted card whose content `translateY`-scrolls to sections; primary mechanic for the surface's screen flow)
- floating-window establish + the surface presented as a tilted/floating UI card → `3d-page-scroll` (the tilt/perspective framing) + `css-3d-transforms` (perspective/`translateZ` depth)
- screen / side-copy state swaps (discrete screen states; side headline content swapping per beat) → `discrete-text-sequence`
- side-headline reveal (staggered fade + slide-up) → `discrete-text-sequence`
- in-place header-word letter-flip (3d-hand) → `hacker-flip-3d`
- screen swap as a coordinated shrink-out / pop-in between two screen states → `scale-swap-transition`
- template-apply "new layout grows from center to fill the face" (3d-hand) → `center-outward-expansion` (clustered-at-center → expand to fill)
- the surface morphing between states / title-card→window dissolve as the eye-anchor transition → `card-morph-anchor`
- button tap-compress (95%→100% press feedback) → `press-release-spring` (or `physics-press-reaction` for a heavier press)
- floating-window cursor click on the highlighted list item → `cursor-click-ripple`
- accent-highlight pop on the active sidebar/list item → `asr-keyword-glow` (accent glow on the focused item)
- drifting cursor down the sidebar list (floating-window) → `camera-cursor-tracking` (flat-cursor drift; pairs with the push-in)
- floating browser-window idle float / 3D device drift-breathe → `sine-wave-loop`
- 3D device drift + self-rotate-to-camera + perspective depth (3d-hand) → `css-3d-transforms` (CSS-3D) **or** `3d.md` technique (true Three.js/R3F device); see camera modifier
- horizontal `[marquee]` scroll (3d-hand) → `viewport-change` (PAN mode on the marquee strip) — _thin fit; a literal CSS-marquee/translateX loop is closer to a `gsap-effects`/CSS recipe than a named motion rule_
- 3D-hand entrance + swipe + tap as the interaction DRIVER (gesture input that scrolls/selects) → **flagged special — needs a heavier capability beyond the rule library (R3F/Three.js + WebGL), NOT a motion-shape rule.** The 3D hand model + WebGL bloom have a _technique_ backing (`3d.md` — R3F, `useGLTF` HandModel, `--gl=swiftshader` for the shader/bloom), but no motion-shape rule models a 3D hand as the swipe-to-scroll / tap-to-select gesture protocol. `context-sensitive-cursor` / `camera-cursor-tracking` only model a flat typing/pointer cursor, not a 3D gesturing hand.
- zoom-through bloom / portal exit (3d-hand) → **flagged special — needs a heavier capability beyond the rule library (WebGL), NOT a named transition rule.** Capability is `techniques.md` → WebGL shader (via `3d.md` headless WebGL: `--gl=swiftshader --concurrency=1`), but no named transition rule covers a bloom/portal fly-through.
- typed terminal command / non-linear log text (stepwise-flow) → `discrete-text-sequence` (typing + threshold state replacement) with `dynamic-content-sequencing` computing each step's window from content length
- sequential top-down log pops / OTP digit pops left-to-right / staggered confirm-card build-in → `spring-pop-entrance` (staggered group form; low overshoot for log lines)
- trailing-dots wait state → `sine-wave-loop` (finite repeats; step the opacity of 3 dots on a shared phase)
- lateral screen slide with persistent chrome → the existing screen-cycling mapping (`3d-page-scroll` translateX form inside the clipped surface); chrome sits outside the sliding layer
- notification banner spring-in / squircle pop (in-device) → `spring-pop-entrance`
- lockscreen fade/blur-away + card expands to fill the device face → `card-morph-anchor` (uniform-scale container morph — never tween width/height) + `depth-of-field-blur` (the blur-away)
- commit-synced micro push-in (camera punctuates the Approve/tap, then re-locks) → `multi-phase-camera` (single short push phase placed at the state transition)
- button press dip + fill flip / Approve press-down spring-back → `press-release-spring` (already mapped; the fill flip is its color-transition variation)
- spinner processing state → `svg-icon-enrichment` (rotating internal element with explicit SVG center)
- success check bullets / biometric ring draw → `svg-path-draw` (check strokes; ring rotated −90° to start at 12 o'clock) + `spring-pop-entrance` for the bullet pops
- icon morph to checkmark (biometric ritual) → **flagged special — SVG path morph, see hyperframes-keyframes (morph)**; no motion-shape rule models it — mechanics live in `techniques.md` / the keyframes skill, same tier as the blueprint's existing WebGL flags
- interstitial claim-word gate (fade + gentle scale-up, then out) → `gsap-effects` (plain fade/scale chord; deliberately quieter than `kinetic-beat-slam`)
- brand-skin cycling with per-flip logo crossfade → `discrete-text-sequence` (whole-state content replacement at thresholds) + `scale-swap-transition` where a flip reads as shrink-out/pop-in; the card→tilted-widget flip/morph → `card-morph-anchor` + `css-3d-transforms`
- drifting mesh-gradient backdrop → `sine-wave-loop` (very-low-amplitude position/hue drift on gradient blobs)

**camera modifier**: The showcase camera spans a RANGE keyed by variant, all on a single content-wrapping virtual camera (`viewport-change`):

- static-tour → NO camera move (`viewport-change` held at scale 1, or omitted); all motion is element-level. This is the floor of the range and what distinguishes the device-tour from the rest.
- floating-window → a two-phase push-in → zoom-out arc → `multi-phase-camera` (e.g. dramatic-reveal 1.1→1.0→0.95 feel): push IN on the `[sidebar/region]` via `coordinate-target-zoom` (off-center target = scale + counter-translate), then `multi-phase-camera` zooms back OUT to re-frame the whole window while content scrolls.
- 3d-hand → ONE continuous forward push (no cuts) → `multi-phase-camera` in steady-push mode (1.0→1.03→1.06… plus its sine micro-drift) layered over `css-3d-transforms`/`3d.md` so the device self-rotates-to-lens during the push; the push runs unbroken into the bloom/portal exit (exit itself is the WebGL-shader flagged special above). Across all three: `viewport-change` is the base virtual-camera primitive; `multi-phase-camera` sequences the push/zoom phases (and supplies the always-on micro-drift that keeps even the "static" tour from feeling dead); `coordinate-target-zoom` aims the push at off-center screen detail.

**Overflow (pan/scroll surfaces — required for a clean `check`):** a panned or scrolled surface deliberately moves content PAST the edges of its framing card. Clip it at the card (`overflow: hidden` on the card/window) AND mark the moving inner layer (the `.world` / surface wrapper holding the screenshot + any markers/labels) with `data-layout-allow-overflow` — otherwise `check` reports `text_box_overflow` / `container_overflow` errors for the parts that scroll off (e.g. a marker label panned off the left edge). The card clips them visually; the attribute tells the layout audit it's intentional, not a layout bug.

## Selected motion rule: coordinate-target-zoom

---
name: coordinate-target-zoom
description: Zoom into a specific non-centered element by combining scale with counter-translation — target ends at viewport center after the zoom completes.
metadata:
  tags: camera, zoom, scale, translate, target, off-center, focus
---

# Coordinate Target Zoom

A simple `scale > 1` on a wrapper pushes off-center content OFF the visible canvas. To zoom _into_ a specific non-centered element, apply scale AND an inverse translation in lockstep so the target lands at viewport center.

## How It Works

Two nested wrappers, separated concerns — never scale and translate on the SAME element (`translate * scale` ≠ `scale * translate` in CSS transform composition):

1. **Outer wrapper** applies `scale` (the zoom) around `transform-origin: 50% 50%`
2. **Inner wrapper** applies `translate(x, y)` (the counter-shift)

The counter-translate is the **negation** of the target's offset from viewport center:

```
T = -offset
```

Derivation: the inner translate moves the target to `offset + T` in pre-scale units; the outer scale S (around center) maps that to `S × (offset + T)`; landing at center means `S × (offset + T) = 0` → **`T = -offset`**. The formula does NOT depend on S — the translate is identical at 1.5×, 2×, or 3×. A common wrong intuition is `T = -offset × (S - 1)`: it coincidentally matches at S = 2 and is wrong at every other scale.

⚠️ **This is the NESTED-wrapper formula.** The single-wrapper camera in [viewport-change.md](viewport-change.md) puts `translate(x,y) scale(S)` on ONE element, where CSS applies scale first — there the counter-translate is **`T = -offset × S`**. The two formulas are not interchangeable; match the formula to the wrapper structure.

## Getting the offset

`T = -offset` is only as good as `offset`. The #1 way this pattern ships broken is hand-computing `offset` from a layout formula, getting the **sign** or magnitude wrong, and letting the zoom amplify a small error off-screen. **Default to measuring the target's real laid-out center; reserve the formula for symmetric rows.**

**Default — measure the actual center (works for ANY layout).** Immune to sign errors because it reads the rendered DOM, not a mental model:

```js
await document.fonts.ready; // metrics final; fallback fonts are 10–30px off → tens of px after a 3×+ zoom
const W = 1920,
  H = 1080;
const r = document.getElementById("target-card").getBoundingClientRect();
const TARGET_OFFSET_X = r.left + r.width / 2 - W / 2;
const TARGET_OFFSET_Y = r.top + r.height / 2 - H / 2;
```

Measure **once at setup** and bake — never per-frame in `onUpdate`. Because the measurement is async (`fonts.ready`), build and register the timeline inside the same `async` setup so the baked offset is ready before `window.__timelines[id]` is published.

**Shortcut — symmetric equal-width row ONLY:**

```js
const index_offset = targetIndex - (N - 1) / 2;
const TARGET_OFFSET_X = index_offset * (CARD_WIDTH + CARD_GAP);
```

⚠️ This assumes every sibling is the **same width**. The moment the row is asymmetric, it gives the wrong answer — often the wrong **sign**: the heavier side shifts the centered target the _opposite_ way you'd guess (e.g. `companion(220) + gap + wordmark + gap + chip(110)` puts the wordmark ~55px **right** of center, but "chip − companion" intuition says left). For anything but equal cards, **measure**.

**Headroom budget — cap the scale from the measured size.** A zoom multiplies any centering error; keep the target ≤ ~88% of the canvas at peak:

```js
const maxScale = Math.min((0.88 * W) / r.width, (0.88 * H) / r.height);
const ZOOM_SCALE = Math.min(DESIRED_SCALE, maxScale);
```

A target filling 97%+ of the frame reads as cut-off the instant its center is slightly off — and a hand-baked offset always is. (The perception gate flags this as `primary-offscreen`; `data-layout-allow-overflow` does **not** exempt it.)

## Recipe

```html
<div class="zoom-outer" id="zoom-outer">
  <div class="zoom-inner" id="zoom-inner">
    <div class="content">
      <div class="card">{other}</div>
      <div class="card target" id="target-card">{target}</div>
      <div class="card">{other}</div>
    </div>
  </div>
</div>
```

```css
.scene {
  overflow: hidden; /* REQUIRED — at zoom > 1 the scaled content leaks past the frame */
}
.zoom-outer {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  transform-origin: 50% 50%; /* center scaling is what the counter-translate math assumes */
  will-change: transform;
}
.zoom-inner {
  display: grid;
  place-items: center;
  will-change: transform;
}
```

```js
// TARGET_OFFSET_X/Y and ZOOM_SCALE come from "Getting the offset" — measured
// at setup (after fonts.ready), baked. Counter-translation = -offset.
const counterX = -TARGET_OFFSET_X;
const counterY = -TARGET_OFFSET_Y;

// Scale and counter-translate MUST share position, duration, AND ease —
// otherwise the target visibly wanders mid-zoom.
tl.to("#zoom-outer", { scale: ZOOM_SCALE, duration: ZOOM_DUR, ease: "power3.inOut" }, ZOOM_AT);
tl.to(
  "#zoom-inner",
  { x: counterX, y: counterY, duration: ZOOM_DUR, ease: "power3.inOut" },
  ZOOM_AT,
);
```

## Variations

- **Zoom out (target → wide view)**: reverse the phases — start zoomed-in, then tween to `scale: 1` + `x: 0, y: 0`; the "reveal" beat is the panorama.
- **Multi-target zoom sequence**: chain zooms (target A → pause → target B → pull back); each segment needs its own counter-translation pair.

## Values

| token      | range                                   | notes                                                                                      |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| ZOOM_SCALE | 1.5× modest → 3× dominant → 5×+ extreme | cap via the headroom budget; raster media needs `sourceResolution ≥ rendered × ZOOM_SCALE` |
| ZOOM_DUR   | 1.0–2.0s                                | under 0.8s feels like a teleport, over 2.5s drags; both tweens share it                    |
| ZOOM_AT    | after the layout lands + 0.5–1.5s       | give the viewer time to scan the layout before the camera commits                          |
| DWELL      | ≥ 1.0s after the zoom settles           | 1.5–2s ideal — the viewer must be able to read the target (climax dwell)                   |

## Critical Constraints

- **Outer scales, inner translates** — never both transforms on one element; nested wrappers keep the math clean.
- **`transform-origin: 50% 50%` on the outer wrapper** — non-center origin breaks the counter-translate derivation.
- **`overflow: hidden` on the scene root** — zoomed content leaks past the frame otherwise.
- **Scale and counter-translate share duration + ease** at the same timeline position, or the target drifts mid-zoom.
- **Offset measured once at setup** (after `fonts.ready`), baked — never recomputed per-frame, never hand-derived for a non-symmetric layout (wrong sign → target shoved off-frame).
- **Scale within the headroom budget** — target ≤ ~88% of the canvas at peak, derived from the measured size.

## See also

[viewport-change.md](viewport-change.md) (single-wrapper form, `T = -offset × S`) · [multi-phase-camera.md](multi-phase-camera.md) (a zoom phase inside a phased camera) · [sine-wave-loop.md](sine-wave-loop.md) (idle breathing after the zoom settles) · [discrete-text-sequence.md](discrete-text-sequence.md) (text assembly in the target before the zoom).
