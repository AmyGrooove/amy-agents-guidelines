import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const LINK_PATTERN = /!?\[[^\]\r\n]*\]\(([^)\r\n]*)\)/g;

const getErrorMessage = (error) => error instanceof Error ? error.message : String(error);

const compareNames = (left, right) => left < right ? -1 : left > right ? 1 : 0;

const readText = (path, errors) => {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    errors.push(`${path}: cannot read: ${getErrorMessage(error)}`);
    return undefined;
  }
};

const getPathInfo = (path, errors, label) => {
  try {
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

  const manifestPaths = [];
  collectManifestPaths(manifest, manifestPaths);
  for (const relativePath of [...new Set(manifestPaths)].sort(compareNames)) {
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

  const trimmed = value.trim();
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
    const unquoted = trimmed.slice(1, -1);
    if (unquoted === '') {
      errors.push(`${path}: ${field} must use a non-empty single-line value`);
      return undefined;
    }
    return unquoted;
  }

  if (trimmed.includes('"') || trimmed.includes("'")) {
    errors.push(`${path}: ${field} must use an unquoted value or matching single or double quotes`);
    return undefined;
  }

  return trimmed;
};

const parseFrontmatter = (path, content, errors) => {
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
    const match = lines[index].match(/^(name|description):(?:[ \t]*(.*))?$/);
    if (match === null) {
      continue;
    }
    const [, field, value] = match;
    if (fields.has(field)) {
      errors.push(`${path}: duplicate frontmatter ${field}`);
      continue;
    }
    fields.set(field, parseFieldValue(path, field, value, errors));
  }

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
  for (const match of removeCode(content).matchAll(LINK_PATTERN)) {
    const linkTarget = parseLinkTarget(source, match[1], errors);
    if (linkTarget === undefined || linkTarget === '' || linkTarget.startsWith('#') || linkTarget.startsWith('//') || /^[A-Za-z][A-Za-z\d+.-]*:/.test(linkTarget)) {
      continue;
    }

    const encodedPath = linkTarget.split('#', 1)[0];
    let localPath;
    try {
      localPath = decodeURIComponent(encodedPath);
    } catch (error) {
      errors.push(`${source}: invalid URL encoding in local link ${linkTarget}: ${getErrorMessage(error)}`);
      continue;
    }

    const targetPath = resolve(dirname(source), localPath);
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
  const rootInfo = getPathInfo(root, errors, 'plugin root');
  if (rootInfo !== undefined && !rootInfo.isDirectory()) {
    errors.push(`${root}: plugin root must be a directory`);
    return undefined;
  }
  return rootInfo === undefined ? undefined : root;
};

const run = () => {
  const errors = [];
  const root = getRoot(process.argv.slice(2), errors);
  let skillCount = 0;

  if (root !== undefined) {
    const skillsRoot = validateManifest(root, errors);
    if (skillsRoot !== undefined) {
      skillCount = validateSkills(skillsRoot, errors);
      validateMarkdownDirectory(skillsRoot, errors);
    }
    validateMarkdownDirectory(join(root, 'references'), errors);
  }

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

try {
  run();
} catch (error) {
  console.error('Plugin integrity check failed:');
  console.error(`- unexpected verifier error: ${getErrorMessage(error)}`);
  process.exitCode = 1;
}
