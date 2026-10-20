import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TASK_IDS,LABELS,getBlockers,resolvePlan,labelDiff} from '../../scripts/mindforge/math-task-coordinator.mjs';

const issue=(number,state='open',blockers=[],labels=[])=>({
 number,state,labels:labels.map(name=>({name})),
 body:'## Objective\nMath work\n\n## Blocked by\n'+(blockers.length?blockers.map(n=>'- #'+n).join('\n'):'None')+'\n\n## Release notes\n- PR #900 is NOT a dependency.\n'
});
const fixture=()=>[
 issue(120),issue(121,'closed'),issue(122,'open',[121],[LABELS.merged]),
 issue(123,'open',[121],[LABELS.merged]),issue(124,'open',[121,123]),
 issue(125,'open',[121,122,123]),issue(126,'open',[125]),issue(127,'open',[124,125,126])
];

test('allowlist prevents accidental mutation of non-Math issues',()=>{
 assert.deepEqual(TASK_IDS,[120,121,122,123,124,125,126,127]);
 assert.equal(TASK_IDS.includes(82),false);
});
test('read only ## Blocked by section and reject unrelated refs',()=>{
 assert.deepEqual(getBlockers(issue(124,'open',[121,123]).body),{ids:[121,123]});
 assert.deepEqual(getBlockers(issue(120).body),{ids:[]});
 assert.deepEqual(getBlockers('## Blocked by\n- #121\n- #121\n\n## Note\n- #999'),{ids:[121]});
});
test('missing or malformed dependency declarations fail closed',()=>{
 assert.match(getBlockers('hello world').error,/missing/);
 assert.match(getBlockers('## Blocked by\n- something').error,/invalid|no valid/);
});
test('merged implementation can unblock engineering without closing QA issue',()=>{
 const statuses=resolvePlan(fixture());
 const byId=Object.fromEntries(statuses.map(x=>[x.id,x]));
 assert.equal(byId[120].status,'ready');
 assert.equal(byId[121].status,'done');
 assert.equal(byId[122].status,'implementation-merged');
 assert.equal(byId[123].status,'implementation-merged');
 assert.equal(byId[124].status,'ready');
 assert.equal(byId[125].status,'ready');
 assert.deepEqual(byId[126].blockers,[125]);
 assert.equal(byId[127].status,'blocked');
});
test('remove implementation-merged flag and both downstream jobs block',()=>{
 const issues=fixture().map(x=>structuredClone(x));issues.find(i=>i.number===123).labels=[];
 const status=resolvePlan(issues);
 assert.deepEqual(status.find(x=>x.id===124).blockers,[123]);
 assert.deepEqual(status.find(x=>x.id===125).blockers,[123]);
});
test('building/QA/review labels never get rewritten as ready',()=>{
 const items=fixture();items.find(i=>i.number===124).labels=[{name:LABELS.qa}];
 const r=resolvePlan(items).find(x=>x.id===124);
 assert.equal(r.status,'in-progress');
 assert.deepEqual(labelDiff(items.find(x=>x.number===124),r),{add:[],remove:[]});
});
test('stale labels are removed with idempotent changes',()=>{
 const items=fixture();const item=items.find(i=>i.number===124);item.labels=[{name:LABELS.blocked}];
 const r=resolvePlan(items).find(x=>x.id===124);
 assert.deepEqual(labelDiff(item,r),{add:[LABELS.ready],remove:[LABELS.blocked]});
 item.labels=[{name:LABELS.ready}];
 assert.deepEqual(labelDiff(item,r),{add:[],remove:[]});
});
test('unknown blocker or task stays blocked, does not trigger an agent',()=>{
 const items=fixture();items.find(i=>i.number===124).body='## Blocked by\n- #9999\n';
 const result=resolvePlan(items).find(x=>x.id===124);
 assert.equal(result.status,'blocked');assert.deepEqual(result.blockers,[9999]);
 const missing=resolvePlan(items.filter(x=>x.number!==123)).find(x=>x.id===123);
 assert.equal(missing.status,'blocked');assert.match(missing.error,/missing/);
});
test('wrong issue states stay blocked even with a PR reference in an unrelated section',()=>{
 const items=fixture();items.find(x=>x.number===123).labels=[];
 items.find(x=>x.number===123).body+='PR #131 has been merged, but QA pending.';
 const item=resolvePlan(items).find(x=>x.id===124);
 assert.equal(item.status,'blocked');
});
