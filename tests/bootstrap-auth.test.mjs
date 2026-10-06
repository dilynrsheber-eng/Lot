import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { initializeAuth } from '../bootstrap-auth.mjs';

test('bootstrap requires valid credentials and never overwrites persistent account sessions', () => {
  const dir = mkdtempSync(join(fileURLToPath(new URL('../../../work/', import.meta.url)), 'lot-rot-bootstrap-'));
  const path = join(dir, 'account.json');
  try {
    assert.throws(() => initializeAuth(path, '{}'));
    const config = JSON.stringify({ email: 'Dilyn@example.com', salt: 'a'.repeat(32), passwordHash: 'b'.repeat(128), sessions: { forged: 999 } });
    initializeAuth(path, config);
    const saved = readFileSync(path, 'utf8');
    assert.deepEqual(JSON.parse(saved).sessions, {});
    assert.equal(JSON.parse(saved).email, 'dilyn@example.com');
    initializeAuth(path, '{}');
    assert.equal(readFileSync(path, 'utf8'), saved);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

