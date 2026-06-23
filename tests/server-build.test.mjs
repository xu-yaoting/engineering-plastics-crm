import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const serverTsconfig = readFileSync(new URL('../tsconfig.server.json', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');

test('server build uses Node ESM resolution', () => {
  const config = JSON.parse(serverTsconfig);
  assert.equal(config.compilerOptions.module, 'NodeNext');
  assert.equal(config.compilerOptions.moduleResolution, 'NodeNext');
});

test('server source imports local modules with .js extensions', () => {
  const files = [
    new URL('../server/index.ts', import.meta.url),
    ...readdirSync(new URL('../server/routes/', import.meta.url))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => new URL(`../server/routes/${name}`, import.meta.url)),
    new URL('../server/numbers.ts', import.meta.url),
    new URL('../server/weight.ts', import.meta.url),
  ];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      /from ['"]\.\.?\/(?!.*\.js['"])/,
      `${file.pathname} has a local import without .js extension`,
    );
  }
});

test('local server binds to localhost by default', () => {
  assert.match(indexSource, /const HOST = process\.env\.HOST \|\| '127\.0\.0\.1'/);
  assert.match(indexSource, /app\.listen\(PORT, HOST,/);
});
