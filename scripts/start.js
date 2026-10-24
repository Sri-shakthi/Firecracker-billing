const { spawn } = require('node:child_process');
const electron = require('electron');

const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, ['.'], {
  cwd: process.cwd(),
  env: environment,
  stdio: 'inherit'
});

child.on('error', error => {
  console.error(`Unable to start Electron: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', code => {
  process.exitCode = code ?? 0;
});
