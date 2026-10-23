import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { verifyPlugin, parseFrontmatter } from '../verifyPlugin.mjs';

const validSkill = '---\nname: sample\ndescription: Create sample artifacts when requested.\n---\n# Sample\n';
function fixture(t) {
  const path = mkdtempSync(join(tmpdir(), 'amy-verifier-test-'));
  t.after(() => { assert.ok(resolve(path).startsWith(resolve(tmpdir()) + '\\') || resolve(path).startsWith(resolve(tmpdir()) + '/')); rmSync(path, { recursive: true, force: true }); });
  for (const dir of ['.codex-plugin', 'skills/sample', 'references']) mkdirSync(join(path, dir), { recursive: true });
  writeFileSync(join(path, '.codex-plugin/plugin.json'), JSON.stringify({ name: 'sample-plugin', version: '1.0.0', description: 'Sample', skills: './skills' }));
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
for (const [label, change] of [
  ['сломанный JSON', '{'], ['массив вместо manifest', '[]'], ['null вместо manifest', 'null'],
]) test(label, t => {
  const root = fixture(t); writeFileSync(join(root, '.codex-plugin/plugin.json'), change);
  assert.ok(verifyPlugin([root]).errors.length);
});
for (const [label, patch] of [
  ['суффикс версии', {version:'1.0.0+codex'}], ['ведущий ноль версии', {version:'01.0.0'}],
  ['пустое имя', {name:''}], ['невалидное имя', {name:'Bad_Name'}], ['пустое описание', {description:' '}],
  ['плохой author', {author:[]}], ['плохие keywords', {keywords:['x','x']}], ['плохой interface', {interface:[]}],
  ['абсолютный skills', {skills:'C:/outside'}], ['выход skills', {skills:'./../outside'}],
  ['выход icon', {interface:{logo:'./../outside'}}], ['абсолютный icon', {interface:{logo:'/outside'}}],
  ['директория вместо icon', {interface:{logo:'./skills'}}],
]) test(label, t => {
  const root = fixture(t);
  writeFileSync(join(root, '.codex-plugin/plugin.json'), JSON.stringify({name:'sample',description:'Sample',version:'1.0.0',skills:'./skills',...patch}));
  assert.ok(verifyPlugin([root]).errors.length);
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
