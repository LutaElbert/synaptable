# SynapTable HyperFrames Demo Implementation Plan

## Status

Planned, not yet implemented or rendered.

The existing YouTube upload remains private and will not be modified, replaced, or published during this plan. The final YouTube publication and the final Devpost submission are separate approval gates.

## Objective

Create a polished, evidence-based product demo for The WebMCP Challenge that shows how a person and an agent can work together inside SynapTable. The video will use real SynapTable interface capture, a HyperFrames composition, an original Gemini Orus narration, captions, and restrained motion graphics.

The finished video should make one idea clear:

> SynapTable lets people think spatially while a WebMCP agent performs precise, visible, reversible actions in the same canvas.

## Recommended Locked Brief

These values should be written to `videos/synaptable-webmcp-demo/BRIEF.md` when implementation begins:

| Field | Value |
| --- | --- |
| Workflow | `product-launch-video` |
| Intent | Show the real product as a concise hackathon demo |
| Flow | `automation` |
| Storyboard | `yes` |
| Destination | YouTube |
| Aspect | 16:9 |
| Resolution | 1920 × 1080 |
| Target length | 60–75 seconds |
| Hard duration limit | Under 3 minutes |
| Audience | WebMCP Challenge judges and technical product builders |
| Angle | Loose ideas become structured, reversible agent-assisted workflows |
| Voice | Gemini Orus; premium, natural, confident, and clear |
| Voice-over mode | Replace the sample car copy with an original SynapTable script |
| Visual source of truth | The public SynapTable application and real WebMCP execution |
| Style preset | `cartesian`, remixed with SynapTable’s indigo/white/graph-paper tokens |

## Creative Direction

The video will follow three principles:

1. Show the real product early and keep it as the primary evidence.
2. Give every scene one clear idea instead of stacking feature lists.
3. Make the viewer the hero: start with the work they currently do manually, then show what becomes possible with a bounded agent.

Generated imagery, if used, will be limited to one abstract opening or transition plate. It must not imitate the UI or imply functionality that the real product does not have.

## Proposed Story Spine

| Time | Beat | Visual proof | Narration purpose |
| --- | --- | --- | --- |
| 0–5s | Hook | Loose concept cards on the real canvas; table grid begins to emerge | Establish that ideas do not begin as rows and columns |
| 5–12s | Friction | Quick contrast between spatial thinking and manual restructuring | State the copy/paste and context-switching problem |
| 12–20s | Product reveal | SynapTable title, real interface, and WebMCP tool rail | Introduce SynapTable and the agent collaboration model |
| 20–39s | Core workflow | Real tool calls: summary, create/find concepts, organize into table | Demonstrate the canvas-to-table direction |
| 39–50s | Reverse workflow | Create a structured table and turn selected rows into concepts | Demonstrate table-to-canvas collaboration |
| 50–60s | Trust proof | Undo, reload persistence, one-step operation, safe-boundary callouts | Show that actions are visible, reversible, and persisted |
| 60–70s | Close | Finished workspace, logo, live URL, concise closing line | Leave judges with the product’s value and identity |

## Narration Draft

The final script will be refined against the storyboard and real capture timing. Initial direction:

> Ideas rarely begin in rows and columns. They start as notes, connections, and half-formed thoughts. But organizing them usually means leaving the canvas, copying context, and rebuilding the result by hand. SynapTable changes that. Through WebMCP, an agent can understand the active workspace, create concepts, find visible layers, and organize those ideas into a real editable table. The workflow also runs in reverse: structured rows become new canvas concepts, ready to connect and refine. Every agent action appears in the same interface, creates one undo step, and persists before success. The tools are bounded to the active project, with strict schemas and minimized results. Think spatially. Structure with an agent. Stay in control. SynapTable.

Target delivery is approximately 135–150 words per minute with deliberate pauses around the product reveal and closing line.

## Project Layout

Implementation will create an isolated HyperFrames project rather than adding video dependencies to the application package:

```text
videos/synaptable-webmcp-demo/
├── BRIEF.md
├── hyperframes.json
├── capture/
├── frame.md
├── STORYBOARD.md
├── SCRIPT.md
├── audio_request.json
├── audio_meta.json
├── assets/
│   ├── app/
│   ├── audio/
│   ├── screen-recordings/
│   └── stills/
├── scripts/
│   └── generate-gemini-tts.mts
├── compositions/
│   └── frames/
├── snapshots/
└── renders/
    └── synaptable-webmcp-demo.mp4
```

## Implementation Phases

### Phase 0 — Safe setup

1. Initialize `videos/synaptable-webmcp-demo` with the official `product-launch-video` workflow.
2. Write the confirmed `BRIEF.md` immediately after initialization.
3. Run `npx hyperframes auth status` and record the available provider status without storing credentials in the video project.
4. Load `GEMINI_API_KEY` from the repository’s ignored `.env.local` using `--env-file=../../.env.local`.
5. Install `@google/genai` and `mime` only inside the isolated video project if they are not already available.
6. Adopt reusable local media through `media-use` so provenance is recorded in `.media/manifest.jsonl`.

Gate: `hyperframes.json` and `BRIEF.md` exist; the key is detectable without being printed; Node, FFmpeg, and HyperFrames are available.

### Phase 1 — Capture authentic product evidence

1. Capture `https://synaptable-preview.elbertluta.workers.dev` with `npx hyperframes capture`.
2. Validate that the capture contains the real interface, visual tokens, visible text, asset descriptions, and full-page or scroll-position screenshots.
3. Inspect the existing 30-second recording and contact sheet in `artifacts/webmcp-demo/`.
4. Reuse the existing recording as picture-only source material when it clearly shows the real native flow; remove its existing audio before composition.
5. Record fresh shots only when the existing footage is unreadable, mistimed, or missing a required proof moment.
6. Use a fresh local workspace containing no personal notes, images, project names, or browser notifications.
7. Capture these proof moments:
   - the six registered WebMCP tools;
   - workspace summary;
   - concept creation;
   - layer search;
   - organizing layers into a table;
   - creating a table;
   - creating concepts from rows;
   - undo as one operation;
   - reload persistence.

Gate: all visual claims have authentic source footage or screenshots, and no private content appears.

### Phase 2 — Design system

1. Extract SynapTable colors, type, spacing, and graph-paper characteristics from the public capture.
2. Build `frame.md` from the shipped `cartesian` preset.
3. Remix the preset with the captured indigo, white, neutral-gray, and ink tokens.
4. Keep interface captures pixel-faithful; use the design system only for titles, callouts, framing, and transitions.
5. Use large, minimal typography and one message per frame.

Gate: `frame.md` validates and the caption skin is generated; the design looks like SynapTable rather than a generic AI product.

### Phase 3 — Storyboard and script

1. Write the seven-beat `STORYBOARD.md` using the story spine above.
2. Assign only real captured assets from the canonical capture inventory.
3. Write `SCRIPT.md` with frame-linked narration lines.
4. Specify exact tool names on screen where helpful, but keep explanations in user language.
5. Open the HyperFrames storyboard review board and present the plan as a proposal.
6. Produce wireframe sketches for every frame before animation.

Gate: every frame has a duration, purpose, asset candidate, transition, and narration line; the storyboard and sketches are approved.

### Phase 4 — Gemini Orus voice-over

1. Adapt the provided Gemini example into `scripts/generate-gemini-tts.mts`.
2. Keep `gemini-3.1-flash-tts-preview` and voice `Orus`.
3. Change the director prompt to:
   - premium product demonstration;
   - confident and curious rather than theatrical;
   - natural American English;
   - clear pronunciation of “SynapTable,” “WebMCP,” and “IndexedDB”;
   - dynamic pacing with short pauses before proof points.
4. Use a lower temperature than the sample when needed for repeatable delivery.
5. Correct two unsafe details from the sample implementation:
   - write binary buffers without the `utf8` encoding argument;
   - calculate the WAV data length from decoded PCM bytes, not base64 character length.
6. Collect streamed PCM chunks into one ordered buffer before writing a single WAV file.
7. Generate one primary take. Generate a pickup only if pronunciation, pacing, clipping, or duration fails acceptance criteria.
8. Normalize dialogue and create word timings with HyperFrames transcription for captions.
9. Adopt the final narration into the project media ledger.

Gate: the narration file is valid PCM/WAV, has no clipping or truncation, contains the complete script, and has word-level timing data.

### Phase 5 — Music, sound, and captions

1. Ask `media-use` for reusable candidates before resolving anything new.
2. Select a restrained ambient technology bed only if it supports the voice without making the demo feel like an advertisement.
3. Add minimal interface ticks or soft transition accents where the visual action needs emphasis.
4. Duck the music under narration and apply short fades at the start and end.
5. Generate embedded captions from the approved script and word timings.
6. Keep captions above the YouTube control-safe region and away from important interface controls.

Gate: narration is always intelligible; captions match the spoken words; music and effects never obscure UI proof.

### Phase 6 — Frame construction

1. Add time-coded layout and motion instructions to each storyboard frame.
2. Use restrained push-ins and cursor-follow framing for UI footage.
3. Use clean cuts for changes in task state and shared-position handoffs only where a visual element deliberately continues.
4. Stage all approved assets.
5. Generate one bounded frame packet per scene.
6. Use one HyperFrames frame worker per scene, in waves when concurrency is limited.
7. Assemble the frame compositions, narration, captions, music, and transitions into `index.html`.

Gate: every frame is marked animated, all assets resolve locally, and the complete composition seeks deterministically.

### Phase 7 — Verification and preview

1. Inject and verify transitions.
2. Run HyperFrames lint and composition checks.
3. Capture midpoint snapshots and before/after images around every cut.
4. Inspect the contact sheet for cropping, frozen frames, unreadable text, off-brand colors, and transition pops.
5. Play the browser preview from beginning to end with audio.
6. Present the preview and contact sheet for approval before rendering.

Gate: all automated checks pass and the preview is approved for render.

### Phase 8 — Render and delivery

1. Render high-quality H.264 MP4 after explicit render approval.
2. Verify duration, streams, dimensions, frame rate, pixel format, audio sample rate, and file integrity.
3. Open the MP4 locally in a normal player and inspect beginning, middle, end, and every cut.
4. Save the final file under `videos/synaptable-webmcp-demo/renders/`.
5. Keep the existing private YouTube draft unchanged until the new render is approved.
6. Upload or replace the YouTube video only after a separate action-time confirmation.
7. Make the YouTube visibility public only after the title, description, thumbnail, audience setting, and checks are reviewed.
8. Sync the public video URL to Devpost, then request the separate exact `yes, submit` confirmation.

## Test Plan

| ID | Area | Test | Expected result |
| --- | --- | --- | --- |
| T01 | Secrets | Scan project files and logs for the Gemini key | No key value appears in files, commands, logs, manifests, or media metadata |
| T02 | Capture | Run HyperFrames capture against the public origin | Capture succeeds with tokens, visible text, descriptions, assets, and trustworthy screenshots |
| T03 | Authenticity | Compare every shown tool/result with the public application | No fabricated UI, tool name, result, or product behavior |
| T04 | Privacy | Review every capture frame and browser notification | No personal projects, accounts, email addresses, tokens, or unrelated tabs are visible |
| T05 | Narrative | Watch without audio | The problem, WebMCP transformation, and final outcome remain understandable |
| T06 | Voice | Listen to narration end to end | Correct pronunciation, natural cadence, no missing chunks, clicks, clipping, or robotic pauses |
| T07 | Captions | Compare caption groups against narration | Text is accurate, synchronized, readable, and within the safe area |
| T08 | Audio mix | Measure loudness and true peak | Dialogue is consistent; final mix targets roughly -14 to -16 LUFS with true peak at or below -1 dBTP |
| T09 | WebMCP proof | Review the core workflow sequence | All six exposed tools are identified or visibly exercised, and the human-visible result is clear |
| T10 | Undo | Show or state the mutation history proof | Each demonstrated mutation is represented honestly as one undoable operation |
| T11 | Persistence | Include the reload result | The generated layers remain after reload, matching the validated public-origin behavior |
| T12 | Visual layout | Inspect midpoint and cut contact sheets | No clipped text, black frames, unintended empty holds, cursor obstruction, or transition pops |
| T13 | Determinism | Run `npx hyperframes lint` and `npx hyperframes check` | Both commands pass without ignored errors |
| T14 | Encoding | Inspect final MP4 with `ffprobe` | 1920×1080 H.264 video, broadly compatible pixel format, and AAC audio are present |
| T15 | Duration | Read final media duration | Target 60–75 seconds and always under Devpost’s 3-minute limit |
| T16 | Playback | Open in QuickTime and Chromium | File opens, seeks, plays with sound, and finishes cleanly in both |
| T17 | YouTube | Review processed draft before publication | HD processing and copyright checks pass; audio and captions remain intact |
| T18 | Devpost | Re-open live requirements before final submission | Public URL, public repository/license, public YouTube URL, description, and required answers are complete |

## Verification Commands

Run from `videos/synaptable-webmcp-demo` unless noted:

```sh
npx hyperframes lint
npx hyperframes check
npx hyperframes snapshot --at <midpoints-and-cut-boundaries>
npx hyperframes preview --background
npx hyperframes render --skill=product-launch-video --quality high \
  --output renders/synaptable-webmcp-demo.mp4

ffprobe -v error \
  -show_entries format=duration,size \
  -show_entries stream=codec_name,codec_type,width,height,pix_fmt,sample_rate,channels \
  -of json renders/synaptable-webmcp-demo.mp4

ffmpeg -i renders/synaptable-webmcp-demo.mp4 \
  -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json \
  -f null -
```

## Acceptance Criteria

The video is ready for final publication review only when all of the following are true:

- The opening communicates SynapTable’s purpose and WebMCP value within eight seconds.
- Real product capture is the primary visual evidence.
- The canvas-to-table and table-to-canvas directions are both visible.
- The six exposed WebMCP tools are named or demonstrated accurately.
- Agent actions are shown as human-visible, reversible, and persisted.
- Security language is accurate and limited to implemented boundaries.
- No private or unrelated user data appears.
- The Gemini Orus narration is complete, clear, natural, and synchronized.
- Captions are accurate and readable without covering important UI.
- Music and effects support rather than dominate the proof.
- HyperFrames lint and check pass.
- Midpoint and cut snapshots have been visually inspected.
- The final file is 1920×1080 H.264/AAC, plays correctly, and is under three minutes.
- The final render receives explicit approval before YouTube publication.
- YouTube publication receives a separate action-time confirmation.
- Devpost receives no final submission until the user replies exactly `yes, submit` after reviewing the complete payload.

## Rollback and Preservation

- The existing private YouTube draft remains untouched until a replacement is approved.
- The old local 30-second MP4 remains available as evidence and fallback footage.
- HyperFrames work stays isolated under `videos/synaptable-webmcp-demo/`.
- No application source change is required merely to produce the video.
- Any public application mutation used for capture affects only the browser’s local IndexedDB workspace and can be discarded without changing the deployed Worker.

## Next Approval Gate

Before Phase 0 begins, confirm the recommended locked brief: 60–75 seconds, original SynapTable narration using Orus, storyboard review, and automated execution.
