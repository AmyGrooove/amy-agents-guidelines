import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const pluginSchema = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
export const root = fileURLToPath(new URL('..', import.meta.url));

export function compatibilityManifest(manifest) {
  if (!manifest || manifest.$schema !== pluginSchema) throw new Error('Root plugin.json must declare the Agent Plugins 1.0.0 schema');
  const { $schema, extensions, ...identity } = manifest;
  const openai = extensions?.['com.openai'];
  if (!openai || typeof openai !== 'object' || Array.isArray(openai)) throw new Error('Root plugin.json must define extensions.com.openai');
  const identityKeys = ['name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords'];
  if (Object.keys(identity).some((key) => !identityKeys.includes(key))) throw new Error('Unsupported portable manifest field; update the compatibility mapping');
  if (Object.keys(openai).some((key) => key !== 'interface')) throw new Error('Unsupported OpenAI extension field; update the compatibility mapping');
  return { ...identity, skills: './skills/', interface: openai.interface };
}

export function syncManifest(check = false, directory = root) {
  const manifest = JSON.parse(readFileSync(join(directory, 'plugin.json'), 'utf8'));
  const expected = compatibilityManifest(manifest);
  const destination = join(directory, '.codex-plugin/plugin.json');
  if (check) {
    if (!isDeepStrictEqual(JSON.parse(readFileSync(destination, 'utf8')), expected)) throw new Error('Manifests differ; run node scripts/syncManifest.mjs');
  } else writeFileSync(destination, JSON.stringify(expected, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Usage: node scripts/syncManifest.mjs [--check]');
    syncManifest(args[0] === '--check');
    console.log(args.length ? 'Manifests match' : 'Compatibility manifest generated');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
