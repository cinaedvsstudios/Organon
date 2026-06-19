const fs = require('node:fs');
const path = require('node:path');

const launcherRoot = __dirname;
const electronExe = path.join(launcherRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const iconPath = path.resolve(launcherRoot, '..', '..', 'capsularius.ico');

async function main() {
  if (process.platform !== 'win32') return;
  if (!fs.existsSync(electronExe)) throw new Error('Electron has not been installed yet.');
  if (!fs.existsSync(iconPath)) throw new Error(`Capsularius icon was not found: ${iconPath}`);

  const loaded = require('rcedit');
  const rcedit = loaded.rcedit || loaded.default || loaded;
  if (typeof rcedit !== 'function') throw new Error('The local rcedit install could not be loaded.');

  await new Promise((resolve, reject) => {
    let finished = false;
    const complete = (error) => {
      if (finished) return;
      finished = true;
      error ? reject(error) : resolve();
    };
    try {
      const result = rcedit(electronExe, { icon: iconPath }, complete);
      if (result && typeof result.then === 'function') result.then(() => complete(), complete);
      else if (rcedit.length < 3) complete();
    } catch (error) {
      complete(error);
    }
  });
}

main().catch((error) => {
  console.error(`Could not apply the Capsularius Windows icon.\n${error?.message || error}`);
  process.exitCode = 1;
});
