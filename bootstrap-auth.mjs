import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function initializeAuth(path, encoded) {
  if (existsSync(path) || !encoded) return;
  const config = JSON.parse(encoded);
  if (typeof config.email !== 'string' || !config.email.includes('@') ||
      !/^[a-f0-9]{32}$/.test(config.salt) || !/^[a-f0-9]{128}$/.test(config.passwordHash)) {
    throw new Error('Invalid initial sign-in configuration');
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ email: config.email.trim().toLowerCase(), name: config.name || config.email, salt: config.salt, passwordHash: config.passwordHash, sessions: {} }), { flag: 'wx', mode: 0o600 });
}
