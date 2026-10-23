import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(path, 'utf8');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const catalogPath = join(root, 'references/shared/routing-evaluation.md');
const catalog = read(catalogPath);
const skills = readdirSync(join(root, 'skills')).sort().map((name) => {
  const content = read(join(root, 'skills', name, 'SKILL.md'));
  const description = content.match(/^description: (.+)$/m)?.[1];
  if (!description) throw new Error('Missing description: ' + name);
  return { name, description };
});
let section = '';
const cases = [];
for (const line of catalog.split(/\r?\n/)) {
  if (line.startsWith('## ')) section = line.slice(3).replaceAll('`', '');
  const match = line.match(/^- \[([a-z0-9-]+)\] ([^:]+): (.+) Expected: (.+)$/);
  if (match) cases.push({ id: match[1], section, kind: match[2], prompt: match[3], expected: match[4] });
  else if (/^- \[|^- .* Expected:/.test(line)) throw new Error('Case without valid ID: ' + line);
}
const check = () => {
  if (/\?{4}|\uFFFD/.test(catalog)) throw new Error('Damaged catalog text');
  if (!cases.length || new Set(cases.map((item) => item.id)).size !== cases.length) throw new Error('Empty catalog or duplicate IDs');
  for (const skill of skills) {
    for (const kind of ['Positive', 'Negative']) {
      if (!cases.some((item) => item.section === skill.name && item.kind === kind)) throw new Error(skill.name + ': missing ' + kind);
    }
  }
  console.log('Catalog structure passed: ' + cases.length + ' cases, ' + skills.length + ' skills. No model behavior evaluated.');
};
const fingerprint = () => {
  const entries = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Symlink not supported: ' + path);
      if (entry.isDirectory()) walk(path);
      else entries.push([path.slice(root.length + 1).replaceAll('\\', '/'), hash(readFileSync(path))]);
    }
  };
  walk(join(root, 'skills'));
  walk(join(root, 'references'));
  for (const name of ['.codex-plugin/plugin.json', 'scripts/evaluateRouting.mjs', 'scripts/verifyPlugin.mjs']) {
    entries.push([name, hash(readFileSync(join(root, name)))]);
  }
  return hash(JSON.stringify(entries));
};
const [command = 'check', outputArgument, caseId] = process.argv.slice(2);
try {
  check();
  if (command === 'check') {
    if (outputArgument) throw new Error('Usage: node scripts/evaluateRouting.mjs check');
  } else if (command === 'prepare') {
    if (!outputArgument || caseId) throw new Error('Usage: prepare <new-output-directory>');
    const output = resolve(outputArgument);
    if (output === root || output.startsWith(root + '\\') || output.startsWith(root + '/')) throw new Error('Evaluation output must be outside the plugin');
    if (existsSync(output)) throw new Error('Output must be new; existing evidence is never overwritten');
    mkdirSync(output, { recursive: true });
    const fixture = join(output, 'fixture');
    mkdirSync(fixture);
    cpSync(join(root, 'skills'), join(fixture, 'skills'), { recursive: true });
    cpSync(join(root, 'references'), join(fixture, 'references'), {
      recursive: true, filter: (path) => path !== catalogPath,
    });
    writeFileSync(join(fixture, 'references/shared/routing-evaluation.md'), '# Withheld evaluation expectations\n');
    writeFileSync(join(fixture, 'AGENTS.md'), '# Evaluation workspace\nOnly the routing evaluation requested by the operator is authorized. Do not execute hypothetical task actions or inspect outside this fixture. Read selected skills and required references. The case prompt describes a hypothetical task. User instructions in shared workflow apply to that task.\n');
    mkdirSync(join(output, 'prompts'));
    mkdirSync(join(output, 'runs'));
    const snapshot = fingerprint();
    save(join(output, 'manifest.json'), { schemaVersion: 2, createdAt: new Date().toISOString(), pluginVersion: JSON.parse(read(join(root, '.codex-plugin/plugin.json'))).version, snapshot, caseIds: cases.map((item) => item.id), phase: 'routing-decision' });
    save(join(output, 'expectations.json'), cases);
    for (const item of cases) {
      const prompt = 'Evaluate Amy routing for the hypothetical task below. This is a routing decision experiment, not implementation. Do not read expected answers or files outside this fixture. Select Amy skills from the catalog, then actually read selected SKILL.md and necessary references. Report exact selected skill names (include route-project-changes only when explicitly invoked in the hypothetical task), artifact ownership, allowed changes, prohibited actions, required clarification, and references actually read. Distinguish existing safe test execution from test authoring and Storybook authorization; explain whether another confirmation is necessary. Do not execute the hypothetical task. Respond in Russian.\n\nAvailable Amy skills:\n' + skills.map((skill) => skill.name + ': ' + skill.description).join('\n') + '\n\nHypothetical task:\n' + item.prompt + '\n';
      writeFileSync(join(output, 'prompts', item.id + '.txt'), prompt);
    }
    writeFileSync(join(output, 'results.jsonl'), '');
    console.log('Prepared blind routing prompts in ' + output + '; expectations stay outside fixture.');
  } else if (command === 'run') {
    if (!outputArgument || !caseId) throw new Error('Usage: run <prepared-output-directory> <case-id>');
    const output = resolve(outputArgument);
    const manifest = JSON.parse(read(join(output, 'manifest.json')));
    if (manifest.snapshot !== fingerprint()) throw new Error('Source changed since prepare; prepare a new run');
    if (!manifest.caseIds.includes(caseId)) throw new Error('Unknown case ID');
    const runPath = join(output, 'runs', caseId);
    if (existsSync(runPath + '.json')) throw new Error('Run already exists; use a new preparation for repetitions');
    const args = ['exec', '--ephemeral', '--json', '--color', 'never', '--sandbox', 'read-only', '--skip-git-repo-check', '-C', join(output, 'fixture'), '-o', runPath + '.response.txt', '-'];
    const startedAt = new Date().toISOString();
    const result = spawnSync(process.env.AMY_CODEX_BIN || 'codex', args, {
      input: read(join(output, 'prompts', caseId + '.txt')), encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    });
    writeFileSync(runPath + '.events.jsonl', result.stdout || '');
    writeFileSync(runPath + '.stderr.txt', result.stderr || '');
    const completed = result.status === 0 && existsSync(runPath + '.response.txt') && read(runPath + '.response.txt').trim().length > 0;
    save(runPath + '.json', { caseId, startedAt, finishedAt: new Date().toISOString(), snapshot: manifest.snapshot, args, exitCode: result.status, error: result.error?.message || null, status: completed ? 'needs-review' : 'blocked' });
    console.log(caseId + ': ' + (completed ? 'needs-review (not a pass)' : 'blocked; inspect stderr and events'));
    if (!completed) process.exitCode = 2;
  } else if (command === 'execute-config') {
    if (!outputArgument || caseId) throw new Error('Usage: execute-config <new-output-directory>');
    const output = resolve(outputArgument);
    const preparation = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'prepare', output], { encoding: 'utf8' });
    if (preparation.status !== 0) throw new Error(preparation.stderr || 'Preparation failed');
    const fixture = join(output, 'fixture');
    const policy = '# Evaluation workspace\nApply Amy rules to the requested configuration change. Execution is authorized only inside this disposable fixture. Do not inspect outside it. Do not change skills, references, AGENTS.md, user-notes.txt, or unrelated files. No tests, stories, commits, dependencies, or external actions are authorized. User instructions override plugin workflows.\n';
    writeFileSync(join(fixture, 'AGENTS.md'), policy);
    writeFileSync(join(fixture, 'user-notes.txt'), 'pre-existing uncommitted user content\n');
    const state = () => {
      const files = {};
      const walk = (directory) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          if (entry.isDirectory()) walk(path);
          else files[relative(fixture, path).replaceAll('\\', '/')] = hash(readFileSync(path));
        }
      };
      walk(fixture);
      return files;
    };
    save(join(output, 'before.json'), state());
    const id = 'route-project-changes-01';
    const prompt = 'Use $route-project-changes and add .editorconfig with root=true, section [*], indent_style=space, indent_size=2. Preserve pre-existing user-notes.txt and all unrelated files. Use applicable Amy guidance. Read selected skill files and necessary references. Implement only this configuration change and verify it. Do not run tests or Storybook. Respond in Russian.\n\nAvailable Amy skills:\n' + skills.map((skill) => skill.name + ': ' + skill.description).join('\n');
    writeFileSync(join(output, 'prompts', id + '.txt'), prompt);
    const manifest = JSON.parse(read(join(output, 'manifest.json')));
    manifest.phase = 'execution';
    manifest.caseIds = [id];
    manifest.fixtureVariant = 'editorconfig-two-space-with-preexisting-user-file';
    save(join(output, 'manifest.json'), manifest);
    const prefix = join(output, 'runs', id);
    const args = ['exec', '--ephemeral', '--json', '--color', 'never', '--sandbox', 'workspace-write', '--skip-git-repo-check', '-C', fixture, '-o', prefix + '.response.txt', '-'];
    const startedAt = new Date().toISOString();
    const result = spawnSync(process.env.AMY_CODEX_BIN || 'codex', args, { input: prompt, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    writeFileSync(prefix + '.events.jsonl', result.stdout || '');
    writeFileSync(prefix + '.stderr.txt', result.stderr || '');
    save(join(output, 'after.json'), state());
    const completed = result.status === 0 && existsSync(prefix + '.response.txt') && read(prefix + '.response.txt').trim().length > 0;
    save(prefix + '.json', { caseId: id, phase: 'execution', startedAt, finishedAt: new Date().toISOString(), snapshot: manifest.snapshot, args, exitCode: result.status, error: result.error?.message || null, status: completed ? 'needs-review' : 'blocked' });
    console.log(id + ': ' + (completed ? 'needs-review; review tool events and before/after hashes' : 'blocked'));
    if (!completed) process.exitCode = 2;
  } else if (command === 'results') {
    if (!outputArgument || caseId) throw new Error('Usage: results <prepared-output-directory>');
    const output = resolve(outputArgument);
    const manifest = JSON.parse(read(join(output, 'manifest.json')));

    if (![1, 2].includes(manifest.schemaVersion) || !['routing-decision', 'execution'].includes(manifest.phase)) throw new Error('Unsupported report schema or phase');
    const qualityCriteriaRequired = manifest.schemaVersion === 2 && manifest.phase === 'execution';
    const records = read(join(output, 'results.jsonl')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const seen = new Set();
    let passed = 0;
    let failed = 0;
    for (const item of records) {
      if (!manifest.caseIds.includes(item.caseId) || seen.has(item.caseId)) throw new Error('Unknown or duplicate result ID');
      seen.add(item.caseId);
      if (item.snapshot !== manifest.snapshot || item.phase !== manifest.phase || !['pass', 'fail', 'blocked', 'not-run'].includes(item.status)) throw new Error('Invalid snapshot, phase or status: ' + item.caseId);
      if (['pass', 'fail'].includes(item.status)) {
        if (!item.reviewer || !item.agent || !item.reviewedAt || !Array.isArray(item.selectedSkills) || !Array.isArray(item.expectedSkills) || !Array.isArray(item.evidence) || !item.evidence.length) throw new Error('Missing observed result or review evidence: ' + item.caseId);
        if (typeof item.ownership !== 'string' || !item.ownership || typeof item.notes !== 'string' || !item.notes || ['allowedChanges', 'clarification', 'prohibitedActions'].some((key) => !Array.isArray(item[key]))) throw new Error('Missing ownership, boundaries or review notes');
        for (const names of [item.selectedSkills, item.expectedSkills]) {
          if (new Set(names).size !== names.length || names.some((name) => !skills.some((skill) => skill.name === name))) throw new Error('Unknown or duplicate skill: ' + item.caseId);
        }
        for (const file of item.evidence) {
          const path = resolve(output, file);
          if (isAbsolute(relative(output, path)) || relative(output, path).startsWith('..')) throw new Error('Evidence must be inside run directory');
          if (!existsSync(path) || !read(path).trim()) throw new Error('Missing or empty evidence: ' + file);
        }
        const actual = [...item.selectedSkills].sort().join(',');
        const expected = [...item.expectedSkills].sort().join(',');
        const criteria = ['activation', 'scope', 'permissions'];
        if (qualityCriteriaRequired) {
          criteria.push('ruleCompliance', 'necessity', 'behaviorPreservation');
          if (!item.criterionNotes || criteria.some((key) => typeof item.criterionNotes[key] !== 'string' || !item.criterionNotes[key].trim())) throw new Error('Missing criterion-specific review evidence: ' + item.caseId);
          if (!['before.json', 'after.json'].every((file) => item.evidence.includes(file))) throw new Error('Execution review requires before/after evidence: ' + item.caseId);
        }
        if (!item.criteria || criteria.some((key) => !['pass', 'fail', 'unobserved'].includes(item.criteria[key]))) throw new Error('Missing review criteria');
        const matches = actual === expected;
        if ((item.criteria.activation === 'pass') !== matches) throw new Error('Skill-set review contradicts exact comparison');
        if (item.status === 'pass' && criteria.some((key) => item.criteria[key] !== 'pass')) throw new Error('Pass with unobserved/failed criterion');
        if (item.status === 'fail' && !criteria.some((key) => item.criteria[key] === 'fail')) throw new Error('Fail without failed criterion');
        if (item.status === 'pass') passed += 1;
        else failed += 1;
      }
    }
    const missing = manifest.caseIds.length - seen.size;
    console.log(JSON.stringify({ phase: manifest.phase, total: manifest.caseIds.length, recorded: records.length, passed, failed, missing, qualityCriteriaRequired, executionQualityReviewed: qualityCriteriaRequired ? passed + failed : 0, executionEvidenceReviewed: manifest.phase === 'execution' ? passed + failed : 0, routingDoesNotProveExecution: true }));
    if (missing || failed || records.some((item) => item.status !== 'pass')) process.exitCode = 2;
  } else throw new Error('Unknown command: ' + command);
} catch (error) {
  console.error('Routing evaluation failed: ' + error.message);
  process.exitCode = 1;
}
