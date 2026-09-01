# SynapTable privacy

SynapTable's local-first mode processes imported images and editable canvas documents on the user's device. Image vectorization is currently disabled in the product interface.

## Data handling

- Imported images, editable paths, names, and canvas state are saved in that browser's IndexedDB.
- The app does not upload images or document contents to SynapTable or an AI provider.
- Project backups and PNG, SVG, PDF, or CSV exports are created only after the user requests a download.
- The backup dialog may show the browser's approximate origin-level storage use and retention status. This information is read locally and is not uploaded by SynapTable.
- Persistent local storage is requested only after the user selects **Protect local storage**, where the browser supports that capability.
- Local checkpoints are limited by both count and aggregate size, but clearing browser site data still removes the saved project and its checkpoints. A downloaded backup is the portable recovery mechanism.

## Hosting metadata

Cloudflare may process standard HTTP request metadata needed to deliver the application, such as IP address, user agent, requested URL, timing, and error status. Application logs must never include imported images, SVG path data, project names, or document contents.

## Future cloud or AI features

Any future account, synchronization, collaboration, or AI reconstruction feature requires a separate opt-in flow and an updated policy explaining the provider, purpose, retention, deletion, and cost controls before release.
