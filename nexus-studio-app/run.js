/**
 * Nexus Studio - Entry Point (Node)
 * Kills processes on port, then launches Electron (which spawns the merged backend).
 * Run: node run.js  or  npm start
 * PORT: defaults to 8765. e.g. PowerShell: $env:PORT=8766; node run.js
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8765', 10);
const ROOT = path.resolve(__dirname);

function killPort(port) {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8', timeout: 10000 });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (line.includes(`:${port}`) && line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (/^\d+$/.test(pid)) pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore', timeout: 5000 });
      } catch (_) {}
    }
  } catch (_) {}
}

killPort(PORT);

const electron = spawn('npm', ['run', 'electron'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: String(PORT) },
});
electron.on('exit', (code) => process.exit(code ?? 0));
