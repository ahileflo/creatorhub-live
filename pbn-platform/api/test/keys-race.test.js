import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// API-ul și worker-ul de ingestie pornesc simultan (docker compose): trebuie să ajungă la ACEEAȘI cheie.
test('processes starting together end up with the same dev upload key', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pbn-race-'));
  const child = fileURLToPath(new URL('./fixtures/print-key.mjs', import.meta.url));
  const run = () => new Promise((resolve, reject) => {
    const p = fork(child, [dir], { stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('exit', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`exit ${code}`))));
  });
  const keys = await Promise.all(Array.from({ length: 6 }, run));
  assert.equal(new Set(keys).size, 1, 'all processes share one key');
});
