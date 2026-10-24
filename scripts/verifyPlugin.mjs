import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const LINK_PATTERN = /!?\[[^\]\r\n]*\]\(([^)\r\n]*)\)/g;
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLUGIN_NAME_PATTERN = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const OPENAI_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const OPENAI_CATEGORIES = ['Productivity', 'Creativity', 'Developer Tools', 'Business & Operations', 'Data & Analytics', 'Communication', 'Education & Research', 'Security', 'Finance', 'Healthcare', 'Travel', 'Entertainment', 'Other'];
const LINE_BREAK_PATTERN = /[\r\n\u0085\u2028\u2029]/u;

export const containedPath = (root, target, { allowMissing = false } = {}) => {
  if (/^(?:[A-Za-z]:|[\\/]{2})/.test(target) && !isAbsolute(target)) throw new Error(`unsupported absolute path: ${target}`);
  const path = resolve(root, target);
  const part = relative(root, path);
  if (part === '..' || part.startsWith('..\\') || part.startsWith('../') || isAbsolute(part)) throw new Error(`path escapes plugin: ${target}`);
  let current = parse(path).root;
  for (const component of path.slice(current.length).split(/[\\/]/).filter(Boolean)) {
    current = join(current, component);
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error(`symbolic links and junctions are not supported: ${current}`);
    } catch (error) {
      if (!allowMissing || error.code !== 'ENOENT') throw error;
    }
  }
  return path;
};

const getErrorMessage = (error) => error instanceof Error ? error.message : String(error);

const compareNames = (left, right) => left < right ? -1 : left > right ? 1 : 0;

const readText = (root, path, errors) => {
  try {
    containedPath(root, path);
    return readFileSync(path, 'utf8');
  } catch (error) {
    errors.push(`${path}: cannot read: ${getErrorMessage(error)}`);
    return undefined;
  }
};

const getPathInfo = (root, path, errors, label) => {
  try {
    containedPath(root, path);
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

export const validatePortableManifest = (manifest, path, errors) => {
  if (manifest.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json') errors.push(`${path}: must declare the Agent Plugins 1.0.0 schema`);
  if (typeof manifest.name !== 'string' || manifest.name.length > 64 || !PLUGIN_NAME_PATTERN.test(manifest.name)) errors.push(`${path}: invalid plugin name`);
  const fields = ['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions'];
  for (const key of Object.keys(manifest)) if (!fields.includes(key)) errors.push(`${path}: unsupported manifest field ${key}`);
  for (const key of ['version', 'description', 'homepage', 'repository', 'license']) {
    if (manifest[key] !== undefined && typeof manifest[key] !== 'string') errors.push(`${path}: ${key} must be a string`);
  }
  if (manifest.author !== undefined) {
    if (!manifest.author || typeof manifest.author !== 'object' || Array.isArray(manifest.author)) errors.push(`${path}: author must be an object`);
    else for (const [key, value] of Object.entries(manifest.author)) {
      if (!['name', 'email', 'url'].includes(key) || typeof value !== 'string') errors.push(`${path}: invalid author.${key}`);
    }
  }
  if (manifest.keywords !== undefined && (!Array.isArray(manifest.keywords) || manifest.keywords.some((word) => typeof word !== 'string'))) errors.push(`${path}: keywords must be strings`);
  if (manifest.extensions !== undefined) {
    if (!manifest.extensions || typeof manifest.extensions !== 'object' || Array.isArray(manifest.extensions)) errors.push(`${path}: extensions must be an object`);
    else for (const [key, value] of Object.entries(manifest.extensions)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) errors.push(`${path}: extensions.${key} must be an object`);
    }
  }
};

const validateOpenAIManifest = (root, manifest, errors) => {
  const manifestPath = join(root, 'plugin.json');
  if (typeof manifest.name === 'string' && !OPENAI_NAME_PATTERN.test(manifest.name)) errors.push(`${manifestPath}: invalid OpenAI plugin name (ASCII letters, digits, underscores and hyphens; alphanumeric start)`);
  const openai = manifest.extensions?.['com.openai'];
  if (!openai || typeof openai !== 'object' || Array.isArray(openai)) errors.push(`${manifestPath}: extensions.com.openai must be an object`);
  const interfaceSettings = openai?.interface;

  if (typeof manifest.version !== 'string' || !VERSION_PATTERN.test(manifest.version)) {
    errors.push(`${manifestPath}: version must use MAJOR.MINOR.PATCH without leading zeroes`);
  }
  if (typeof manifest.description !== 'string' || !manifest.description.trim()) errors.push(`${manifestPath}: description must be non-empty`);
  if (!manifest.author || typeof manifest.author.name !== 'string' || !manifest.author.name.trim()) errors.push(`${manifestPath}: author must have a non-empty name`);
  if (manifest.keywords !== undefined && (!Array.isArray(manifest.keywords) || new Set(manifest.keywords).size !== manifest.keywords.length || manifest.keywords.some((word) => typeof word !== 'string' || !word.trim()))) errors.push(`${manifestPath}: keywords must be unique non-empty strings`);
  if (interfaceSettings === undefined || interfaceSettings === null || Array.isArray(interfaceSettings) || typeof interfaceSettings !== 'object') errors.push(`${manifestPath}: extensions.com.openai.interface must be an object`);
  if (interfaceSettings && typeof interfaceSettings === 'object' && !Array.isArray(interfaceSettings)) {
    for (const [key, limit] of Object.entries({ displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80 })) {
      const value = interfaceSettings[key];
      if (typeof value !== 'string' || !value.trim() || [...value].length > limit) errors.push(`${manifestPath}: interface.${key} must contain 1-${limit} characters`);
      if (typeof value === 'string' && key !== 'longDescription' && LINE_BREAK_PATTERN.test(value)) errors.push(`${manifestPath}: interface.${key} must be a single-line string`);
    }
    if (!OPENAI_CATEGORIES.includes(interfaceSettings.category)) errors.push(`${manifestPath}: interface.category must be a supported OpenAI category`);
    const capabilities = interfaceSettings.capabilities;
    if (capabilities !== undefined && (!Array.isArray(capabilities) || capabilities.length > 20 || capabilities.some((value) => typeof value !== 'string' || !value.trim() || [...value].length > 120 || LINE_BREAK_PATTERN.test(value)))) errors.push(`${manifestPath}: invalid interface.capabilities`);
    const prompts = interfaceSettings.defaultPrompt;
    if (prompts !== undefined) {
      const values = typeof prompts === 'string' ? [prompts] : prompts;
      if (!Array.isArray(values) || values.length > 3 || values.some((value) => typeof value !== 'string' || !value.trim() || [...value].length > 128 || LINE_BREAK_PATTERN.test(value) || /(^|\s)@[\p{L}\p{N}_-]+/u.test(value)) || new Set(values.map((value) => value.normalize('NFKC').trim().replace(/\s+/gu, ' '))).size !== values.length) errors.push(`${manifestPath}: invalid interface.defaultPrompt`);
    }
    for (const key of ['brandColor', 'brandColorDark']) if (interfaceSettings[key] !== undefined && (typeof interfaceSettings[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(interfaceSettings[key]))) errors.push(`${manifestPath}: invalid interface.${key}`);
  }
  for (const key of ['composerIcon', 'logo', 'logoDark']) {
    const value = interfaceSettings?.[key];
    if (value !== undefined && (typeof value !== 'string' || !value.startsWith('./'))) errors.push(`${manifestPath}: ${key} must be a relative plugin path`);
    else if (value !== undefined) {
      const info = getPathInfo(root, resolve(root, value), errors, key);
      if (info && !info.isFile()) errors.push(`${manifestPath}: ${key} must point to a regular file`);
    }
  }
};

const validateManifest = (root, errors) => {
  const manifestPath = join(root, 'plugin.json');
  const text = readText(root, manifestPath, errors);
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

  validatePortableManifest(manifest, manifestPath, errors);
  validateOpenAIManifest(root, manifest, errors);

  const manifestPaths = [];
  collectManifestPaths(manifest, manifestPaths);
  for (const relativePath of [...new Set(manifestPaths)].sort(compareNames)) {
    if (relativePath.includes('\\') || relativePath.split('/').includes('..')) errors.push(`${manifestPath}: declared paths must use forward slashes and contain no .. components: ${relativePath}`);
    getPathInfo(root, resolve(root, relativePath), errors, `declared path ${relativePath}`);
  }

  const skillsRoot = join(root, 'skills');
  const skillsInfo = getPathInfo(root, skillsRoot, errors, 'skills directory');
  if (skillsInfo !== undefined && !skillsInfo.isDirectory()) {
    errors.push(`${skillsRoot}: skills path must be a directory`);
    return undefined;
  }

  return skillsInfo === undefined ? undefined : { skillsRoot, name: manifest.name };
};

const parseFieldValue = (path, field, value, errors) => {
  if (value === undefined || value.trim() === '') {
    errors.push(`${path}: ${field} must use a non-empty single-line value`);
    return undefined;
  }

  const raw = value.trim();
  const trimmed = /^["']/.test(raw) ? (raw.match(/^((?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'))(?:[ \t]+#.*)?$/)?.[1] ?? raw) : raw.replace(/(?:^|\s+)#.*$/, '').trim();
  if (!trimmed || /^(?:null|true|false|~|[-+]?(?:0[xo][0-9a-f]+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?|\.inf|\.nan))$/i.test(trimmed) || /^[&*!%@`]|^[-?:]\s/.test(trimmed) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(trimmed)) {
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
  if (typeof name === 'string' && (name.length > 64 || !SKILL_NAME_PATTERN.test(name))) errors.push(`${path}: invalid skill name (1-64 lowercase letters, digits, single hyphens)`);
  if (typeof description === 'string' && (!description.trim() || [...description].length > 1024)) errors.push(`${path}: invalid description (1-1024 characters)`);
  if (fields.has('compatibility') && (typeof fields.get('compatibility') !== 'string' || !fields.get('compatibility').trim() || [...fields.get('compatibility')].length > 500)) errors.push(`${path}: compatibility must contain 1-500 characters`);
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

const getDirectoryEntries = (root, directory, errors) => {
  try {
    containedPath(root, directory);
    return readdirSync(directory, { withFileTypes: true }).sort((left, right) => compareNames(left.name, right.name));
  } catch (error) {
    errors.push(`${directory}: cannot read directory: ${getErrorMessage(error)}`);
    return [];
  }
};

const validateSkillAgent = (root, skillRoot, errors) => {
  const explicitOnly = ['codify-rule', 'route-project-changes'].includes(parse(skillRoot).base);
  const path = join(skillRoot, 'agents', 'openai.yaml');
  const agents = getDirectoryEntries(root, skillRoot, errors).find((entry) => entry.name === 'agents');
  if (!agents) {
    if (explicitOnly) errors.push(`${path}: explicit-only skill requires policy.allow_implicit_invocation: false`);
    return;
  }
  const agentsInfo = getPathInfo(root, join(skillRoot, 'agents'), errors, 'agents directory');
  if (!agentsInfo || !agentsInfo.isDirectory()) {
    if (agentsInfo) errors.push(`${path}: agents must be a directory`);
    return;
  }
  if (!getDirectoryEntries(root, join(skillRoot, 'agents'), errors).some((entry) => entry.name === 'openai.yaml')) {
    if (explicitOnly) errors.push(`${path}: explicit-only skill requires policy.allow_implicit_invocation: false`);
    return;
  }
  const info = getPathInfo(root, path, errors, 'skill agent metadata');
  if (!info) return;
  if (!info.isFile()) {
    errors.push(`${path}: skill agent metadata must be a regular file`);
    return;
  }
  let content;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
  } catch (error) {
    errors.push(`${path}: cannot read UTF-8 skill agent metadata: ${getErrorMessage(error)}`);
    return;
  }
  const sections = new Map();
  let section;
  for (const [index, line] of content.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    if (/^\s*(?:#.*)?$/.test(line)) continue;
    const heading = line.match(/^([a-z_]+):\s*(?:#.*)?$/);
    if (heading) {
      section = heading[1];
      if (!['interface', 'policy'].includes(section)) errors.push(`${path}: unsupported YAML section ${section}; verifier supports interface and policy mappings`);
      if (sections.has(section)) errors.push(`${path}: duplicate YAML section ${section}`);
      sections.set(section, sections.get(section) || new Map());
      continue;
    }
    const field = line.match(/^  ([a-z_]+):(?:[ \t]+(.*))?$/);
    if (!section || !field) {
      errors.push(`${path}: invalid or unsupported YAML mapping at line ${index + 1}`);
      continue;
    }
    const [, key, raw] = field;
    const fields = sections.get(section);
    if (fields.has(key)) {
      errors.push(`${path}: duplicate ${section}.${key}`);
      continue;
    }
    if (section === 'policy') {
      if (key !== 'allow_implicit_invocation') errors.push(`${path}: unsupported policy field ${key}`);
      const value = raw?.replace(/\s+#.*$/, '').trim();
      if (value !== 'true' && value !== 'false') errors.push(`${path}: policy.${key} must be a YAML boolean`);
      fields.set(key, value === 'true' ? true : value === 'false' ? false : undefined);
    } else {
      if (!['display_name', 'short_description', 'default_prompt', 'brand_color', 'icon_small', 'icon_large'].includes(key)) errors.push(`${path}: unsupported interface field ${key}`);
      const value = parseFieldValue(path, `${section}.${key}`, raw, errors);
      if (typeof value === 'string' && (!value.trim() || /[\u0000-\u001f\u007f]/.test(value))) errors.push(`${path}: interface.${key} must be a non-empty single-line string`);
      fields.set(key, value);
    }
  }
  if (sections.has('policy') && sections.get('policy').size === 0) errors.push(`${path}: policy must be a non-empty YAML mapping`);
  const settings = sections.get('interface');
  if (!settings) errors.push(`${path}: interface must be a YAML mapping`);
  for (const key of ['display_name', 'short_description']) {
    if (!settings?.has(key)) errors.push(`${path}: missing interface.${key}`);
  }
  const color = settings?.get('brand_color');
  if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) errors.push(`${path}: invalid interface.brand_color`);
  for (const key of ['icon_small', 'icon_large']) {
    const value = settings?.get(key);
    if (value === undefined) continue;
    if (value !== value.trim() || /^(?:[A-Za-z][A-Za-z0-9+.-]*:|[\\/])/.test(value) || value.includes('\\') || value.split('/').includes('..')) {
      errors.push(`${path}: interface.${key} must be a relative skill file path without traversal`);
      continue;
    }
    const asset = getPathInfo(root, resolve(skillRoot, value), errors, `interface.${key}`);
    if (asset && !asset.isFile()) errors.push(`${path}: interface.${key} must point to a regular file`);
  }
  if (explicitOnly && sections.get('policy')?.get('allow_implicit_invocation') !== false) errors.push(`${path}: explicit-only skill requires policy.allow_implicit_invocation: false`);
};

const validateSkills = (root, skillsRoot, pluginName, errors) => {
  const skillNames = new Map();
  let skillCount = 0;

  for (const entry of getDirectoryEntries(root, skillsRoot, errors)) {
    const entryPath = join(skillsRoot, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`${entryPath}: symbolic links and junctions are not supported`);
      continue;
    }
    if (!entry.isDirectory()) {
      continue;
    }

    skillCount += 1;
    validateSkillAgent(root, entryPath, errors);
    const skillPath = join(entryPath, 'SKILL.md');
    const skillInfo = getPathInfo(root, skillPath, errors, 'SKILL.md');
    if (skillInfo === undefined) {
      continue;
    }
    if (skillInfo.isSymbolicLink() || !skillInfo.isFile()) {
      errors.push(`${skillPath}: SKILL.md must be a regular file`);
      continue;
    }

    const content = readText(root, skillPath, errors);
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

    if (typeof pluginName === 'string' && `${pluginName}:${frontmatter.name}`.length > 64) errors.push(`${skillPath}: OpenAI skill identity plugin:skill must contain at most 64 characters`);

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

const getMarkdownFiles = (root, directory, errors) => {
  const files = [];
  const walk = (currentDirectory) => {
    for (const entry of getDirectoryEntries(root, currentDirectory, errors)) {
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

const validateLinks = (root, source, content, errors) => {
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
    const targetInfo = getPathInfo(root, targetPath, errors, `local link ${linkTarget}`);
    if (targetInfo !== undefined && targetInfo.isDirectory()) {
      errors.push(`${source}: local link points to a directory ${linkTarget}`);
    }
  }
};

const validateMarkdownDirectory = (root, directory, errors) => {
  const directoryInfo = getPathInfo(root, directory, errors, 'required directory');
  if (directoryInfo === undefined) {
    return;
  }
  if (directoryInfo.isSymbolicLink() || !directoryInfo.isDirectory()) {
    errors.push(`${directory}: required directory must be a regular directory`);
    return;
  }

  for (const source of getMarkdownFiles(root, directory, errors)) {
    const content = readText(root, source, errors);
    if (content !== undefined) {
      validateLinks(root, source, content, errors);
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
  const rootInfo = getPathInfo(root, root, errors, 'plugin root');
  if (rootInfo !== undefined && !rootInfo.isDirectory()) {
    errors.push(`${root}: plugin root must be a directory`);
    return undefined;
  }
  return rootInfo === undefined ? undefined : root;
};

export const validateSkillsReference = (root, spawn = spawnSync) => {
  const errors = [];
  let checked = 0;
  for (const entry of readdirSync(containedPath(root, 'skills'), { withFileTypes: true }).filter(x => x.isDirectory()).sort((a, b) => compareNames(a.name, b.name))) {
    const path = containedPath(root, join('skills', entry.name));
    const result = spawn('skills-ref', ['validate', path], { shell: false, encoding: 'utf8', timeout: 30000, windowsHide: true });
    if (result.error?.code === 'ENOENT' && !checked) return { status: 'skipped', reason: 'skills-ref unavailable; no dependencies were installed', checked };
    checked += 1;
    if (result.error || result.status !== 0) errors.push(path + ': skills-ref failed: ' + (result.error?.message || result.stderr || result.stdout || result.status));
  }
  return { status: errors.length ? 'fail' : 'pass', checked, errors };
};

export const verifyPlugin = (argumentsList = [], options = {}) => {
  const errors = [];
  const root = getRoot(argumentsList, errors);
  let skillCount = 0;

  if (root !== undefined) {
    const manifest = validateManifest(root, errors);
    if (manifest !== undefined) {
      skillCount = validateSkills(root, manifest.skillsRoot, manifest.name, errors);
      validateMarkdownDirectory(root, manifest.skillsRoot, errors);
    }
    validateMarkdownDirectory(root, join(root, 'references'), errors);
    for (const entry of getDirectoryEntries(root, root, errors).filter((entry) => entry.isFile() && entry.name.endsWith('.md'))) {
      const source = join(root, entry.name);
      const content = readText(root, source, errors);
      if (content !== undefined) validateLinks(root, source, content, errors);
    }
  }

  const skillsRef = options.skillsRef && root && !errors.length
    ? validateSkillsReference(root, options.spawn || spawnSync)
    : { status: 'skipped', reason: options.skillsRef ? 'Local validation failed' : 'Not requested' };
  if (skillsRef.status === 'fail') errors.push(...skillsRef.errors);
  return { errors: errors.sort(compareNames), skillCount, root, skillsRef };
};

const run = () => {
  const args = process.argv.slice(2);
  const required = args.includes('--skills-ref');
  const { errors, skillCount, root, skillsRef } = verifyPlugin(args.filter(x => x !== '--skills-ref'), { skillsRef: true });
  console.log('skills-ref: ' + skillsRef.status + (skillsRef.reason ? ' (' + skillsRef.reason + ')' : ''));
  if (required && skillsRef.status === 'skipped') errors.push('Required skills-ref validation was skipped');

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
