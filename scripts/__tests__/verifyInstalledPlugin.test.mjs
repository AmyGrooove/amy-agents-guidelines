import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main, snapshot, verifyInstallation, verifyTemporaryInstallation, writeText } from '../verifyInstalledPlugin.mjs';

const source = fileURLToPath(new URL('../../', import.meta.url));
function workspace(t) {
  const root = mkdtempSync(join(tmpdir(), 'amy-install-test-'));
  t.after(() => {
    assert.equal(dirname(root), resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  });
  return root;
}

test('writeText accepts relative and absolute files inside the output root', t => {
  const root = workspace(t);
  writeText(root, 'report.json', '{"status":"pass"}\n');
  assert.equal(readFileSync(join(root, 'report.json'), 'utf8'), '{"status":"pass"}\n');
  writeText(root, join(root, 'report.json'), 'updated\n');
  assert.equal(readFileSync(join(root, 'report.json'), 'utf8'), 'updated\n');
});

test('writeText rejects traversal, absolute escapes and sibling prefix tricks before writing', t => {
  const root = workspace(t);
  const output = join(root, 'output');
  mkdirSync(output);
  for (const path of ['../escape.txt', '..\\escape.txt', join(root, 'escape.txt'), '../output-other/file.txt', 'C:escape.txt']) {
    assert.throws(() => writeText(output, path, 'bad'));
  }
  assert.equal(existsSync(join(root, 'escape.txt')), false);
});

test('writeText rejects symlinks in parent and final paths', t => {
  const root = workspace(t);
  const output = join(root, 'output');
  const outside = join(root, 'outside');
  mkdirSync(output);
  mkdirSync(outside);
  writeFileSync(join(outside, 'keep.txt'), 'keep');
  symlinkSync(outside, join(output, 'linked'), 'junction');
  assert.throws(() => writeText(output, 'linked/keep.txt', 'bad'), /symbolic links|junctions/);
  assert.throws(() => writeText(output, 'linked', 'bad'), /symbolic links|junctions/);
  assert.equal(readFileSync(join(outside, 'keep.txt'), 'utf8'), 'keep');
  assert.throws(() => writeText(join(output, 'linked'), 'keep.txt', 'bad'), /symbolic links|junctions/);
});

test('snapshot rejects a symlink root and computes fresh hashes after changes', t => {
  const root = workspace(t);
  writeFileSync(join(root, 'file'), 'before');
  const first = snapshot(root);
  writeFileSync(join(root, 'file'), 'after');
  assert.notDeepEqual(snapshot(root), first);
  const other = workspace(t);
  symlinkSync(root, join(other, 'linked'), 'junction');
  assert.throws(() => snapshot(join(other, 'linked')), /symbolic links|junctions/);
});

test('isolated installation validates all 16 skills without modifying source', () => {
  const before = snapshot(source);
  const result = verifyTemporaryInstallation(source);
  assert.equal(result.status, 'pass');
  assert.equal(result.skills, 16);
  assert.equal(result.modelBehaviorEvaluated, false);
  assert.equal(result.files, Object.keys(before).length);
  assert.deepEqual(snapshot(source), before);
});

for (const mutation of ['changed', 'missing', 'extra', 'skill', 'manifest', 'reference']) test('installation rejects ' + mutation + ' files', t => {
  const root = workspace(t);
  const installed = join(root, 'plugin');
  cpSync(source, installed, { recursive: true, filter: path => !path.split(/[\\/]/).includes('.git') });
  if (mutation === 'changed') writeFileSync(join(installed, 'scripts/evaluateRouting.mjs'), 'changed');
  if (mutation === 'missing') rmSync(join(installed, 'assets/icon.svg'));
  if (mutation === 'extra') writeFileSync(join(installed, 'extra.txt'), 'extra');
  if (mutation === 'skill') rmSync(join(installed, 'skills/develop-react-hook'), { recursive: true });
  if (mutation === 'manifest') writeFileSync(join(installed, 'plugin.json'), '{}');
  if (mutation === 'reference') rmSync(join(installed, 'references/shared/workflow-and-authority.md'));
  assert.throws(() => verifyInstallation(source, installed));
});

test('installation CLI rejects extra and unknown options', () => {
  for (const args of [['a', 'b', 'c'], ['--unknown'], ['']]) assert.throws(() => main(args), /Usage/);
});
