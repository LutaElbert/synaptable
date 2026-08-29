# SynapTable privacy

SynapTable's local-first mode processes imported images and vectorization work on the user's device.

## Data handling

- Imported images, editable paths, names, and canvas state are saved in that browser's IndexedDB.
- Local vectorization runs in a browser Web Worker.
- The app does not upload images or document contents to SynapTable or an AI provider.
- Project backups and SVG exports are created only after the user requests a download.
- Clearing browser site data removes the locally saved project for that origin. A downloaded backup is the recovery mechanism.

## Hosting metadata

Cloudflare may process standard HTTP request metadata needed to deliver the application, such as IP address, user agent, requested URL, timing, and error status. Application logs must never include imported images, SVG path data, project names, or document contents.

## Future cloud or AI features

Any future account, synchronization, collaboration, or AI reconstruction feature requires a separate opt-in flow and an updated policy explaining the provider, purpose, retention, deletion, and cost controls before release.

