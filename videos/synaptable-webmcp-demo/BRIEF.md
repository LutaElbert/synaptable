---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "SynapTable turns loose canvas thinking into structured, editable knowledge through native WebMCP agent tools."
destination: youtube
aspect: 1920x1080
language: en
audience: "WebMCP Challenge judges, developers, and visual-thinking users"
length: 82.2s
angle: "transformation: loose ideas to agent-organized visual knowledge"
narration: yes
voice: Orus
style_preset: cartesian
---

## Intent

Create a polished product demo that markets SynapTable while showing the real
application as it works today. The audience should understand the problem,
see an agent use SynapTable's WebMCP tools, and leave with a concrete picture
of how free-form ideas become an organized table and reusable canvas nodes.
The tone is premium, clear, confident, and human rather than overly futuristic.

## Assets

- https://synaptable-preview.elbertluta.workers.dev — public product preview and visual source of truth.
- ../../artifacts/webmcp-demo/synaptable-webmcp-demo-captioned.mp4 — existing 30-second real-product capture; reuse picture only where its quality and actions match the story.
- ../../artifacts/webmcp-demo — existing screenshots, contact sheet, captions, narration, and capture metadata available for reference.

## Customizations

- Use real SynapTable interface recordings for every product-behavior claim.
- Show or clearly identify the six exposed WebMCP tools.
- Generate original narration with Gemini `gemini-3.1-flash-tts-preview` using the Orus voice.
- Include readable burned-in captions and restrained product-interface sound design.
- Use optional abstract visuals only for the opening or transitions; never present generated imagery as product UI.

## Notes

- The existing private YouTube draft must remain untouched until a replacement is reviewed and approved.
- Do not expose private project data, credentials, API keys, browser chrome containing personal data, or development-only diagnostics.
- Keep the final piece below three minutes; the approved Orus narration resolves at 82.2 seconds.
- Rendering, YouTube publication, and final Devpost submission are separate user approval gates.
