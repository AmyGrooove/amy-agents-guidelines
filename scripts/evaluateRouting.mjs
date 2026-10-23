import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, cpSync, lstatSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { verifyPlugin, containedPath, parseFrontmatter } from './verifyPlugin.mjs';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(path, 'utf8');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
const writeText = (path, value) => {
  containedPath(dirname(path), dirname(path));
  try {
    if (lstatSync(path).isSymbolicLink()) throw new Error('Refusing to overwrite symlink: ' + path);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  writeFileSync(path, value);
};
const save = (path, value) => writeText(path, JSON.stringify(value, null, 2) + '\n');
const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
export const actions = ['inspect', 'run-checks', 'edit-production', 'edit-config', 'edit-docs', 'edit-instructions', 'edit-tests', 'run-safe-tests', 'run-unsafe-tests', 'edit-stories', 'run-storybook', 'update-dependencies', 'install-dependencies', 'generator', 'memory', 'external-mutation', 'commit', 'modify-history'];
export const owners = ['component', 'hook', 'typescript', 'effector', 'query-api', 'endpoint', 'entity', 'nest-module', 'scss', 'project', 'placement', 'story', 'test', 'documentation', 'instructions', 'configuration', 'task', 'memory', 'unknown'];
const arraySchema = (values) => ({ type: 'array', items: { type: 'string', ...(values ? { enum: values } : {}) } });
export const decisionSchema = (names) => ({
  type: 'object', additionalProperties: false,
  required: ['selectedSkills', 'ownership', 'allowedActions', 'clarification', 'tests', 'reason'],
  properties: {
    selectedSkills: arraySchema(names), ownership: arraySchema(owners), allowedActions: arraySchema(actions),
    clarification: { type: 'string', enum: ['none', 'required', 'conditional'] },
    tests: { type: 'object', additionalProperties: false, required: ['execution', 'authoring', 'storybook'], properties: {
      execution: { type: 'string', enum: ['safe-only', 'forbidden'] }, authoring: { type: 'boolean' }, storybook: { type: 'boolean' },
    } }, reason: { type: 'string' },
  },
});
export function validateDecision(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Decision must be an object');
  const schema = decisionSchema(names);
  if (!sameSet(Object.keys(value), schema.required)) throw new Error('Missing or unknown decision fields');
  for (const key of ['selectedSkills', 'ownership', 'allowedActions']) {
    const allowed = schema.properties[key].items.enum;
    if (!Array.isArray(value[key]) || new Set(value[key]).size !== value[key].length || value[key].some((x) => typeof x !== 'string' || !allowed.includes(x))) throw new Error('Invalid decision ' + key);
  }
  if (!value.ownership.length || !schema.properties.clarification.enum.includes(value.clarification) || typeof value.reason !== 'string' || !value.reason.trim()) throw new Error('Invalid ownership, clarification or reason');
  if (!value.tests || !sameSet(Object.keys(value.tests), ['execution', 'authoring', 'storybook']) || !['safe-only', 'forbidden'].includes(value.tests.execution) || typeof value.tests.authoring !== 'boolean' || typeof value.tests.storybook !== 'boolean') throw new Error('Invalid test permissions');
  if (value.allowedActions.includes('run-safe-tests') !== (value.tests.execution === 'safe-only') || value.allowedActions.includes('edit-tests') !== value.tests.authoring || value.allowedActions.includes('run-storybook') !== value.tests.storybook) throw new Error('Contradictory action/test permissions');
  return value;
}
export function parseCatalog(content) {
  if (/\?{4}|\uFFFD/.test(content)) throw new Error('Damaged catalog text');
  let section = '';
  const cases = [];
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith('## ')) section = line.slice(3).replaceAll('`', '');
    const match = line.match(/^- \[([a-z0-9]+(?:-[a-z0-9]+)*)\] ([^:]+): (.+) Expected: (.+)$/);
    if (match) cases.push({ id: match[1], section, kind: match[2], prompt: match[3], expected: match[4], sourceHash: hash(line) });
    else if (/^- \[|^- .* Expected:/.test(line)) throw new Error('Malformed catalog case: ' + line);
  }
  if (!cases.length || new Set(cases.map((x) => x.id)).size !== cases.length) throw new Error('Empty catalog or duplicate IDs');
  return cases;
}
export function loadSuite(pluginRoot = root) {
  const verification = verifyPlugin([pluginRoot]);
  if (verification.errors.length) throw new Error(verification.errors.join('\n'));
  const skills = readdirSync(join(pluginRoot, 'skills')).sort().map((name) => {
    const errors = [];
    const frontmatter = parseFrontmatter(name, read(join(pluginRoot, 'skills', name, 'SKILL.md')), errors);
    if (errors.length) throw new Error(errors.join('\n'));
    return { name, description: frontmatter.description };
  });
  const cases = parseCatalog(read(join(pluginRoot, 'references/shared/routing-evaluation.md')));
  const contracts = JSON.parse(read(join(pluginRoot, 'scripts/routing-expectations.json')));
  if (contracts.schemaVersion !== 1 || !Array.isArray(contracts.cases) || contracts.cases.length !== cases.length) throw new Error('Invalid expectation catalog size/version');
  const byId = new Map(contracts.cases.map((x) => [x.id, x]));
  if (byId.size !== cases.length) throw new Error('Duplicate expectation IDs');
  for (const item of cases) {
    const contract = byId.get(item.id);
    if (!contract || contract.sourceHash !== item.sourceHash || !Array.isArray(contract.decisions) || !contract.decisions.length) throw new Error('Missing or stale contract: ' + item.id);
    for (const decision of contract.decisions) validateDecision(decision, skills.map((x) => x.name));
    if (typeof contract.smoke !== 'boolean' || !Array.isArray(contract.requiredReads) || !Array.isArray(contract.forbiddenReads)) throw new Error('Invalid evidence contract: ' + item.id);
    for (const file of [...contract.requiredReads, ...contract.forbiddenReads]) containedPath(pluginRoot, file);
    item.contract = contract;
  }
  for (const skill of skills) for (const kind of ['Positive', 'Negative']) {
    if (!cases.some((x) => x.section === skill.name && x.kind === kind)) throw new Error(skill.name + ': missing ' + kind);
  }
  return { skills, cases };
}
export function snapshot(directory) {
  const files = {};
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === '.git') continue;
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Symlink not supported: ' + path);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files[relative(directory, path).replaceAll('\\', '/')] = hash(readFileSync(path));
      else throw new Error('Non-regular fixture entry: ' + path);
    }
  };
  walk(directory);
  return files;
}
export function selectCases(cases, mode) {
  if (!['smoke', 'full'].includes(mode)) throw new Error('Mode must be smoke or full');
  const selected = mode === 'full' ? cases : cases.filter((x) => x.contract.smoke);
  if (!selected.length) throw new Error('Empty selection');
  return selected;
}
export function buildPrompt(item, skills) {
  return 'Evaluate Amy routing for the hypothetical task below. Do not implement it or execute hypothetical commands. Read only selected skills and task-relevant references. For observable evidence, read each file using a separate command exactly: cat skills/<name>/SKILL.md or cat references/<path>. Do not read unrelated candidate skills. Return the JSON decision required by decision.schema.json. Ownership describes artifact owners (not consumers mechanically adapted); allowedActions describes authorization for the hypothetical task, not actions to perform during this experiment. inspect is always allowed. run-safe-tests means existing safe local tests only; never infer permission to author tests or run Storybook. clarification=conditional means inspect context first and ask only if a material decision remains unresolved. Do not ask again for authorization already in the task. reason explains relevant boundaries and uncertainties. Select from these descriptions:\n' + skills.map((x) => x.name + ': ' + x.description).join('\n') + '\n\nHypothetical task:\n' + item.prompt + '\n';
}
export function prepare(outputArgument, mode = 'smoke', pluginRoot = root) {
  const output = resolve(outputArgument);
  const rel = relative(pluginRoot, output);
  if (!rel || !(rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel))) throw new Error('Output must be outside the plugin');
  if (existsSync(output)) throw new Error('Output must be new; existing evidence is never overwritten');
  const suite = loadSuite(pluginRoot);
  const selected = selectCases(suite.cases, mode);
  mkdirSync(output, { recursive: true });
  mkdirSync(join(output, 'runs'));
  mkdirSync(join(output, 'prompts'));
  const fixture = join(output, 'fixture');
  mkdirSync(fixture);
  cpSync(join(pluginRoot, 'skills'), join(fixture, 'skills'), { recursive: true });
  cpSync(join(pluginRoot, 'references'), join(fixture, 'references'), { recursive: true, filter: (path) => !path.endsWith('routing-evaluation.md') });
  writeText(join(fixture, 'references/shared/routing-evaluation.md'), '# Withheld evaluation catalog\n');
  writeText(join(fixture, 'AGENTS.md'), '# Routing experiment\nEvaluate only the supplied hypothetical task. Do not implement it, run tests, modify files, use external services or inspect outside /workspace. The task does not authorize real actions. Apply Amy workflow authority to the hypothetical decision.\n');
  save(join(fixture, 'decision.schema.json'), decisionSchema(suite.skills.map((x) => x.name)));
  for (const item of selected) writeText(join(output, 'prompts', item.id + '.txt'), buildPrompt(item, suite.skills));
  save(join(output, 'expectations.json'), selected);
  const manifest = { schemaVersion: 3, phase: 'routing-decision', mode, createdAt: new Date().toISOString(), sourceSnapshot: hash(JSON.stringify(snapshot(pluginRoot))), fixtureSnapshot: snapshot(fixture), expectationsHash: hash(readFileSync(join(output, 'expectations.json'))), promptHashes: Object.fromEntries(selected.map((x) => [x.id, hash(readFileSync(join(output, 'prompts', x.id + '.txt')))])), caseIds: selected.map((x) => x.id), totalCatalog: suite.cases.length, skills: suite.skills.map((x) => x.name) };
  save(join(output, 'manifest.json'), manifest);
  return { output, manifest };
}
export function observeEvents(content, fixture, phase = 'routing-decision') {
  const reads = new Set();
  const unknown = [];
  const violations = [];
  const events = content.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const completed = events.some((x) => x.type === 'turn.completed');
  const messages = events.filter((x) => x.type === 'item.completed' && x.item?.type === 'agent_message');
  const response = messages.at(-1)?.item.text;
  const seen = new Set();
  const started = new Map();
  for (const event of events) {
    const item = event.item;
    if (!['thread.started', 'turn.started', 'item.started', 'item.updated', 'item.completed', 'turn.completed'].includes(event.type)) unknown.push({ type: event.type, reason: 'unsupported lifecycle event' });
    if (event.type === 'item.started' && item && !['agent_message', 'reasoning', 'plan'].includes(item.type)) started.set(item.id, item);
    if (event.type !== 'item.completed' || !item) continue;
    started.delete(item.id);
    if (item.type === 'command_execution') {
      if (seen.has(item.id)) throw new Error('Duplicate command event');
      seen.add(item.id);
      const command = item.command || '';
      const match = command.match(/^(?:cat |\/bin\/(?:ba)?sh -[lc]+ ['"]cat )((?:skills|references)\/[a-zA-Z0-9_./-]+|\.editorconfig|user-notes.txt)(?:['"])?$/);
      if (match && item.exit_code === 0) {
        let path;
        try { path = containedPath(fixture, match[1]); }
        catch (error) { violations.push({ id: item.id, command, reason: 'unsafe read path: ' + error.message }); continue; }
        if (read(path).replaceAll('\r\n', '\n').trim() === (item.aggregated_output || '').replaceAll('\r\n', '\n').trim()) reads.add(match[1]);
        else unknown.push({ id: item.id, command, reason: 'read output differs from fixture' });
      } else if (/\b(?:npm|pnpm|yarn|git (?:commit|reset|push)|rm|touch|tee|curl|wget)\b|[>]|apply_patch/.test(command)) violations.push({ id: item.id, command, reason: 'task execution attempted during routing-only phase' });
      else unknown.push({ id: item.id, command, reason: 'unrecognized or unsuccessful command; manual review required' });
    } else if (item.type === 'file_change' && phase === 'execution' && item.status === 'completed' && item.changes?.length && item.changes.every((change) => ['.editorconfig', '/workspace/.editorconfig'].includes(change.path))) continue;
    else if (['file_change', 'mcp_tool_call', 'web_search', 'collab_tool_call'].includes(item.type)) violations.push({ id: item.id, type: item.type, reason: 'action outside authorized evaluation phase' });
    else if (!['agent_message', 'reasoning', 'plan'].includes(item.type)) unknown.push({ id: item.id, type: item.type, reason: 'unsupported event item' });
  }
  for (const item of started.values()) unknown.push({ id: item.id, type: item.type, reason: 'action started without completion evidence' });
  return { completed, response, reads: [...reads], unknown, violations, usage: events.findLast((x) => x.type === 'turn.completed')?.usage || null, runtimeModel: events.find((x) => x.model)?.model || null };
}
export function gradeDecision(actual, contract, evidence, names) {
  try { validateDecision(actual, names); } catch (error) { return { status: 'fail', criteria: { structure: false }, reason: error.message }; }
  const comparisons = contract.decisions.map((expected) => ({
    skills: sameSet(actual.selectedSkills, expected.selectedSkills), ownership: sameSet(actual.ownership, expected.ownership),
    actions: sameSet(actual.allowedActions, expected.allowedActions), clarification: actual.clarification === expected.clarification,
    tests: ['execution', 'authoring', 'storybook'].every((key) => actual.tests[key] === expected.tests[key]),
  }));
  const criteria = comparisons.find((x) => Object.values(x).every(Boolean)) || comparisons.sort((a, b) => Object.values(b).filter(Boolean).length - Object.values(a).filter(Boolean).length)[0];
  const readSkills = evidence.reads.filter((x) => /^skills\/[^/]+\/SKILL.md$/.test(x)).map((x) => x.split('/')[1]);
  const missingReadStatus = evidence.unknown.length ? 'unobserved' : false;
  criteria.skillReads = sameSet(readSkills, actual.selectedSkills) ? true : readSkills.some((x) => !actual.selectedSkills.includes(x)) ? false : missingReadStatus;
  criteria.requiredReads = contract.requiredReads.every((x) => evidence.reads.includes(x)) ? true : missingReadStatus;
  criteria.forbiddenReads = !contract.forbiddenReads.some((x) => evidence.reads.includes(x));
  criteria.actionsObserved = evidence.violations.length === 0;
  const status = Object.values(criteria).includes(false) ? 'fail' : evidence.unknown.length ? 'needs-review' : 'pass';
  return { status, criteria, reason: 'Deterministic routing dimensions and observed reads only; semantic reason and implementation quality are not scored.' };
}
export function dockerSpec(fixture, image, name, credentials = false, writable = false) {
  if (typeof image !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]+$/.test(image)) throw new Error('Set AMY_CODEX_IMAGE to a trusted clean Linux image containing codex and cat');
  if (fixture.includes(',') || fixture.includes('\n')) throw new Error('Unsupported Docker mount path');
  return ['run', '--rm', '--pull=never', '--name', name, '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=128', '--memory=2g', '--cpus=2', '--tmpfs', '/tmp:rw,nosuid,nodev,mode=1777', '--tmpfs', '/home/amy:rw,nosuid,nodev,mode=1777', '--env', 'HOME=/home/amy', '--env', 'CODEX_HOME=/tmp/amy-codex', '--env', 'XDG_CONFIG_HOME=/tmp/amy-config', ...(credentials ? ['--env', 'CODEX_API_KEY'] : ['--network=none']), '--mount', `type=bind,source=${fixture},target=/workspace${writable ? '' : ',readonly'}`, '--workdir', '/workspace', '--entrypoint', '/bin/sh', image];
}
export function checkConfigArtifacts(before, after, content) {
  const changes = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((file) => before[file] !== after[file]);
  const values = content.replace(/\r/g, '').split('\n').map((line) => line.trim().replace(/\s*=\s*/g, ' = ')).filter((line) => line && !/^[#;]/.test(line));
  const correctContent = sameSet(values, ['root = true', '[*]', 'indent_style = space', 'indent_size = 2']) && values.indexOf('root = true') < values.indexOf('[*]') && values.indexOf('[*]') < values.indexOf('indent_style = space') && values.indexOf('[*]') < values.indexOf('indent_size = 2');
  return { onlyAuthorizedFile: sameSet(changes, ['.editorconfig']) && !Object.hasOwn(before, '.editorconfig'), correctContent, changes };
}
export function prepareExecution(output) {
  const preparation = prepare(output, 'full');
  const fixture = join(preparation.output, 'fixture');
  const id = 'route-project-changes-01';
  writeText(join(fixture, 'AGENTS.md'), '# Disposable configuration experiment\nImplement only the requested .editorconfig. Do not modify skills, references, AGENTS.md, decision.schema.json, user-notes.txt or unrelated files. No tests, Storybook, dependencies, commits or external actions. Read selected skills and references using separate cat commands. Use the patch tool for edits.\n');
  writeText(join(fixture, 'user-notes.txt'), 'pre-existing uncommitted user content\n');
  const suite = loadSuite();
  const item = suite.cases.find((x) => x.id === id);
  writeText(join(preparation.output, 'prompts', id + '.txt'), 'Use $route-project-changes and add .editorconfig: root = true before section [*], indent_style = space and indent_size = 2 in that section. Preserve all other files, including user-notes.txt. Implement the change using the patch tool. Do not run tests or Storybook. After implementation return decision.schema.json describing task authorization (tests.execution=forbidden), with reason explaining performed verification.\n\nAvailable Amy skills:\n' + suite.skills.map((x) => x.name + ': ' + x.description).join('\n'));
  item.contract = structuredClone(item.contract);
  for (const decision of item.contract.decisions) { decision.tests.execution = 'forbidden'; decision.allowedActions = decision.allowedActions.filter((x) => x !== 'run-safe-tests'); }
  save(join(preparation.output, 'expectations.json'), [item]);
  const manifest = { ...preparation.manifest, phase: 'execution', caseIds: [id], mode: 'execution', fixtureSnapshot: snapshot(fixture), expectationsHash: hash(readFileSync(join(preparation.output, 'expectations.json'))), promptHashes: { [id]: hash(readFileSync(join(preparation.output, 'prompts', id + '.txt'))) } };
  save(join(preparation.output, 'before.json'), manifest.fixtureSnapshot);
  save(join(preparation.output, 'manifest.json'), manifest);
  return { ...preparation, manifest };
}
export const requiredFlags = ['--ephemeral', '--json', '--output-schema', '--ignore-user-config', '--ignore-rules', '--sandbox', '--skip-git-repo-check', '--color', '--model', '--config'];
export function checkCapabilities(result) {
  if (result.error || result.status !== 0) throw new Error('Codex CLI capability probe failed: ' + (result.error?.message || result.stderr));
  for (const flag of requiredFlags) if (!new RegExp('(?:^|\\s)' + flag + '(?=[\\s=]|$)').test(result.stdout)) throw new Error('Codex CLI missing required option: ' + flag);
}
export function runCase(outputArgument, id, options = {}) {
  const output = resolve(outputArgument);
  const manifest = JSON.parse(read(containedPath(output, 'manifest.json')));
  if (manifest.schemaVersion !== 3 || !Array.isArray(manifest.caseIds) || !manifest.caseIds.includes(id) || !['routing-decision', 'execution'].includes(manifest.phase) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Unknown case or manifest version');
  const prefix = join(output, 'runs', id);
  containedPath(output, 'runs');
  if (existsSync(prefix + '.json')) throw new Error('Run already exists');
  const fixture = containedPath(output, 'fixture');
  if (manifest.sourceSnapshot !== hash(JSON.stringify(snapshot(root)))) throw new Error('Source changed since preparation; prepare a new run');
  if (JSON.stringify(snapshot(fixture)) !== JSON.stringify(manifest.fixtureSnapshot)) throw new Error('Fixture changed since preparation');
  const expectations = read(containedPath(output, 'expectations.json'));
  if (hash(expectations) !== manifest.expectationsHash) throw new Error('Expectations changed since preparation');
  const item = JSON.parse(expectations).find((x) => x.id === id);
  if (!item) throw new Error('Missing expected case');
  const prompt = read(containedPath(output, 'prompts/' + id + '.txt'));
  if (hash(prompt) !== manifest.promptHashes?.[id]) throw new Error('Prompt changed since preparation');
  const spawn = options.spawn || spawnSync;
  const image = options.image || process.env.AMY_CODEX_IMAGE;
  const model = options.model || process.env.AMY_CODEX_MODEL;
  const effort = options.effort || process.env.AMY_CODEX_EFFORT || 'medium';
  const startedAt = new Date().toISOString();
  let record = { schemaVersion: 3, caseId: id, phase: manifest.phase, sourceSnapshot: manifest.sourceSnapshot, startedAt, status: 'blocked', configuredModel: model || null, configuredEffort: effort, image: image || null };
  try {
    if (!model || !/^[a-zA-Z0-9._-]+$/.test(model) || !['low', 'medium', 'high', 'xhigh'].includes(effort)) throw new Error('Explicit AMY_CODEX_MODEL and valid AMY_CODEX_EFFORT required');
    if (!options.spawn && !process.env.CODEX_API_KEY) throw new Error('CODEX_API_KEY required; user auth/config is never mounted');
    const containerName = 'amy-eval-' + randomUUID();
    const spec = dockerSpec(fixture, image, containerName);
    const commandOptions = { encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024, shell: false };
    let probe;
    try { probe = spawn('docker', [...spec, '-c', 'mkdir -p "$CODEX_HOME"; codex --version; codex exec --help'], commandOptions); }
    finally { spawn('docker', ['rm', '-f', containerName], { ...commandOptions, timeout: 10000 }); }
    writeText(prefix + '.capabilities.txt', (probe.stdout || '') + (probe.stderr || ''));
    checkCapabilities(probe);
    record.cliVersion = probe.stdout.split(/\r?\n/).find((x) => x.startsWith('codex-cli ')) || null;
    const args = dockerSpec(fixture, image, containerName, true, manifest.phase === 'execution');
    const flags = ['exec', '--ephemeral', '--json', '--ignore-user-config', '--ignore-rules', '--color', 'never', '--sandbox', manifest.phase === 'execution' ? 'workspace-write' : 'read-only', '--skip-git-repo-check', '--output-schema', '/workspace/decision.schema.json', '--model', model, '--config', `model_reasoning_effort="${effort}"`, '-'];
    const script = 'mkdir -p "$CODEX_HOME"; exec codex "$@"';
    const fullArgs = [...args, '-c', script, 'amy-run', ...flags];
    record.args = fullArgs;
    let result;
    try { result = spawn('docker', fullArgs, { ...commandOptions, timeout: 120000, input: prompt }); }
    finally { spawn('docker', ['rm', '-f', containerName], { ...commandOptions, timeout: 10000 }); }
    writeText(prefix + '.events.jsonl', result.stdout || '');
    writeText(prefix + '.stderr.txt', result.stderr || '');
    record.exitCode = result.status;
    if (manifest.phase === 'execution') save(join(output, 'after.json'), snapshot(fixture));
    if (result.error || result.status !== 0) throw new Error(result.error?.message || 'CLI exited ' + result.status);
    const evidence = observeEvents(result.stdout, fixture, manifest.phase);
    if (!evidence.completed || !evidence.response) throw new Error('Missing completed turn or final agent response');
    writeText(prefix + '.response.json', evidence.response);
    let decision;
    try { decision = JSON.parse(evidence.response); }
    catch { record = { ...record, status: 'fail', reason: 'Invalid JSON final decision', evidence }; }
    if (decision !== undefined) record = { ...record, ...gradeDecision(decision, item.contract, evidence, manifest.skills), decision, evidence };
    const after = snapshot(fixture);
    if (manifest.phase === 'execution') {
      save(join(output, 'after.json'), after);
      record.artifacts = checkConfigArtifacts(manifest.fixtureSnapshot, after, existsSync(join(fixture, '.editorconfig')) ? read(join(fixture, '.editorconfig')) : '');
      if (!record.artifacts.onlyAuthorizedFile || !record.artifacts.correctContent) record = { ...record, status: 'fail', reason: 'Configuration artifact/preservation check failed' };
    } else if (JSON.stringify(after) !== JSON.stringify(manifest.fixtureSnapshot)) record = { ...record, status: 'fail', reason: 'Fixture modified during routing phase' };
  } catch (error) { record = { ...record, status: record.status === 'blocked' ? 'blocked' : 'fail', reason: error.message }; }
  record.finishedAt = new Date().toISOString();
  save(prefix + '.json', record);
  return record;
}
export function summarize(outputArgument) {
  const output = resolve(outputArgument);
  const manifest = JSON.parse(read(containedPath(output, 'manifest.json')));
  if (manifest.schemaVersion !== 3 || !Array.isArray(manifest.caseIds) || new Set(manifest.caseIds).size !== manifest.caseIds.length) throw new Error('Invalid report manifest');
  const expectedText = read(containedPath(output, 'expectations.json'));
  if (hash(expectedText) !== manifest.expectationsHash) throw new Error('Expectations changed since preparation');
  const expectations = JSON.parse(expectedText);
  const records = manifest.caseIds.map((id) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Invalid report case ID');
    const file = join(output, 'runs', id + '.json');
    if (!existsSync(file)) return { caseId: id, status: 'not-run' };
    const record = JSON.parse(read(containedPath(output, 'runs/' + id + '.json')));
    if (record.caseId !== id || record.sourceSnapshot !== manifest.sourceSnapshot || !['pass', 'fail', 'blocked', 'needs-review'].includes(record.status)) throw new Error('Invalid record: ' + id);
    if (record.status !== 'blocked') {
      const evidence = observeEvents(read(containedPath(output, 'runs/' + id + '.events.jsonl')), join(output, 'fixture'), manifest.phase);
      if (!evidence.completed || !evidence.response) throw new Error('Missing completed response evidence: ' + id);
      const expected = expectations.find((x) => x.id === id);
      if (!expected) throw new Error('Missing expectation: ' + id);
      let decision;
      try { decision = JSON.parse(evidence.response); } catch { decision = null; }
      const recomputed = gradeDecision(decision, expected.contract, evidence, manifest.skills);
      if (manifest.phase === 'execution') {
        const after = JSON.parse(read(containedPath(output, 'after.json')));
        if (JSON.stringify(snapshot(join(output, 'fixture'))) !== JSON.stringify(after)) throw new Error('Fixture changed after execution: ' + id);
        const content = existsSync(join(output, 'fixture/.editorconfig')) ? read(containedPath(output, 'fixture/.editorconfig')) : '';
        const artifacts = checkConfigArtifacts(manifest.fixtureSnapshot, after, content);
        if (!artifacts.onlyAuthorizedFile || !artifacts.correctContent) recomputed.status = 'fail';
      } else if (JSON.stringify(snapshot(join(output, 'fixture'))) !== JSON.stringify(manifest.fixtureSnapshot)) recomputed.status = 'fail';
      if (record.status !== recomputed.status) throw new Error('Recorded status contradicts raw evidence: ' + id);
      return { ...record, ...recomputed, decision, evidence };
    }
    return record;
  });
  const counts = Object.fromEntries(['pass', 'fail', 'blocked', 'needs-review', 'not-run'].map((status) => [status, records.filter((x) => x.status === status).length]));
  const report = { schemaVersion: 3, mode: manifest.mode, phase: manifest.phase, totalCatalog: manifest.totalCatalog, selected: records.length, counts, records, implementationQualityVerified: false };
  save(join(output, 'report.json'), report);
  return report;
}
export function main(args) {
  const [command = 'check', output, option] = args;
  if (command === 'check' && args.length <= 1) {
    const suite = loadSuite();
    console.log(JSON.stringify({ status: 'pass', catalog: suite.cases.length, smoke: selectCases(suite.cases, 'smoke').length, skills: suite.skills.length, modelBehaviorEvaluated: false }));
  } else if (command === 'prepare' && output && args.length <= 3) {
    console.log(JSON.stringify(prepare(output, option || 'smoke')));
  } else if (command === 'run' && output && option && args.length === 3) {
    const record = runCase(output, option);
    console.log(JSON.stringify(record));
    if (record.status !== 'pass') process.exitCode = 2;
  } else if (['smoke', 'full'].includes(command) && output && args.length <= 3) {
    if (command === 'full' && option !== '--allow-full') throw new Error('Full model run requires separate authorization and --allow-full');
    if (command === 'smoke' && option) throw new Error('Unknown smoke option');
    const { manifest } = prepare(output, command);
    for (const id of manifest.caseIds) {
      const record = runCase(output, id);
      console.log(id + ': ' + record.status);
      if (record.status === 'blocked') break;
    }
    const report = summarize(output);
    console.log(JSON.stringify({ ...report, records: undefined }));
    if (report.counts.pass !== report.selected) process.exitCode = 2;
  } else if (command === 'execute-config' && output && args.length === 2) {
    prepareExecution(output);
    const record = runCase(output, 'route-project-changes-01');
    console.log(JSON.stringify(record));
    summarize(output);
    if (record.status !== 'pass') process.exitCode = 2;
  } else if (command === 'results' && output && args.length === 2) {
    const report = summarize(output);
    console.log(JSON.stringify({ ...report, records: undefined }));
    if (report.counts.pass !== report.selected) process.exitCode = 2;
  } else throw new Error('Usage: check | prepare <new-dir> [smoke|full] | run <dir> <id> | smoke <new-dir> | full <new-dir> --allow-full | execute-config <new-dir> | results <dir>');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error('Routing evaluation failed: ' + error.message); process.exitCode = 1; }
}
