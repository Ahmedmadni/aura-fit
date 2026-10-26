import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// Exercise the actual workflow entry point, including missing input. These
// checks validate URL safety, not whether the target has been published.
const cases = [
  ['https://adaptive-wellspring-36.lovable.app', true],
  ['https://adaptive-wellspring-36.lovable.app/', true],
  ['https://fit.example-fitness.com', true],
  ['https://id-preview--a9dca5c6-d9fa-4c34-a631-4ce02f46fcb2.lovable.app', false],
  ['https://preview--fitness.lovable.app', false],
  ['https://lovable.dev/projects/example', false],
  ['https://lovable.dev', false],
  ['https://github.com', false],
  ['https://athlete.github.io', false],
  ['https://example.org', false],
  ['https://fit.example.com', false],
  ['https://localhost', false],
  ['https://127.0.0.1', false],
  ['https://10.0.0.1', false],
  ['https://192.168.1.1', false],
  ['https://172.16.0.1', false],
  ['https://[::1]', false],
  ['https://fitness.local', false],
  ['https://fitness.internal', false],
  ['http://fitness.com', false],
  ['https://fitness.com:8443', false],
  ['https://fitness.com:443', false],
  ['https://fitness.com/profile', false],
  ['https://fitness.com?test=1', false],
  ['https://fitness.com#home', false],
  ['https://fitness.com?', false],
  ['https://fitness.com#', false],
  ['https://user:password@fitness.com', false],
  [' https://fitness.com', false],
  ['', false],
];
for (const [target, allowed] of cases) {
  const result = spawnSync(process.execPath, ['scripts/validate-android-site-url.mjs'], {
    env: { ...process.env, AURA_SITE_URL: target }, encoding: 'utf8',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status === 0, allowed, `Unexpected Android target decision: ${target || '(missing)'}`);
}
console.log(`Android target safety PASS: ${cases.length} accepted/rejected origins.`);