import { constants, closeSync, lstatSync, mkdtempSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { containedPath, verifyPlugin } from './verifyPlugin.mjs';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function writeText(outputRoot, target, value) {
  const path = containedPath(outputRoot, target, { allowMissing: true });
  containedPath(outputRoot, dirname(path));
  try {
    if (!lstatSync(path).isFile()) throw new Error('Output must be a regular file: ' + path);
    containedPath(outputRoot, path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const descriptor = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW || 0), 0o600);
  try { writeFileSync(descriptor, value); } finally { closeSync(descriptor); }
}

function visitFiles(directory, visit) {
  directory = resolve(directory);
  containedPath(directory, directory);
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      if (entry.name === '.git') continue;
      const path = containedPath(directory, join(current, entry.name));
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) visit(path, relative(directory, path));
      else throw new Error('Non-regular entry: ' + path);
    }
  };
  walk(directory);
}

export function snapshot(directory) {
  const files = {};
  visitFiles(directory, (path, name) => {
    files[name.replaceAll('\\', '/')] = createHash('sha256').update(readFileSync(path)).digest('hex');
  });
  return files;
}

export function verifyInstallation(source, installed) {
  for (const root of [source, installed]) {
    const result = verifyPlugin([root]);
    if (result.errors.length) throw new Error(result.errors.join('\n'));
    if (result.skillCount !== 16) throw new Error(root + ': expected all 16 skills');
  }
  const expected = snapshot(source);
  const actual = snapshot(installed);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Installed files differ from source');
  const manifest = JSON.parse(readFileSync(containedPath(installed, 'plugin.json'), 'utf8'));
  return { status: 'pass', version: manifest.version, skills: 16, files: Object.keys(actual).length, modelBehaviorEvaluated: false };
}

export function verifyTemporaryInstallation(source = sourceRoot) {
  const temporary = mkdtempSync(join(tmpdir(), 'amy-install-'));
  try {
    const installed = join(temporary, 'plugin');
    mkdirSync(installed);
    visitFiles(source, (path, file) => {
      const destination = resolve(installed, file);
      mkdirSync(dirname(destination), { recursive: true });
      writeText(installed, destination, readFileSync(path));
    });
    return verifyInstallation(source, installed);
  } finally {
    containedPath(tmpdir(), temporary);
    rmSync(temporary, { recursive: true, force: true });
  }
}

export function main(args) {
  if (args.length > 2 || args.some(x => !x || x.startsWith('--'))) throw new Error('Usage: [installed-root [source-root]]');
  return args.length ? verifyInstallation(resolve(args[1] || sourceRoot), resolve(args[0])) : verifyTemporaryInstallation();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)))); }
  catch (error) { console.error('Installation validation failed: ' + error.message); process.exitCode = 1; }
}
