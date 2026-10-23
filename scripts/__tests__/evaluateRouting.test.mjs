import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseCatalog, loadSuite, selectCases, prepare, prepareExecution, buildPrompt, validateDecision, observeEvents, gradeDecision, dockerSpec, requiredFlags, checkCapabilities, runCase, summarize, checkConfigArtifacts, snapshot, main, root } from '../evaluateRouting.mjs';

const suite = loadSuite();
const names = suite.skills.map(x=>x.name);
const caseById = id=>suite.cases.find(x=>x.id===id);
const clean = { completed:true, reads:[], violations:[], unknown:[] };
const contract = caseById('route-project-changes-04').contract;
const decision = structuredClone(contract.decisions[0]);
function workspace(t) {
 const path=mkdtempSync(join(tmpdir(),'amy-evaluator-test-'));
 t.after(()=>{ assert.ok(resolve(path).startsWith(resolve(tmpdir())+'\\')||resolve(path).startsWith(resolve(tmpdir())+'/')); rmSync(path,{recursive:true,force:true}); });
 return join(path,'output');
}
function transcript(value, reads=[], fixture= root, extra=[]) {
 return [
  {type:'thread.started',thread_id:'test-thread'},
  ...reads.map((path,i)=>({type:'item.completed',item:{type:'command_execution',id:'read-'+i,command:'cat '+path,exit_code:0,status:'completed',aggregated_output:readFileSync(join(fixture,path),'utf8')}})),
  ...extra,
  {type:'item.completed',item:{id:'final',type:'agent_message',text:typeof value==='string'?value:JSON.stringify(value)}},
  {type:'turn.completed',usage:{input_tokens:20,output_tokens:10}},
 ].map(x=>JSON.stringify(x)).join('\n')+'\n';
}
const event = (command, overrides={})=>({type:'item.completed',item:{id:'action',type:'command_execution',command,exit_code:0,aggregated_output:'',...overrides}});
function fakeDocker(output, data, options={}) {
 const calls=[];
 const spawn=(bin,args,opts)=>{
  calls.push({bin,args,opts});
  assert.equal(bin,'docker'); assert.equal(opts.shell,false);
  if(args[0]==='rm')return {status:0,stdout:'',stderr:''};
  if(args.at(-1).includes('exec --help'))return options.probe||{status:0,stdout:'codex-cli test\n'+requiredFlags.join('\n'),stderr:''};
  if(options.mutate)options.mutate(join(output,'fixture'));
  return options.result||{status:0,stdout:data,stderr:''};
 };
 return {spawn,calls,image:'trusted/codex:test',model:'test-model',effort:'medium'};
}
test('все текущие сценарии сохранены и имеют структурированные эталоны',()=>{
 assert.equal(suite.cases.length,235);
 assert.equal(names.length,16);
 assert.equal(selectCases(suite.cases,'full').length,235);
 const smoke=selectCases(suite.cases,'smoke');
 assert.equal(smoke.length,20);
 for(const name of names)assert.ok(smoke.some(x=>x.contract.decisions.some(d=>d.selectedSkills.includes(name))),name);
 for(const item of suite.cases)for(const d of item.contract.decisions)assert.equal(validateDecision(d,names),d);
});
for(const content of ['', '- [id] Positive: x Expected: y\n- [id] Negative: z Expected: q','- [../id] Positive: x Expected: y','- [id] Broken','- [id] Positive: ???? Expected: x','- [id] Positive: � Expected: x'])test('плохой каталог: '+content.slice(0,30),()=>assert.throws(()=>parseCatalog(content)));
test('парсер сохраняет prompt, expectation, section и стабильный hash',()=>{
 const text='## `example`\n- [example-01] Positive: Original task. Expected: Expected answer.';
 const [item]=parseCatalog(text);
 assert.equal(item.prompt,'Original task.'); assert.equal(item.expected,'Expected answer.'); assert.equal(item.section,'example');
 assert.equal(item.sourceHash,parseCatalog(text.replaceAll('\n','\r\n'))[0].sourceHash);
});
test('неизвестный режим не запускается',()=>assert.throws(()=>selectCases(suite.cases,'other')));
test('prepare не включает ответы в fixture или prompt',t=>{
 const output=workspace(t); const {manifest}=prepare(output);
 assert.equal(manifest.caseIds.length,20);
 assert.ok(!Object.keys(snapshot(join(output,'fixture'))).some(x=>/expectation|evaluateRouting|verifyPlugin/.test(x)));
 assert.equal(readFileSync(join(output,'fixture/references/shared/routing-evaluation.md'),'utf8'),'# Withheld evaluation catalog\n');
 const item=caseById(manifest.caseIds[0]); const prompt=buildPrompt(item,suite.skills);
 assert.ok(!prompt.includes(item.expected)); assert.ok(!prompt.includes(item.sourceHash)); assert.ok(!prompt.includes(item.id));
 assert.ok(existsSync(join(output,'expectations.json')));
 assert.throws(()=>prepare(output),/new/);
});
test('prepare запрещает output внутри плагина',()=>assert.throws(()=>prepare(join(root,'new-output')),/outside/));
test('полный запуск требует отдельного флага разрешения до создания файлов',t=>{
 const output=workspace(t);
 assert.throws(()=>main(['full',output]),/authorization/); assert.equal(existsSync(output),false);
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
test('реальное чтение устанавливается по успешной команде и полному содержимому',()=>{
 const path='skills/develop-react-component/SKILL.md';
 const evidence=observeEvents(transcript(decision,[path]),root);
 assert.deepEqual(evidence.reads,[path]); assert.equal(evidence.completed,true);
 const forged=observeEvents(transcript(decision,[],root,[event('cat '+path,{aggregated_output:'I read it'})]),root);
 assert.deepEqual(forged.reads,[]);assert.equal(forged.unknown.length,1);
});
test('shell wrapper CLI распознаётся только для точного cat',()=>{
 const path='skills/develop-react-component/SKILL.md';
 const evidence=observeEvents(transcript(decision,[],root,[event('/bin/bash -lc '+"'cat "+path+"'",{aggregated_output:readFileSync(join(root,path),'utf8')})]),root);
 assert.deepEqual(evidence.reads,[path]);
});
for(const command of ['npm test','git commit -m bad','touch file','cat skills/develop-react-component/SKILL.md > bad','curl https://example.com'])test('запрещённая команда '+command,()=>{
 const e=observeEvents(transcript(decision,[],root,[event(command)]),root);
 assert.equal(e.violations.length,1);
 assert.equal(gradeDecision(decision,contract,e,names).status,'fail');
});
test('неизвестное или неуспешное действие требует review',()=>{
 const e=observeEvents(transcript(decision,[],root,[event('ls'),event('cat references/shared/testing.md',{id:'other',exit_code:1})]),root);
 assert.equal(gradeDecision(decision,contract,e,names).status,'needs-review');
});
test('неизвестный тип tool event не даёт pass',()=>{
 const e=observeEvents(transcript(decision,[],root,[{type:'item.completed',item:{id:'future',type:'future_tool'}}]),root);
 assert.equal(gradeDecision(decision,contract,e,names).status,'needs-review');
});
test('повторные и сломанные events отклоняются',()=>{
 assert.throws(()=>observeEvents('not json',root));
 assert.throws(()=>observeEvents(transcript(decision,[],root,[event('ls'),event('ls')]),root),/Duplicate/);
});
test('path traversal в cat отклоняется',()=>{
 const evidence=observeEvents(transcript(decision,[],root,[event('cat references/../../../secret')]),root);
 assert.equal(evidence.violations.length,1);assert.match(evidence.violations[0].reason,/escapes/);
});
test('docker mount содержит только fixture, свежие HOME и CODEX_HOME',()=>{
 const args=dockerSpec('C:\\fixture','trusted/codex:test','test',true);
 assert.equal(args.filter(x=>x==='--mount').length,1); assert.ok(args.includes('type=bind,source=C:\\fixture,target=/workspace,readonly'));
 assert.ok(args.includes('HOME=/home/amy')); assert.ok(args.includes('CODEX_HOME=/tmp/amy-codex')); assert.ok(args.includes('--pull=never'));
 assert.ok(!args.some(x=>x.includes('auth.json')||x.includes('.codex/config.toml')));
 assert.throws(()=>dockerSpec('x,y','trusted/codex:test','test'));
 assert.throws(()=>dockerSpec('x',undefined,'test'));
});
test('параметры CLI проверяются до вызова модели',()=>{
 checkCapabilities({status:0,stdout:requiredFlags.join('\n')});
 for(const flag of requiredFlags)assert.throws(()=>checkCapabilities({status:0,stdout:requiredFlags.filter(x=>x!==flag).join('\n')}),/missing/);
 assert.throws(()=>checkCapabilities({status:1,stderr:'unavailable'}));
});
test('успешный процесс без ответа остаётся blocked',t=>{
 const output=workspace(t); const {manifest}=prepare(output); const id=manifest.caseIds[0];
 const fake=fakeDocker(output,''); const record=runCase(output,id,fake);
 assert.equal(record.status,'blocked'); assert.match(record.reason,/Missing completed/);
});
test('полный цикл mock CLI: реальные reads, structured decision, report и защита от перезаписи',t=>{
 const output=workspace(t); prepare(output);
 const id='route-project-changes-04'; const fake=fakeDocker(output,transcript(decision));
 const record=runCase(output,id,fake);
 assert.equal(record.status,'pass'); assert.equal(record.runtimeModel,undefined);
 assert.equal(record.evidence.runtimeModel,null); assert.equal(record.configuredModel,'test-model');
 const report=summarize(output); assert.equal(report.counts.pass,1);assert.equal(report.counts['not-run'],19);assert.equal(report.implementationQualityVerified,false);
 const actual=fake.calls.find(x=>x.args.includes('amy-run'));
 assert.ok(actual.args.includes('--ignore-user-config'));assert.ok(actual.args.includes('--ignore-rules'));assert.ok(actual.args.includes('--output-schema'));
 assert.ok(fake.calls.some(x=>x.args[0]==='rm'));
 assert.throws(()=>runCase(output,id,fake),/already/);
});
test('несовпадение ответа модели оценивается как fail, а не blocked',t=>{
 const output=workspace(t);prepare(output); const fake=fakeDocker(output,transcript({...decision,clarification:'required'}));
 assert.equal(runCase(output,'route-project-changes-04',fake).status,'fail');
});
test('некорректный JSON модели оценивается как fail',t=>{
 const output=workspace(t);prepare(output); const fake=fakeDocker(output,transcript('not json'));
 assert.equal(runCase(output,'route-project-changes-04',fake).status,'fail');
 assert.equal(summarize(output).counts.fail,1);
});
test('при недоступном CLI модель не запускается',t=>{
 const output=workspace(t);const {manifest}=prepare(output);
 const fake=fakeDocker(output,'',{probe:{status:1,stdout:'',stderr:'Docker unavailable'}});
 const record=runCase(output,manifest.caseIds[0],fake);
 assert.equal(record.status,'blocked'); assert.equal(fake.calls.some(x=>x.args.includes('amy-run')),false);
});
test('timeout сохраняется как blocked и контейнер удаляется',t=>{
 const output=workspace(t);const {manifest}=prepare(output);
 const fake=fakeDocker(output,'',{result:{status:null,stdout:'',stderr:'timeout',error:new Error('ETIMEDOUT')}});
 const record=runCase(output,manifest.caseIds[0],fake);
 assert.equal(record.status,'blocked');assert.match(record.reason,/ETIMEDOUT/);
 assert.equal(fake.calls.at(-1).args[0],'rm');
});
test('изменённый fixture не запускается',t=>{
 const output=workspace(t);const {manifest}=prepare(output);writeFileSync(join(output,'fixture/user.txt'),'unexpected');
 const fake=fakeDocker(output,'');assert.throws(()=>runCase(output,manifest.caseIds[0],fake),/changed/);assert.equal(fake.calls.length,0);
});
test('изменение файла агентом отклоняет успешный самоотчёт',t=>{
 const output=workspace(t);prepare(output);const fake=fakeDocker(output,transcript(decision),{mutate:fixture=>writeFileSync(join(fixture,'unexpected.txt'),'changed')});
 assert.equal(runCase(output,'route-project-changes-04',fake).status,'fail');
});
test('подмена pass в отчёте обнаруживается по raw events',t=>{
 const output=workspace(t);prepare(output);const fake=fakeDocker(output,transcript({...decision,clarification:'required'}));
 const record=runCase(output,'route-project-changes-04',fake);record.status='pass';writeFileSync(join(output,'runs/route-project-changes-04.json'),JSON.stringify(record));
 assert.throws(()=>summarize(output),/contradicts/);
});
test('case ID с traversal и неправильные CLI команды отклоняются',t=>{
 const output=workspace(t);prepare(output);assert.throws(()=>runCase(output,'../bad'),/Unknown/);
 assert.throws(()=>main(['bad']));assert.throws(()=>main(['check','extra']));
});
test('фактическая конфигурация и сохранение пользовательских файлов проверяются независимо',()=>{
 const before={'user-notes.txt':'old','skills/file':'same'}; const after={...before,'.editorconfig':'new'};
 const content='root = true\n\n[*]\nindent_style = space\nindent_size = 2\n';
 assert.deepEqual(checkConfigArtifacts(before,after,content),{onlyAuthorizedFile:true,correctContent:true,changes:['.editorconfig']});
 assert.equal(checkConfigArtifacts(before,{...after,'user-notes.txt':'changed'},content).onlyAuthorizedFile,false);
 assert.equal(checkConfigArtifacts(before,after,content.replace('= 2','= 4')).correctContent,false);
 assert.equal(checkConfigArtifacts(before,after,content+'unknown = bad\n').correctContent,false);
 assert.equal(checkConfigArtifacts(before,before,content).onlyAuthorizedFile,false);
});
test('подменённые expectations и prompt отклоняются до запуска модели',t=>{
 const output=workspace(t); const {manifest}=prepare(output); const id=manifest.caseIds[0];
 const fake=fakeDocker(output,''); const path=join(output,'expectations.json'); const original=readFileSync(path,'utf8');
 writeFileSync(path,original+' ');assert.throws(()=>runCase(output,id,fake),/Expectations changed/);
 writeFileSync(path,original);writeFileSync(join(output,'prompts',id+'.txt'),'changed');
 assert.throws(()=>runCase(output,id,fake),/Prompt changed/);assert.equal(fake.calls.length,0);
});
test('плохой manifest отчёта отклоняется',t=>{
 const output=workspace(t); const {manifest}=prepare(output);
 manifest.caseIds.push(manifest.caseIds[0]);writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest));
 assert.throws(()=>summarize(output),/Invalid report manifest/);
});
test('параметр с похожим префиксом не считается поддержкой CLI',()=>{
 assert.throws(()=>checkCapabilities({status:0,stdout:requiredFlags.map(x=>x==='--json'?'--json-other':x).join('\n')}),/missing.*--json/);
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
test('execution: фактический patch, содержимое и сохранение файлов проходят полный цикл',t=>{
 const output=workspace(t); prepareExecution(output);
 const id='route-project-changes-01';const expected=JSON.parse(readFileSync(join(output,'expectations.json'),'utf8'))[0];
 const d=expected.contract.decisions[0];const reads=[...d.selectedSkills.map(n=>'skills/'+n+'/SKILL.md'),...expected.contract.requiredReads];
 const patch={type:'item.completed',item:{id:'patch',type:'file_change',status:'completed',changes:[{path:'.editorconfig',kind:'add'}]}};
 const data=transcript(d,reads,join(output,'fixture'),[patch]);
 const fake=fakeDocker(output,data,{mutate:fixture=>writeFileSync(join(fixture,'.editorconfig'),'root=true\n[*]\nindent_style=space\nindent_size=2\n')});
 const record=runCase(output,id,fake);
 assert.equal(record.status,'pass');assert.equal(record.artifacts.onlyAuthorizedFile,true);assert.equal(record.artifacts.correctContent,true);
 assert.ok(existsSync(join(output,'before.json')));assert.ok(existsSync(join(output,'after.json')));
 assert.equal(summarize(output).counts.pass,1);
 const call=fake.calls.find(x=>x.args.includes('amy-run'));assert.ok(call.args.includes('workspace-write'));assert.ok(call.args.some(x=>x.endsWith('target=/workspace')));
});
test('execution: побочная правка пользовательского файла даёт fail',t=>{
 const output=workspace(t);prepareExecution(output);const id='route-project-changes-01';
 const expected=JSON.parse(readFileSync(join(output,'expectations.json'),'utf8'))[0];const d=expected.contract.decisions[0];
 const reads=[...d.selectedSkills.map(n=>'skills/'+n+'/SKILL.md'),...expected.contract.requiredReads];
 const fake=fakeDocker(output,transcript(d,reads,join(output,'fixture')),{mutate:fixture=>{
  writeFileSync(join(fixture,'.editorconfig'),'root = true\n[*]\nindent_style = space\nindent_size = 2\n');writeFileSync(join(fixture,'user-notes.txt'),'overwritten');
 }});
 assert.equal(runCase(output,id,fake).status,'fail'); assert.equal(summarize(output).counts.fail,1);
});
test('execution: события запрещённой правки и отказ sandbox не доказывают compliance',()=>{
 const patch={type:'item.completed',item:{id:'patch',type:'file_change',status:'failed',changes:[{path:'user-notes.txt',kind:'update'}]}};
 const evidence=observeEvents(transcript(decision,[],root,[patch]),root,'execution');
 assert.equal(evidence.violations.length,1);
});
test('неизвестный lifecycle event и незавершённое действие требуют review',()=>{
 for(const extra of [[{type:'future.event'}],[{type:'item.started',item:{id:'unfinished',type:'command_execution',command:'ls'}}]]){
  const evidence=observeEvents(transcript(decision,[],root,extra),root);
  assert.equal(gradeDecision(decision,contract,evidence,names).status,'needs-review');
 }
});
test('неподдержанное чтение не превращается в подтверждённый провал модели',()=>{
 const item=caseById('develop-effector-model-01');
 const evidence={...clean,unknown:[{command:'custom-reader'}]};
 const graded=gradeDecision(item.contract.decisions[0],item.contract,evidence,names);
 assert.equal(graded.status,'needs-review');assert.equal(graded.criteria.skillReads,'unobserved');
});
for(const response of ['null','false','0','[]','{}'])test('JSON '+response+' с неверной формой считается fail',t=>{
 const output=workspace(t);prepare(output);const fake=fakeDocker(output,transcript(response));
 assert.equal(runCase(output,'route-project-changes-04',fake).status,'fail');
 assert.equal(summarize(output).counts.fail,1);
});
