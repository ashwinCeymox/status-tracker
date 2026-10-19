#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Launching Antigravity OmniRoute Planning Studio...');
const backendDir = path.resolve(__dirname, 'backend');
const frontendDir = path.resolve(__dirname, 'frontend');

const callerDir = process.cwd();

// Start FastAPI backend
const backend = spawn('uvicorn', ['backend.app.main:app', '--reload', '--port', '8000'], {
  cwd: path.resolve(__dirname),
  env: { ...process.env, WORKSPACE_DIR: callerDir },
  stdio: 'inherit'
});

// Start Vite frontend
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: frontendDir,
  stdio: 'inherit'
});

process.on('SIGINT', () => {
  backend.kill();
  frontend.kill();
  process.exit(0);
});
