const { app } = require('electron');
const path = require('node:path');

const runtimeMain = app.isPackaged
  ? path.resolve(process.resourcesPath, '..', '..', 'desktop', 'capsularius-launcher', 'runtime-main.js')
  : path.join(__dirname, 'runtime-main.js');

require(runtimeMain);
