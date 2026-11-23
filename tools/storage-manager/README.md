# Organon Storage & Cleanup — integration notes

This is the Organon-specific Storage Manager, accessible from the hub's Settings panel.

## Safety boundary
Browser storage is scoped to the **origin**, not the `/Organon/` path. In the GitHub Pages deployment, other repositories published to `cinaedvsstudios.github.io` can share storage with Organon. Therefore, the manager **only displays or modifies entries matching an explicitly audited Organon storage key or known database name**. It does not inspect unrelated localStorage values, unidentified IndexedDB databases, non-Organon caches or arbitrary OPFS/cookies.

The built-in classification covers known hub and tool namespaces, including Onda, Capsularius, IHY, Orgavox, Code Writer, Character/UI Repository, and several others. New tools must register their actual keys/namespaces in `storage-manager.js` before they can be managed. Unknown records must remain untouched.

## Data protection
Quick Clean and Clear Selected are intentionally limited to explicitly approved disposable entries. They do **not** remove projects, drafts, media libraries, layout preferences or other protected data. Clear Everything separately requires a warning and typing `CLEAR ORGANON`; it may remove unrecoverable data, including known Organon IndexedDB databases.

The backup format covers **recognised Organon localStorage and sessionStorage text values only**, with import restoring localStorage values. It does not export Onda audio blobs, other IndexedDB records, Cache Storage or OPFS. Back up important user data through its own tool before performing a complete reset.

Known IndexedDB databases are inspected read-only, with object stores and up to 75 sample keys displayed per store; large/binary values are protected. Browser support for `indexedDB.databases()` varies.

## Server verification (optional)
To enable exact published-copy verification for a specific known storage key, configure this mapping *before loading the manager script*:

```html
<script>
  window.ORGANON_STORAGE_SYNC_TARGETS = {
    // Example — do not activate without an audited, matching JSON data source:
    // "organon-my-tool-records": {
    //   url: "/Organon/tools/my-tool/records.json",
    //   allowAutomaticRemoval: false
    // }
  };
</script>
```

The endpoint must be a same-origin HTTPS JSON resource and must contain the complete equivalent of the locally saved JSON. The manager compares normalised JSON content, not filenames or timestamps. An incomplete match, network failure or unknown destination retains the local copy. **No server mappings are enabled by default**, because the repo currently lacks a verified one-to-one mapping between each browser working-save and a published JSON resource.

The optional automatic removal setting remains disabled unless a mapping is configured and the user opts in. Each mapping additionally requires `allowAutomaticRemoval: true` to permit deletion after exact verification. Avoid automatic removal for offline backups and working drafts.

## Further improvements
- Verify and register additional keys as individual tools evolve.
- Audit whether an app's persistent IndexedDB records can be exported/restored through the tool's own format.
- Add exact server mappings only when a tool's published JSON schema has been verified.
- Consider a separate **Reset Layout Only** setting (preferences reset without deleting user projects).
- Add a general update/troubleshooting panel if needed; the existing hub already shows a version pill and manual.

## Files changed
- `index.html`: Settings link, storage panel and origin-safe backup/import/reset.
- `tools/storage-manager/storage-manager.js`: classified inspection, backup, cleanup and verification.
- `tools/storage-manager/storage-manager.css`: responsive styling.
