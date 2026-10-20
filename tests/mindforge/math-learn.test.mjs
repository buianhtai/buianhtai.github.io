import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {generateQuestion,validateQuestion} from '../../public/mindforge/arcade/math/learning/engine.mjs';
import {renderTenFrame,renderCompare} from '../../public/mindforge/arcade/math/learning/manipulatives.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const data=JSON.parse(readFileSync(root+'public/mindforge/arcade/math/content/v1/topics.json','utf8'));
const html=readFileSync(root+'public/mindforge/arcade/math/learn/index.html','utf8');
const script=readFileSync(root+'public/mindforge/arcade/math/learn/app.mjs','utf8');
const entry=readFileSync(root+'public/mindforge/arcade/math/index.html','utf8');

test('three Learn topics with three interactive lessons and bilingual steps',()=>{
 assert.equal(data.schemaVersion,1);
 assert.equal(data.topics.length,3);
 for(const topic of data.topics){
  assert.equal(topic.lessons.length,3);
  for(const lesson of topic.lessons){
   assert.deepEqual(lesson.steps.map(x=>x.mode),['explain','try','reflect']);
   assert.ok(lesson.title.en&&lesson.title.vi);
   const s=lesson.steps[1];assert.ok(s.manipulative&&s.answerSpec&&s.explanation.en&&s.explanation.vi);
  }
 }
});
test('the actual SVG components render every lesson model without exceptions',()=>{
 for(const topic of data.topics)for(const lesson of topic.lessons){
  for(const step of lesson.steps){
   if(!step.manipulative)continue;
   const m=step.manipulative;
   const result=m.kind==='two-groups'?renderCompare(m.counts[0],m.counts[1],{language:'vi'}):renderTenFrame(m.counts[0],{language:'vi'});
   assert.ok(result.includes('aria-label'));
   assert.ok(result.includes('data-mf-cell'));
   assert.ok(!result.includes('undefined'));
  }
 }
});
test('all guided practice questions have mathematically correct answers',()=>{
 for(const topic of data.topics)for(const lesson of topic.lessons){
  const item=lesson.steps[1];const counts=item.manipulative.counts,answer=item.answerSpec;
  if(topic.id==='count-to-10')assert.equal(answer.value,counts[0]);
  else if(topic.id==='bonds-to-10')assert.equal(answer.value,10-counts[0]);
  else assert.equal(answer.value,counts[0]===counts[1]?'equal':counts[0]>counts[1]?'left':'right');
 }
});
test('Learn route, language and local progress are discoverable without changing Math Quest',()=>{
 assert.match(html,/<script type="module" src="\.\/app\.mjs"/);
 assert.match(entry,/href="\.\/learn\/"/);
 assert.match(script,/mf-math-learn-v1/);
 assert.match(script,/mf-library-theme/);
 assert.match(script,/mountTenFrame/);
 assert.match(script,/mountCompare/);
 assert.match(script,/data-answer/);
 assert.match(script,/outcome==='correct'/);
 assert.match(script,/fetch\('\.\.\/content\/v1\/topics\.json'\)/);
 for(const topic of data.topics)assert.match(script,new RegExp(topic.id));
});
test('existing random question engine remains valid after adding lessons',()=>{
 for(let i=0;i<120;i++)for(const id of ['count-to-10','compare-to-10','bonds-to-10']){
  assert.deepEqual(validateQuestion(generateQuestion(id,{seed:i,index:i})),[]);
 }
});
