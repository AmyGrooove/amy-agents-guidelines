import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncManifest } from './syncManifest.mjs';

const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const LINK_PATTERN = /!?\[[^\]\r\n]*\]\(([^)\r\n]*)\)/g;
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let pluginRoot;

export const containedPath = (root, target) => {
  if (/^(?:[A-Za-z]:|[\\/]{2})/.test(target) && !isAbsolute(target)) throw new Error(`unsupported absolute path: ${target}`);
  const path = resolve(root, target);
  const part = relative(root, path);
  if (part === '..' || part.startsWith('..\\') || part.startsWith('../') || isAbsolute(part)) throw new Error(`path escapes plugin: ${target}`);
  let current = parse(path).root;
  for (const component of path.slice(current.length).split(/[\\/]/).filter(Boolean)) {
    current = join(current, component);
    if (lstatSync(current).isSymbolicLink()) throw new Error(`symbolic links and junctions are not supported: ${current}`);
  }
  return path;
};

const getErrorMessage = (error) => error instanceof Error ? error.message : String(error);

const compareNames = (left, right) => left < right ? -1 : left > right ? 1 : 0;

const readText = (path, errors) => {
  try {
    if (pluginRoot) containedPath(pluginRoot, path);
    return readFileSync(path, 'utf8');
  } catch (error) {
    errors.push(`${path}: cannot read: ${getErrorMessage(error)}`);
    return undefined;
  }
};

const getPathInfo = (path, errors, label) => {
  try {
    if (pluginRoot) containedPath(pluginRoot, path);
    return lstatSync(path);
  } catch (error) {
    errors.push(`${path}: cannot access ${label}: ${getErrorMessage(error)}`);
    return undefined;
  }
};

const collectManifestPaths = (value, paths) => {
  if (typeof value === 'string') {
    if (value.startsWith('./')) {
      paths.push(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectManifestPaths(item, paths);
    }
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectManifestPaths(item, paths);
    }
  }
};

const validateManifest = (root, errors) => {
  if (existsSync(join(root, 'plugin.json'))) {
    try {
      containedPath(root, join(root, 'plugin.json'));
      containedPath(root, join(root, '.codex-plugin/plugin.json'));
      syncManifest(true, root);
    } catch (error) { errors.push(`${root}/plugin.json: ${getErrorMessage(error)}`); }
  }
  const manifestPath = join(root, '.codex-plugin', 'plugin.json');
  const text = readText(manifestPath, errors);
  if (text === undefined) {
    return undefined;
  }

  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    errors.push(`${manifestPath}: invalid JSON manifest: ${getErrorMessage(error)}`);
    return undefined;
  }

  if (manifest === null || Array.isArray(manifest) || typeof manifest !== 'object') {
    errors.push(`${manifestPath}: manifest must be an object`);
    return undefined;
  }

  if (typeof manifest.version !== 'string' || !VERSION_PATTERN.test(manifest.version)) {
    errors.push(`${manifestPath}: version must use MAJOR.MINOR.PATCH without leading zeroes`);
  }
  if (typeof manifest.name !== 'string' || manifest.name.length > 64 || !NAME_PATTERN.test(manifest.name)) errors.push(`${manifestPath}: invalid plugin name`);
  if (typeof manifest.description !== 'string' || !manifest.description.trim()) errors.push(`${manifestPath}: description must be non-empty`);
  if (manifest.author !== undefined && (!manifest.author || typeof manifest.author !== 'object' || Array.isArray(manifest.author) || typeof manifest.author.name !== 'string' || !manifest.author.name.trim())) errors.push(`${manifestPath}: author must have a non-empty name`);
  if (manifest.keywords !== undefined && (!Array.isArray(manifest.keywords) || new Set(manifest.keywords).size !== manifest.keywords.length || manifest.keywords.some((word) => typeof word !== 'string' || !word.trim()))) errors.push(`${manifestPath}: keywords must be unique non-empty strings`);
  if (manifest.interface !== undefined && (manifest.interface === null || Array.isArray(manifest.interface) || typeof manifest.interface !== 'object')) errors.push(`${manifestPath}: interface must be an object`);
  if (manifest.interface && typeof manifest.interface === 'object' && !Array.isArray(manifest.interface)) {
    for (const [key, limit] of Object.entries({ displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80 })) {
      const value = manifest.interface[key];
      if (typeof value !== 'string' || !value.trim() || [...value].length > limit) errors.push(`${manifestPath}: interface.${key} must contain 1-${limit} characters`);
    }
    if (typeof manifest.interface.category !== 'string' || !manifest.interface.category.trim()) errors.push(`${manifestPath}: interface.category must be non-empty`);
    const capabilities = manifest.interface.capabilities;
    if (!Array.isArray(capabilities) || capabilities.length > 20 || capabilities.some((value) => typeof value !== 'string' || !value.trim() || [...value].length > 120)) errors.push(`${manifestPath}: invalid interface.capabilities`);
    const prompts = manifest.interface.defaultPrompt;
    if (prompts !== undefined) {
      const values = typeof prompts === 'string' ? [prompts] : prompts;
      if (!Array.isArray(values) || values.length > 3 || new Set(values).size !== values.length || values.some((value) => typeof value !== 'string' || !value.trim() || [...value].length > 128)) errors.push(`${manifestPath}: invalid interface.defaultPrompt`);
    }
    for (const key of ['brandColor', 'brandColorDark']) if (manifest.interface[key] !== undefined && !/^#[0-9a-f]{6}$/i.test(manifest.interface[key])) errors.push(`${manifestPath}: invalid interface.${key}`);
  }
  for (const key of ['composerIcon', 'logo', 'logoDark']) {
    const value = manifest.interface?.[key];
    if (value !== undefined && (typeof value !== 'string' || !value.startsWith('./'))) errors.push(`${manifestPath}: ${key} must be a relative plugin path`);
    else if (value !== undefined) {
      const info = getPathInfo(resolve(root, value), errors, key);
      if (info && !info.isFile()) errors.push(`${manifestPath}: ${key} must point to a regular file`);
    }
  }

  const manifestPaths = [];
  collectManifestPaths(manifest, manifestPaths);
  for (const relativePath of [...new Set(manifestPaths)].sort(compareNames)) {
    if (relativePath.includes('\\') || relativePath.split('/').includes('..')) errors.push(`${manifestPath}: declared paths must use forward slashes and contain no .. components: ${relativePath}`);
    if (relativePath === manifest.skills) {
      continue;
    }
    getPathInfo(resolve(root, relativePath), errors, `declared path ${relativePath}`);
  }

  if (typeof manifest.skills !== 'string' || !manifest.skills.startsWith('./') || manifest.skills.length === 2) {
    errors.push(`${manifestPath}: skills must be a non-empty relative path starting with ./`);
    return undefined;
  }

  const skillsRoot = resolve(root, manifest.skills);
  const skillsInfo = getPathInfo(skillsRoot, errors, 'skills directory');
  if (skillsInfo !== undefined && !skillsInfo.isDirectory()) {
    errors.push(`${skillsRoot}: skills path must be a directory`);
    return undefined;
  }

  return skillsInfo === undefined ? undefined : skillsRoot;
};

const parseFieldValue = (path, field, value, errors) => {
  if (value === undefined || value.trim() === '') {
    errors.push(`${path}: ${field} must use a non-empty single-line value`);
    return undefined;
  }

  const raw = value.trim();
  const trimmed = /^["']/.test(raw) ? raw : raw.replace(/(?:^|\s+)#.*$/, '').trim();
  if (!trimmed || /^(?:null|true|false|~|[-+]?\d+(?:\.\d+)?)$/i.test(trimmed) || /^[&*!%@`]|^[-?:]\s/.test(trimmed) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(trimmed)) {
    errors.push(`${path}: ${field} must be a YAML string`);
    return undefined;
  }
  if (trimmed.startsWith('|') || trimmed.startsWith('>') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    errors.push(`${path}: ${field} must use an unquoted value or matching single or double quotes`);
    return undefined;
  }

  const firstCharacter = trimmed[0];
  if (firstCharacter === '"' || firstCharacter === "'") {
    if (trimmed.length < 2 || trimmed.at(-1) !== firstCharacter) {
      errors.push(`${path}: ${field} has an unclosed quoted value`);
      return undefined;
    }
    let unquoted;
    try {
      unquoted = firstCharacter === '"' ? JSON.parse(trimmed) : trimmed.slice(1, -1).replaceAll("''", "'");
      if (firstCharacter === "'" && /(^|[^'])'([^']|$)/.test(trimmed.slice(1, -1))) throw new Error('unescaped quote');
    } catch {
      errors.push(`${path}: ${field} has invalid quoted string syntax`);
      return undefined;
    }
    if (unquoted === '') {
      errors.push(`${path}: ${field} must use a non-empty single-line value`);
      return undefined;
    }
    return unquoted;
  }

  if (/:\s|:\s*$/.test(trimmed)) {
    errors.push(`${path}: ${field} contains an unquoted mapping delimiter`);
    return undefined;
  }

  return trimmed.replace(/\s+#.*$/, '').trim();
};

export const parseFrontmatter = (path, content, errors) => {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0] !== '---') {
    errors.push(`${path}: missing YAML frontmatter`);
    return undefined;
  }

  const endIndex = lines.indexOf('---', 1);
  if (endIndex === -1) {
    errors.push(`${path}: missing closing YAML frontmatter delimiter`);
    return undefined;
  }

  const fields = new Map();
  for (let index = 1; index < endIndex; index += 1) {
    if (/^\s*(?:#.*)?$/.test(lines[index])) continue;
    const match = lines[index].match(/^([a-z][a-z-]*):(?:[ \t]+(.*))?$/);
    if (match === null) {
      errors.push(`${path}: invalid or unsupported YAML at line ${index + 1}`);
      continue;
    }
    const [, field, value] = match;
    if (fields.has(field)) {
      errors.push(`${path}: duplicate frontmatter ${field}`);
      continue;
    }
    if (!['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'].includes(field)) errors.push(`${path}: unsupported frontmatter field ${field}`);
    if (field === 'metadata' && !value) {
      const keys = new Set();
      while (index + 1 < endIndex && /^  \S/.test(lines[index + 1])) {
        index += 1;
        const child = lines[index].match(/^  ([\w.-]+):\s+(.+)$/);
        if (!child || keys.has(child[1])) errors.push(`${path}: invalid or duplicate metadata key`);
        else { keys.add(child[1]); parseFieldValue(path, 'metadata', child[2], errors); }
      }
      if (!keys.size) errors.push(`${path}: metadata must be a non-empty string mapping`);
      fields.set(field, true);
    } else if (field === 'metadata') {
      errors.push(`${path}: metadata must use an indented string mapping`);
      fields.set(field, undefined);
    } else if (/^[|>][-+]?$/.test(value || '')) {
      const parts = [];
      while (index + 1 < endIndex && /^(?:  |$)/.test(lines[index + 1])) parts.push(lines[++index].slice(2));
      fields.set(field, parts.join(value.startsWith('>') ? ' ' : '\n').trim());
    } else {
      fields.set(field, parseFieldValue(path, field, value, errors));
    }
  }
  const name = fields.get('name');
  const description = fields.get('description');
  if (typeof name === 'string' && (name.length > 64 || !NAME_PATTERN.test(name))) errors.push(`${path}: invalid skill name (1-64 lowercase letters, digits, single hyphens)`);
  if (typeof description === 'string' && (!description.trim() || [...description].length > 1024)) errors.push(`${path}: invalid description (1-1024 characters)`);
  if (fields.has('compatibility') && (typeof fields.get('compatibility') !== 'string' || !fields.get('compatibility').trim() || fields.get('compatibility').length > 500)) errors.push(`${path}: compatibility must contain 1-500 characters`);
  if (!lines.slice(endIndex + 1).join('\n').trim()) errors.push(`${path}: missing skill body`);

  for (const field of ['name', 'description']) {
    if (!fields.has(field)) {
      errors.push(`${path}: missing frontmatter ${field}`);
    }
  }

  return {
    name: fields.get('name'),
    description: fields.get('description'),
  };
};

const getDirectoryEntries = (directory, errors) => {
  try {
    return readdirSync(directory, { withFileTypes: true }).sort((left, right) => compareNames(left.name, right.name));
  } catch (error) {
    errors.push(`${directory}: cannot read directory: ${getErrorMessage(error)}`);
    return [];
  }
};

const validateSkills = (skillsRoot, errors) => {
  const skillNames = new Map();
  let skillCount = 0;

  for (const entry of getDirectoryEntries(skillsRoot, errors)) {
    const entryPath = join(skillsRoot, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`${entryPath}: symbolic links and junctions are not supported`);
      continue;
    }
    if (!entry.isDirectory()) {
      continue;
    }

    skillCount += 1;
    const skillPath = join(entryPath, 'SKILL.md');
    const skillInfo = getPathInfo(skillPath, errors, 'SKILL.md');
    if (skillInfo === undefined) {
      continue;
    }
    if (skillInfo.isSymbolicLink() || !skillInfo.isFile()) {
      errors.push(`${skillPath}: SKILL.md must be a regular file`);
      continue;
    }

    const content = readText(skillPath, errors);
    if (content === undefined) {
      continue;
    }

    const frontmatter = parseFrontmatter(skillPath, content, errors);
    if (frontmatter === undefined || frontmatter.name === undefined) {
      continue;
    }

    if (frontmatter.name !== entry.name) {
      errors.push(`${skillPath}: name ${frontmatter.name} does not match directory ${entry.name}`);
    }

    const firstSkillPath = skillNames.get(frontmatter.name);
    if (firstSkillPath !== undefined) {
      errors.push(`${skillPath}: duplicate skill name ${frontmatter.name}; first declared in ${firstSkillPath}`);
      continue;
    }
    skillNames.set(frontmatter.name, skillPath);
  }

  if (skillCount === 0) {
    errors.push(`${skillsRoot}: skills directory must contain at least one skill`);
  }

  return skillCount;
};

const getMarkdownFiles = (directory, errors) => {
  const files = [];
  const walk = (currentDirectory) => {
    for (const entry of getDirectoryEntries(currentDirectory, errors)) {
      const entryPath = join(currentDirectory, entry.name);
      if (entry.isSymbolicLink()) {
        errors.push(`${entryPath}: symbolic links and junctions are not supported`);
        continue;
      }
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(entryPath);
      }
    }
  };

  walk(directory);
  return files;
};

const removeCode = (content) => {
  const lines = content.split(/\r?\n/);
  let fence = undefined;
  const visibleLines = [];

  for (const line of lines) {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (match !== null) {
      if (fence === undefined) {
        fence = match[1][0];
      } else if (match[1][0] === fence) {
        fence = undefined;
      }
      visibleLines.push('');
      continue;
    }
    visibleLines.push(fence === undefined ? line.replace(/`[^`\r\n]*`/g, '') : '');
  }

  return visibleLines.join('\n');
};

const parseLinkTarget = (source, target, errors) => {
  const trimmed = target.trim();
  if (trimmed.startsWith('<')) {
    const match = trimmed.match(/^<([^>]*)>(?:\s+"[^"]*")?$/);
    if (match !== null) {
      return match[1];
    }
  } else {
    const match = trimmed.match(/^(\S+)(?:\s+"[^"]*")?$/);
    if (match !== null) {
      return match[1];
    }
  }

  errors.push(`${source}: unsupported inline link destination ${target}`);
  return undefined;
};

const validateLinks = (source, content, errors) => {
  const visible = removeCode(content);
  const definitions = [...visible.matchAll(/^\s{0,3}\[[^\]]+\]:\s*(.+)$/gm)].map((match) => [match[0], match[1]]);
  const labels = new Set([...visible.matchAll(/^\s{0,3}\[([^\]]+)\]:/gm)].map((match) => match[1].toLowerCase().replace(/\s+/g, ' ')));
  for (const match of visible.matchAll(/\[([^\]\r\n]+)\]\[([^\]\r\n]*)\]/g)) {
    const label = (match[2] || match[1]).toLowerCase().replace(/\s+/g, ' ');
    if (!labels.has(label)) errors.push(`${source}: undefined reference link ${label}`);
  }
  for (const match of [...visible.matchAll(LINK_PATTERN), ...definitions]) {
    const linkTarget = parseLinkTarget(source, match[1], errors);
    if (linkTarget === undefined || linkTarget === '' || linkTarget.startsWith('#') || /^(?:https?|mailto):/.test(linkTarget)) {
      continue;
    }

    const encodedPath = linkTarget.split(/[?#]/, 1)[0];
    let localPath;
    try {
      localPath = decodeURIComponent(encodedPath);
    } catch (error) {
      errors.push(`${source}: invalid URL encoding in local link ${linkTarget}: ${getErrorMessage(error)}`);
      continue;
    }

    const targetPath = resolve(dirname(source), localPath);
    if (/^(?:[A-Za-z]:|[\\/])/.test(localPath)) {
      errors.push(`${source}: local link must be relative: ${linkTarget}`);
      continue;
    }
    const targetInfo = getPathInfo(targetPath, errors, `local link ${linkTarget}`);
    if (targetInfo !== undefined && targetInfo.isDirectory()) {
      errors.push(`${source}: local link points to a directory ${linkTarget}`);
    }
  }
};

const validateMarkdownDirectory = (directory, errors) => {
  const directoryInfo = getPathInfo(directory, errors, 'required directory');
  if (directoryInfo === undefined) {
    return;
  }
  if (directoryInfo.isSymbolicLink() || !directoryInfo.isDirectory()) {
    errors.push(`${directory}: required directory must be a regular directory`);
    return;
  }

  for (const source of getMarkdownFiles(directory, errors)) {
    const content = readText(source, errors);
    if (content !== undefined) {
      validateLinks(source, content, errors);
    }
  }
};

const getRoot = (argumentsList, errors) => {
  if (argumentsList.length > 1) {
    errors.push('expected zero or one plugin root argument');
    return undefined;
  }
  if (argumentsList.length === 1 && argumentsList[0] === '') {
    errors.push('plugin root argument must not be empty');
    return undefined;
  }

  const root = argumentsList[0] === undefined
    ? resolve(fileURLToPath(new URL('..', import.meta.url)))
    : resolve(argumentsList[0]);
  pluginRoot = root;
  const rootInfo = getPathInfo(root, errors, 'plugin root');
  if (rootInfo !== undefined && !rootInfo.isDirectory()) {
    errors.push(`${root}: plugin root must be a directory`);
    return undefined;
  }
  return rootInfo === undefined ? undefined : root;
};

export const verifyPlugin = (argumentsList = []) => {
  const errors = [];
  pluginRoot = undefined;
  const root = getRoot(argumentsList, errors);
  let skillCount = 0;

  if (root !== undefined) {
    const skillsRoot = validateManifest(root, errors);
    if (skillsRoot !== undefined) {
      skillCount = validateSkills(skillsRoot, errors);
      validateMarkdownDirectory(skillsRoot, errors);
    }
    validateMarkdownDirectory(join(root, 'references'), errors);
    for (const entry of getDirectoryEntries(root, errors).filter((entry) => entry.isFile() && entry.name.endsWith('.md'))) {
      const source = join(root, entry.name);
      const content = readText(source, errors);
      if (content !== undefined) validateLinks(source, content, errors);
    }
  }

  return { errors: errors.sort(compareNames), skillCount, root };
};

const run = () => {
  const { errors, skillCount, root } = verifyPlugin(process.argv.slice(2));

  if (errors.length > 0) {
    console.error('Plugin integrity check failed:');
    for (const error of errors.sort(compareNames)) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Plugin integrity check passed: ${skillCount} skills in ${root}`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) try {
  run();
} catch (error) {
  console.error('Plugin integrity check failed:');
  console.error(`- unexpected verifier error: ${getErrorMessage(error)}`);
  process.exitCode = 1;
}
