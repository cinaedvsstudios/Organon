Onda Player Netlify Sync Package

Files:
- index.html: Onda Media Player with Setup Wizard and Cloud Sync panel.
- netlify/functions/onda-sync.js: Netlify Function that reads/writes JSON backups to Netlify Blobs.
- netlify.toml: Netlify project config.
- package.json: installs @netlify/blobs for the function.

Before deploy:
1. In Netlify, create an environment variable named ONDA_SYNC_SECRET.
2. Set the value to your private sync password.
3. Deploy this whole folder through a GitHub-connected Netlify site or Netlify CLI.

Important:
If you use simple drag-and-drop static deploy and Netlify does not run/build functions, the player page may upload but cloud sync will not work. For Functions + Blobs, the most reliable method is GitHub-connected deploy or Netlify CLI deploy.

After deploy:
1. Open https://ondaplayer.netlify.app/
2. The setup wizard should open.
3. Enter your sync secret.
4. Click Test Connection.
5. Create/select one device profile: phone, laptop, or work-laptop.
6. Save current device to cloud or load an existing device profile.
