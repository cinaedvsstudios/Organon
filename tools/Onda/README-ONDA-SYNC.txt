Onda Player Netlify Sync Package

Files:
- index.html: Onda Media Player with the static Cloud Sync settings tab and setup wizard.
- js/cloud-sync.js: browser-side device selection, password-manager request, save, load, and status UI.
- netlify/functions/onda-sync.js: Netlify Function that reads/writes JSON backups to Netlify Blobs.
- netlify.toml: Netlify project config.
- package.json: installs @netlify/blobs for the function.

Cloud sync scope:
- Each device profile stays separate: phone, laptop, work-laptop, and so on.
- Cloud Sync stores the library catalogue, playlists, metadata, settings, visualiser data, artwork references, and the selected device profile.
- Cloud Sync does not upload or restore actual MP3, video, or MIDI files. They remain local on each device and may need relinking after a cloud load.

Before deploy:
1. In Netlify, set the site base directory to tools/Onda if this repository is connected at its root.
2. In Netlify, create an environment variable named ONDA_SYNC_SECRET and set it to the private sync password.
3. Ensure Netlify Functions and Netlify Blobs are enabled for this site.
4. Deploy through a GitHub-connected Netlify site or Netlify CLI. A static drag-and-drop deploy will not provide the function endpoint.

After deploy:
1. Open the deployed Onda site.
2. Open Cloud Sync and enter the sync secret.
3. Choose or create one device profile, for example phone, laptop, or work-laptop.
4. Press Save Setup. Onda asks Chrome to retain the secret through its Password Credential support and remembers the selected device profile locally.
5. Press Test Connection. Success must say that both the sync function and Blob store are connected.
6. Load Device List, then save or load the selected device profile.

Troubleshooting:
- "ONDA_SYNC_SECRET is not configured" means the Netlify environment variable is missing or the site has not been redeployed after adding it.
- "Could not open Netlify Blob store" means Functions/Blobs context is unavailable. Confirm the Netlify site base directory and function deployment, then check the Netlify function logs.
- A request timeout means the browser could not reach the deployed function within 15 seconds.
- Device list is empty only when there are genuinely no saved device profiles, or when the function reports a real Blob-store error.
