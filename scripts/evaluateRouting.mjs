import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyPlugin, containedPath, parseFrontmatter } from './verifyPlugin.mjs';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(path, 'utf8');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
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
    if (!Array.isArray(contract.requiredReads) || !Array.isArray(contract.forbiddenReads)) throw new Error('Invalid evidence contract: ' + item.id);
    for (const file of [...contract.requiredReads, ...contract.forbiddenReads]) containedPath(pluginRoot, file);
    item.contract = contract;
  }
  for (const skill of skills) for (const kind of ['Positive', 'Negative']) {
    if (!cases.some((x) => x.section === skill.name && x.kind === kind)) throw new Error(skill.name + ': missing ' + kind);
  }
  return { skills, cases };
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

export function main(args) {
  if (args.length > 1 || (args[0] && args[0] !== 'check')) throw new Error('Usage: check');
  const suite = loadSuite();
  console.log(JSON.stringify({ status: 'pass', catalog: suite.cases.length, skills: suite.skills.length, modelBehaviorEvaluated: false }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error('Routing validation failed: ' + error.message); process.exitCode = 1; }
}
