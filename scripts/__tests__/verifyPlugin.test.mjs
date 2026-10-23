import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPlugin, parseFrontmatter, validatePortableManifest } from '../verifyPlugin.mjs';

const validSkill = '---\nname: sample\ndescription: Create sample artifacts when requested.\n---\n# Sample\n';
const validInterface = { displayName: 'Sample', shortDescription: 'Sample', longDescription: 'Sample plugin', developerName: 'Sample', category: 'Productivity', capabilities: [] };
const validManifest = { $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'sample-plugin', version: '1.0.0', description: 'Sample', author: { name: 'Sample' }, extensions: { 'com.openai': { interface: validInterface } } };
const validAgent = 'interface:\n  display_name: "Sample"\n  short_description: "Create sample artifacts on request"\npolicy:\n  allow_implicit_invocation: false\n';
function fixture(t) {
  const path = mkdtempSync(join(tmpdir(), 'amy-verifier-test-'));
  t.after(() => { assert.ok(resolve(path).startsWith(resolve(tmpdir()) + '\\') || resolve(path).startsWith(resolve(tmpdir()) + '/')); rmSync(path, { recursive: true, force: true }); });
  for (const dir of ['skills/sample', 'references']) mkdirSync(join(path, dir), { recursive: true });
  writeFileSync(join(path, 'plugin.json'), JSON.stringify(validManifest));
  writeFileSync(join(path, 'skills/sample/SKILL.md'), validSkill);
  return path;
}
function frontmatter(content) {
  const errors = [];
  const value = parseFrontmatter('SKILL.md', content, errors);
  return { value, errors };
}
test('валидный плагин проходит проверку', t => {
  const root = fixture(t);
  assert.deepEqual(verifyPlugin([root]).errors, []);
  assert.equal(verifyPlugin([root]).skillCount, 1);
});
for (const [label, change, expected] of [
  ['сломанный JSON', '{', /invalid JSON manifest/], ['массив вместо manifest', '[]', /manifest must be an object/], ['null вместо manifest', 'null', /manifest must be an object/],
]) test(label, t => {
  const root = fixture(t); writeFileSync(join(root, 'plugin.json'), change);
  assert.match(verifyPlugin([root]).errors.join('\n'), expected);
});
for (const [label, patch, expected] of [
  ['суффикс версии', {version:'1.0.0+codex'}, /version must use/], ['ведущий ноль версии', {version:'01.0.0'}, /version must use/],
  ['пустое имя', {name:''}, /invalid plugin name/], ['невалидное имя', {name:'Bad_Name'}, /invalid plugin name/], ['пустое описание', {description:' '}, /description must be non-empty/],
  ['плохой author', {author:[]}, /author must have/], ['плохие keywords', {keywords:['x','x']}, /keywords must be unique/],
  ['неверная схема', {$schema:'https://example.com/schema.json'}, /must declare the Agent Plugins/],
  ['нет расширения OpenAI', {extensions:{}}, /extensions.com.openai must be an object/],
  ['массив вместо расширения OpenAI', {extensions:{'com.openai':[]}}, /extensions.com.openai must be an object/],
  ['плохой interface', {extensions:{'com.openai':{interface:[]}}}, /extensions.com.openai.interface must be an object/],
  ['выход icon', {extensions:{'com.openai':{interface:{...validInterface,logo:'./../outside'}}}}, /path escapes plugin|contain no \.\. components/],
  ['абсолютный icon', {extensions:{'com.openai':{interface:{...validInterface,logo:'/outside'}}}}, /logo must be a relative plugin path/],
  ['директория вместо icon', {extensions:{'com.openai':{interface:{...validInterface,logo:'./skills'}}}}, /logo must point to a regular file/],
]) test(label, t => {
  const root = fixture(t);
  writeFileSync(join(root, 'plugin.json'), JSON.stringify({...validManifest,...patch}));
  assert.match(verifyPlugin([root]).errors.join('\n'), expected);
});
test('валидные настройки интерфейса OpenAI проходят проверку', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'plugin.json'), JSON.stringify({...validManifest,extensions:{'com.openai':{interface:validInterface}}}));
  assert.deepEqual(verifyPlugin([root]).errors, []);
});

for (const [field, limit] of [['shortDescription', 30], ['longDescription', 4000]]) {
  for (const [label, value, valid] of [
    ['граница', 'я'.repeat(limit), true],
    ['Unicode code points', '😀'.repeat(limit), true],
    ['превышение', 'я'.repeat(limit + 1), false],
    ['пустая строка', ' ', false],
    ['не строка', 42, false],
    ['перенос строки', 'Первая\nВторая', field === 'longDescription'],
  ]) test(`OpenAI ${field}: ${label}`, t => {
    const root = fixture(t);
    const settings = { ...validInterface, [field]: value };
    writeFileSync(join(root, 'plugin.json'), JSON.stringify({ ...validManifest, extensions: { 'com.openai': { interface: settings } } }));
    const errors = verifyPlugin([root]).errors;
    if (valid) assert.deepEqual(errors, []);
    else assert.match(errors.join('\n'), new RegExp(`interface\\.${field}`));
  });
}

for (const [label, patch, valid] of [
  ['Developer Tools', { category: 'Developer Tools' }, true],
  ['Productivity', { category: 'Productivity' }, true],
  ['неизвестная категория', { category: 'Development' }, false],
  ['пустая категория', { category: '' }, false],
  ['не строка категории', { category: 42 }, false],
  ['граница capabilities', { capabilities: Array(20).fill('я'.repeat(120)) }, true],
  ['много capabilities', { capabilities: Array(21).fill('Read') }, false],
  ['длинная capability', { capabilities: ['я'.repeat(121)] }, false],
  ['пустая capability', { capabilities: [' '] }, false],
  ['перенос capability', { capabilities: ['Read\nWrite'] }, false],
  ['Unicode перенос capability', { capabilities: ['Read\u2028Write'] }, false],
  ['не строка capability', { capabilities: [null] }, false],
  ['не массив capabilities', { capabilities: 'Read' }, false],
  ['prompt строкой на границе', { defaultPrompt: 'я'.repeat(128) }, true],
  ['три prompts', { defaultPrompt: ['React', 'NestJS', 'AGENTS.md'] }, true],
  ['нет prompts', { defaultPrompt: [] }, true],
  ['много prompts', { defaultPrompt: ['a', 'b', 'c', 'd'] }, false],
  ['длинный prompt', { defaultPrompt: ['я'.repeat(129)] }, false],
  ['пустой prompt', { defaultPrompt: [' '] }, false],
  ['перенос prompt', { defaultPrompt: ['React\r\ncomponent'] }, false],
  ['Unicode перенос prompt', { defaultPrompt: ['React\u2029component'] }, false],
  ['не строка prompt', { defaultPrompt: [null] }, false],
  ['не строка и не массив prompts', { defaultPrompt: {} }, false],
  ['дубликат prompts', { defaultPrompt: ['React', 'React'] }, false],
  ['нормализация пробелов prompts', { defaultPrompt: ['React component', ' React  component '] }, false],
  ['нормализация Unicode prompts', { defaultPrompt: ['Café', 'Cafe\u0301'] }, false],
  ['app mention', { defaultPrompt: ['Use @my_app to create a component.'] }, false],
]) test('OpenAI listing: ' + label, t => {
  const root = fixture(t);
  const settings = { ...validInterface, ...patch };
  writeFileSync(join(root, 'plugin.json'), JSON.stringify({ ...validManifest, extensions: { 'com.openai': { interface: settings } } }));
  const errors = verifyPlugin([root]).errors;
  if (valid) assert.deepEqual(errors, []);
  else assert.match(errors.join('\n'), /interface\.(category|capabilities|defaultPrompt)/);
});

test('метаданные Amy описывают разработку и три основных стартовых запроса', () => {
  const root = new URL('../../', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('plugin.json', root), 'utf8'));
  const settings = manifest.extensions['com.openai'].interface;
  assert.equal(settings.category, 'Developer Tools');
  assert.match(settings.shortDescription, /TypeScript/);
  for (const subject of ['TypeScript', 'React', 'NestJS', 'AGENTS.md']) {
    assert.ok(settings.longDescription.includes(subject), subject);
  }
  assert.equal(settings.defaultPrompt.length, 3);
  for (const subject of ['React', 'NestJS', 'AGENTS.md']) {
    assert.ok(settings.defaultPrompt.some(prompt => prompt.includes(subject)), subject);
  }
  assert.ok(settings.capabilities.length > 2);
  assert.ok(settings.capabilities.every(capability => !['Interactive', 'Write'].includes(capability)));
  assert.match(settings.capabilities.find(capability => capability.includes('Storybook')), /explicit request/);
  assert.deepEqual(verifyPlugin([fileURLToPath(root)]).errors, []);
});
for (const asFile of [false, true]) test(asFile ? 'файл вместо каталога skills отклоняется' : 'отсутствующий каталог skills отклоняется', t => {
  const root = fixture(t);
  const skillsPath = join(root, 'skills');
  rmSync(skillsPath, { recursive: true });
  if (asFile) writeFileSync(skillsPath, 'invalid');
  assert.match(verifyPlugin([root]).errors.join('\n'), asFile ? /skills path must be a directory/ : /cannot access skills directory/);
});
for (const [label, content] of [
 ['нет YAML', '# Heading'], ['нет конца YAML', '---\nname: sample'],
 ['повторное имя', validSkill.replace('description:', 'name: sample\ndescription:')],
 ['неизвестное поле', validSkill.replace('description:', 'surprise: value\ndescription:')],
 ['нет description', validSkill.replace(/description:.*\n/, '')],
 ['нет body', validSkill.slice(0, validSkill.lastIndexOf('---')+3)],
 ['неправильная вложенность', validSkill.replace('description:', '  description:')],
 ['неправильный YAML', validSkill.replace('description:', 'description')],
 ['открытая кавычка', validSkill.replace('name: sample', 'name: "sample')],
 ['неверный escape', validSkill.replace('name: sample', 'name: "sam\\qple"')],
 ['число вместо строки', validSkill.replace('name: sample', 'name: 42')],
 ['boolean вместо строки', validSkill.replace('name: sample', 'name: true')],
 ['alias', validSkill.replace('name: sample', 'name: *sample')],
 ['пустая metadata', validSkill.replace('description:', 'metadata:\ndescription:')],
 ['повторная metadata', validSkill.replace('description:', 'metadata:\n  key: x\n  key: y\ndescription:')],
 ['плохой metadata value', validSkill.replace('description:', 'metadata:\n  key: 42\ndescription:')],
 ['слишком длинная compatibility', validSkill.replace('description:', 'compatibility: '+ 'a'.repeat(501)+'\ndescription:')],
]) test(label, () => assert.ok(frontmatter(content).errors.length));
for (const name of ['-a','a-','a--b','A','a_b','a'.repeat(65)]) test('недопустимое имя '+name, () => assert.ok(frontmatter(validSkill.replace('name: sample','name: '+name)).errors.length));
test('лимиты 64 и 1024 включительны', () => {
  assert.deepEqual(frontmatter('---\nname: '+ 'a'.repeat(64)+'\ndescription: '+ 'я'.repeat(1024)+'\n---\nBody').errors, []);
  assert.ok(frontmatter(validSkill.replace('Create sample artifacts when requested.','я'.repeat(1025))).errors.length);
});
test('поддерживаемые YAML строки и metadata', () => {
  const content = "\uFEFF---\r\nname: 'sample'\r\ndescription: >-\r\n  Create sample artifacts.\r\n  Use when requested.\r\nmetadata:\r\n  author: \"Amy\"\r\n  note: 'Amy''s tools'\r\n---\r\nBody";
  const parsed = frontmatter(content);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.value.description, 'Create sample artifacts. Use when requested.');
  assert.deepEqual(frontmatter(validSkill.replace('requested.', "Amy's request.")).errors, []);
});
test('имя совпадает с директорией', t => {
 const root=fixture(t); writeFileSync(join(root,'skills/sample/SKILL.md'),validSkill.replace('name: sample','name: other'));
 assert.match(verifyPlugin([root]).errors.join('\n'),/does not match/);
});
for (const target of ['../../../outside.md','%2e%2e/%2e%2e/%2e%2e/outside.md','/absolute.md','C:/absolute.md','%ZZ','missing.md']) test('недопустимая ссылка '+target,t=>{
 const root=fixture(t); writeFileSync(join(root,'skills/sample/SKILL.md'),validSkill+'\n[link]('+target+')\n');
 assert.ok(verifyPlugin([root]).errors.length);
});
test('inline, reference и root Markdown проверяются, код игнорируется', t=>{
 const root=fixture(t);
 writeFileSync(join(root,'references/ok.md'),'# OK');
 writeFileSync(join(root,'README.md'),'[OK](references/ok.md#title)\n[ref][ok]\n[ok]: references/ok.md\n`[missing](absent.md)`\n~~~md\n[missing](absent.md)\n~~~\n');
 assert.deepEqual(verifyPlugin([root]).errors,[]);
 writeFileSync(join(root,'README.md'),'[ref][absent]');
 assert.match(verifyPlugin([root]).errors.join('\n'),/undefined reference/);
});
test('symlink/junction в промежуточной директории отклоняется', t=>{
 const root=fixture(t); const outside=fixture(t);
 symlinkSync(join(outside,'references'), join(root,'references/external'), 'junction');
 writeFileSync(join(root,'skills/sample/SKILL.md'),validSkill+'\n[external](../../references/external/file.md)');
 assert.match(verifyPlugin([root]).errors.join('\n'),/symbolic links|junctions/);
});
test('symlink/junction самого root отклоняется', t=>{
 const root=fixture(t); const other=fixture(t); const link=join(other,'linked');
 symlinkSync(root,link,'junction');
 assert.match(verifyPlugin([link]).errors.join('\n'),/symbolic links|junctions/);
});
test('неверные CLI аргументы отклоняются',()=>{
 assert.ok(verifyPlugin(['']).errors.length);
 assert.ok(verifyPlugin(['a','b']).errors.length);
});
test('комментарий не превращает null/boolean в строку description',()=>{
 for(const value of ['# comment','true # comment','- item','? key'])assert.ok(frontmatter(validSkill.replace('Create sample artifacts when requested.',value)).errors.length,value);
 assert.deepEqual(frontmatter(validSkill.replace('name: sample','name: sample # comment')).errors,[]);
});

function agentFixture(t, content = validAgent, name = 'sample') {
  const root = fixture(t);
  if (name !== 'sample') {
    rmSync(join(root, 'skills/sample'), { recursive: true });
    mkdirSync(join(root, 'skills', name));
    writeFileSync(join(root, 'skills', name, 'SKILL.md'), validSkill.replace('name: sample', 'name: ' + name));
  }
  const agents = join(root, 'skills', name, 'agents');
  mkdirSync(agents);
  writeFileSync(join(agents, 'openai.yaml'), content);
  return root;
}

test('portable metadata не требует OpenAI полей и допускает точки в имени', () => {
  for (const manifest of [
    { $schema: validManifest.$schema, name: 'acme.tools' },
    { $schema: validManifest.$schema, name: 'a.-b', version: 'draft', description: '', author: {}, keywords: ['', 'x', 'x'], extensions: { 'com.example': { interface: false } } },
  ]) {
    const errors = [];
    validatePortableManifest(manifest, 'plugin.json', errors);
    assert.deepEqual(errors, []);
  }
});

for (const name of ['-a', 'a-', '.a', 'a.', 'a--b', 'a..b', 'A', 'a_b', 'a'.repeat(65)]) test('portable plugin name отклоняет ' + name, () => {
  const errors = [];
  validatePortableManifest({ ...validManifest, name }, 'plugin.json', errors);
  assert.match(errors.join('\n'), /invalid plugin name/);
});

for (const patch of [{ version: 1 }, { description: null }, { author: { name: 1 } }, { author: { extra: '' } }, { keywords: [1] }, { extensions: [] }, { extensions: { 'com.example': false } }, { skills: './skills' }]) test('portable manifest проверяет типы и закрытые поля ' + JSON.stringify(patch), () => {
  const errors = [];
  validatePortableManifest({ ...validManifest, ...patch }, 'plugin.json', errors);
  assert.ok(errors.length);
});

test('OpenAI отклоняет portable имя с точкой отдельно от core проверки', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'plugin.json'), JSON.stringify({ ...validManifest, name: 'acme.tools' }));
  const { errors } = verifyPlugin([root]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /invalid OpenAI plugin name/);
});

test('OpenAI interface обязателен, capabilities для Agent Plugins необязательны', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'plugin.json'), JSON.stringify({ ...validManifest, extensions: { 'com.openai': {} } }));
  assert.match(verifyPlugin([root]).errors.join('\n'), /interface must be an object/);
  const { capabilities, ...settings } = validInterface;
  writeFileSync(join(root, 'plugin.json'), JSON.stringify({ ...validManifest, extensions: { 'com.openai': { interface: settings } } }));
  assert.deepEqual(verifyPlugin([root]).errors, []);
});

test('OpenAI identity учитывает plugin name и разделитель: 64 проходит, 65 нет', t => {
  const root = fixture(t);
  for (const length of [57, 58]) {
    writeFileSync(join(root, 'plugin.json'), JSON.stringify({ ...validManifest, name: 'a'.repeat(length) }));
    const errors = verifyPlugin([root]).errors;
    if (length === 57) assert.deepEqual(errors, []);
    else assert.match(errors.join('\n'), /OpenAI skill identity/);
  }
  assert.deepEqual(frontmatter(validSkill.replace('name: sample', 'name: ' + 'a'.repeat(64))).errors, []);
  assert.ok(frontmatter(validSkill.replace('name: sample', 'name: sample.name')).errors.length);
});

test('валидный agent YAML и обычный skill без agent YAML проходят', t => {
  assert.deepEqual(verifyPlugin([fixture(t)]).errors, []);
  assert.deepEqual(verifyPlugin([agentFixture(t)]).errors, []);
  assert.deepEqual(verifyPlugin([agentFixture(t, '\uFEFF# Metadata\r\n' + validAgent.replaceAll('\n', '\r\n'))]).errors, []);
  assert.deepEqual(verifyPlugin([agentFixture(t, validAgent.replace('false', 'true # allowed'))]).errors, []);
  assert.deepEqual(verifyPlugin([agentFixture(t, validAgent.replace('"Sample"', '"Sample" # comment'))]).errors, []);
});

for (const [label, content, expected] of [
  ['нет interface', 'policy:\n  allow_implicit_invocation: false', /interface/],
  ['пустой interface', 'interface:\n', /display_name|short_description/],
  ['нет display_name', validAgent.replace(/  display_name:.*\n/, ''), /display_name/],
  ['нет short_description', validAgent.replace(/  short_description:.*\n/, ''), /short_description/],
  ['пустая строка', validAgent.replace('"Sample"', '""'), /display_name/],
  ['пробелы', validAgent.replace('"Sample"', '"  "'), /single-line string/],
  ['boolean', validAgent.replace('"Sample"', 'true'), /YAML string/],
  ['число', validAgent.replace('"Sample"', '42'), /YAML string/],
  ['exponent', validAgent.replace('"Sample"', '1e3'), /YAML string/],
  ['hex number', validAgent.replace('"Sample"', '0xFF'), /YAML string/],
  ['null', validAgent.replace('"Sample"', 'null'), /YAML string/],
  ['массив', validAgent.replace('"Sample"', '[Sample]'), /unquoted value/],
  ['mapping', validAgent.replace('"Sample"', '{name: Sample}'), /unquoted value/],
  ['alias', validAgent.replace('"Sample"', '*alias'), /YAML string/],
  ['escape', validAgent.replace('"Sample"', '"Sam\\qple"'), /quoted string/],
  ['перенос строки', validAgent.replace('"Sample"', '"Sam\\nple"'), /single-line string/],
  ['дубликат секции', validAgent + 'interface:\n', /duplicate YAML section/],
  ['дубликат поля', validAgent.replace('  display_name:', '  display_name: "First"\n  display_name:'), /duplicate interface.display_name/],
  ['quoted boolean', validAgent.replace('false', '"false"'), /YAML boolean/],
  ['число вместо boolean', validAgent.replace('false', '0'), /YAML boolean/],
  ['дубликат policy', validAgent + '  allow_implicit_invocation: true\n', /duplicate policy/],
  ['неизвестное policy поле', validAgent + '  allow_implicit_invocations: false\n', /unsupported policy field/],
  ['scalar interface', 'interface: false\n', /unsupported YAML mapping/],
  ['пустая policy', validAgent.replace('  allow_implicit_invocation: false\n', ''), /policy must be a non-empty YAML mapping/],
  ['array root', '- interface\n', /unsupported YAML mapping/],
  ['tab', validAgent.replace('  display_name', '\tdisplay_name'), /unsupported YAML mapping/],
  ['неверный цвет', validAgent.replace('policy:', '  brand_color: "red"\npolicy:'), /invalid interface.brand_color/],
  ['пустой prompt', validAgent.replace('policy:', '  default_prompt: ""\npolicy:'), /default_prompt/],
]) test('agent YAML: ' + label, t => {
  assert.match(verifyPlugin([agentFixture(t, content)]).errors.join('\n'), expected);
});

for (const name of ['codify-rule', 'route-project-changes']) test('explicit-only policy сохраняется для ' + name, t => {
  const root = agentFixture(t, validAgent, name);
  const path = join(root, 'skills', name, 'agents/openai.yaml');
  assert.deepEqual(verifyPlugin([root]).errors, []);
  writeFileSync(path, validAgent.replace('false', 'true'));
  assert.match(verifyPlugin([root]).errors.join('\n'), /requires policy.allow_implicit_invocation: false/);
  writeFileSync(path, validAgent.replace(/policy:[\s\S]*/, ''));
  assert.match(verifyPlugin([root]).errors.join('\n'), /requires policy.allow_implicit_invocation: false/);
  rmSync(path);
  assert.match(verifyPlugin([root]).errors.join('\n'), /requires policy.allow_implicit_invocation: false/);
});

test('agent metadata должен быть обычным файлом, symlink отклоняется', t => {
  const root = agentFixture(t);
  const path = join(root, 'skills/sample/agents/openai.yaml');
  rmSync(path);
  mkdirSync(path);
  assert.match(verifyPlugin([root]).errors.join('\n'), /must be a regular file/);
  rmSync(path, { recursive: true });
  symlinkSync(join(root, 'references'), path, 'junction');
  assert.match(verifyPlugin([root]).errors.join('\n'), /symbolic links|junctions/);
});

test('agent metadata отклоняет повреждённый UTF-8', t => {
  const root = agentFixture(t);
  writeFileSync(join(root, 'skills/sample/agents/openai.yaml'), Buffer.concat([Buffer.from(validAgent), Buffer.from([0xff])]));
  assert.match(verifyPlugin([root]).errors.join('\n'), /cannot read UTF-8 skill agent metadata/);
});

for (const target of ['../SKILL.md', '/outside.svg', 'C:/outside.svg', 'https://example.com/icon.svg', 'assets\\icon.svg', 'missing.svg', './agents']) test('agent icon: ' + target, t => {
  const content = validAgent.replace('policy:', '  icon_small: ' + JSON.stringify(target) + '\npolicy:');
  assert.ok(verifyPlugin([agentFixture(t, content)]).errors.length);
});

test('agent assets разрешаются относительно skill directory', t => {
  const root = agentFixture(t, validAgent.replace('policy:', '  icon_small: "./assets/icon.svg"\n  icon_large: "assets/icon.svg"\n  brand_color: "#123ABC"\n  default_prompt: "Use $sample to create artifacts."\npolicy:'));
  mkdirSync(join(root, 'skills/sample/assets'));
  writeFileSync(join(root, 'skills/sample/assets/icon.svg'), '<svg/>');
  assert.deepEqual(verifyPlugin([root]).errors, []);
});
