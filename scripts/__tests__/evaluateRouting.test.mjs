import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalog, loadSuite, validateDecision, gradeDecision, main } from '../evaluateRouting.mjs';

const suite = loadSuite();
const names = suite.skills.map(x => x.name);
const caseById = id => suite.cases.find(x => x.id === id);
const clean = { reads: [], violations: [], unknown: [] };
const contract = caseById('route-project-changes-04').contract;
const decision = structuredClone(contract.decisions[0]);

test('all 235 scenarios and 16 skill boundaries remain available offline', () => {
 assert.equal(suite.cases.length, 235);
 assert.equal(names.length, 16);
 for (const skill of suite.skills) assert.match(skill.description, /^Use when /);
 for (const item of suite.cases) for (const expected of item.contract.decisions) assert.equal(validateDecision(expected, names), expected);
});
for(const content of ['', '- [id] Positive: x Expected: y\n- [id] Negative: z Expected: q','- [../id] Positive: x Expected: y','- [id] Broken','- [id] Positive: ???? Expected: x','- [id] Positive: � Expected: x'])test('плохой каталог: '+content.slice(0,30),()=>assert.throws(()=>parseCatalog(content)));
test('парсер сохраняет prompt, expectation, section и стабильный hash',()=>{
 const text='## `example`\n- [example-01] Positive: Original task. Expected: Expected answer.';
 const [item]=parseCatalog(text);
 assert.equal(item.prompt,'Original task.'); assert.equal(item.expected,'Expected answer.'); assert.equal(item.section,'example');
 assert.equal(item.sourceHash,parseCatalog(text.replaceAll('\n','\r\n'))[0].sourceHash);
});
for(const patch of [{selectedSkills:['unknown']},{selectedSkills:['develop-react-component','develop-react-component']},{ownership:[]},{allowedActions:['erase-world']},{clarification:'maybe'},{reason:''},{tests:{execution:'safe-only',authoring:true,storybook:false}},{unexpected:true}])test('плохой structured decision '+JSON.stringify(patch),()=>assert.throws(()=>validateDecision({...decision,...patch},names)));
test('точное сравнение независимо от порядка массивов',()=>{
 const item=caseById('consumer-and-ownership-boundaries-03'); const d=structuredClone(item.contract.decisions[0]);
 d.selectedSkills.reverse();d.ownership.reverse();d.allowedActions.reverse();
 const observed={...clean,reads:[...d.selectedSkills.map(n=>'skills/'+n+'/SKILL.md'),...item.contract.requiredReads]};
 assert.equal(gradeDecision(d,item.contract,observed,names).status,'pass');
});
for(const [field,value] of [['selectedSkills',['develop-react-component']],['ownership',['component']],['allowedActions',['inspect','edit-production','run-safe-tests']],['clarification','required'],['tests',{execution:'safe-only',authoring:true,storybook:false}]])test('сравнение поля '+field,()=>{
 const d={...decision,[field]:value};
 assert.equal(gradeDecision(d,contract,clean,names).status,'fail');
});
test('самоотчёт о выбранном skill без фактического чтения не проходит',()=>{
 const item=caseById('develop-effector-model-01');
 assert.equal(gradeDecision(item.contract.decisions[0],item.contract,clean,names).status,'fail');
});
test('посторонний прочитанный skill не проходит',()=>{
 assert.equal(gradeDecision(decision,contract,{...clean,reads:['skills/develop-react-component/SKILL.md']},names).status,'fail');
});
test('обязательные и запрещённые references проверяются отдельно',()=>{
 const item=caseById('scope-and-context-cases-01'); const d=item.contract.decisions[0];
 const reads=['skills/develop-react-component/SKILL.md',...item.contract.requiredReads];
 assert.equal(gradeDecision(d,item.contract,{...clean,reads},names).status,'pass');
 assert.equal(gradeDecision(d,item.contract,{...clean,reads:[reads[0]]},names).status,'fail');
 assert.equal(gradeDecision(d,item.contract,{...clean,reads:[...reads,...item.contract.forbiddenReads]},names).status,'fail');
});
test('опасное разрешённое действие сравнивается с эталоном',()=>{
 const actual={...decision,allowedActions:[...decision.allowedActions,'commit','external-mutation']};
 validateDecision(actual,names);
 assert.equal(gradeDecision(actual,contract,clean,names).status,'fail');
});
test('альтернативные решения нельзя смешивать по полям',()=>{
 const first=structuredClone(decision);const second={...structuredClone(decision),ownership:['component'],clarification:'required'};
 const expected={...contract,decisions:[first,second]};
 assert.equal(gradeDecision({...first,clarification:'required'},expected,clean,names).status,'fail');
 assert.equal(gradeDecision(second,expected,clean,names).status,'pass');
});

test('CLI rejects removed commands and extra arguments', () => {
 for (const args of [['prepare'], ['run'], ['results'], ['check', 'extra']]) assert.throws(() => main(args), /Usage/);
});
for (const item of suite.cases) test('offline contract: ' + item.id, () => {
 for (const expected of item.contract.decisions) {
  const evidence = { ...clean, reads: [...expected.selectedSkills.map(name => 'skills/' + name + '/SKILL.md'), ...item.contract.requiredReads] };
  assert.equal(gradeDecision(expected, item.contract, evidence, names).status, 'pass');
 }
});
