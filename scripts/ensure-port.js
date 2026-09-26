import { execSync } from 'child_process';

// Close any running instance of reforge-app so Windows releases the binary file lock
try {
  execSync('taskkill /F /IM reforge-app.exe', { stdio: 'ignore' });
} catch {}

try {
  const stdout = execSync('netstat -ano | findstr :1420 | findstr LISTENING', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const lines = stdout.trim().split('\n');
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0' && pid !== String(process.pid)) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      } catch {}
    }
  }
} catch {
  // Port is clean
}
