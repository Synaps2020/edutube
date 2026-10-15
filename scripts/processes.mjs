import { spawn } from 'node:child_process';

/** Un groupe séparé permet aussi d’arrêter les sous-processus de npm. */
export function startProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...options,
    detached: process.platform !== 'win32',
  });
  return child;
}

export function stopProcess(child, signal = 'SIGTERM') {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  try {
    if (process.platform === 'win32') {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error.code !== 'ESRCH') {
      throw error;
    }
  }
}
