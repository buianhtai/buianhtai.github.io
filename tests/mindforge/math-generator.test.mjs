import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TOPIC_IDS, DIFFICULTIES, generateQuestion,generateSet,evaluateQuestion,validateQuestion}
 from '../../public/mindforge/arcade/math/learning/engine.mjs';

for(const topic of TOPIC_IDS){
 for(const level of DIFFICULTIES){
  test(topic+' / '+level+': 1,200 reproducible valid questions',()=>{
   const seen=new Set(),counts=new Set(),variants=new Set();
   for(let seed=0;seed<1200;seed++){
    const q=generateQuestion(topic,{seed,index:seed,difficulty:level});
    assert.deepEqual(validateQuestion(q),[], 'Failed seed '+seed+': '+JSON.stringify(q));
    assert.deepEqual(q,generateQuestion(topic,{seed,index:seed,difficulty:level}),'not replayable: '+seed);
    assert.equal(evaluateQuestion(q,q.answerSpec.value),true,'right answer rejected: '+seed);
    for(const option of q.options)if(option.value!==q.answerSpec.value)assert.equal(evaluateQuestion(q,option.value),false,'wrong answer accepted: '+seed);
    assert.equal(q.options.length,4-Number(q.answerSpec.kind==='side'));
    assert.equal(new Set(q.options.map(x=>x.value)).size,q.options.length);
    seen.add(q.id);counts.add(q.manipulative.counts.join(':'));
    variants.add(q.manipulative.visual.tokenId+':'+q.manipulative.visual.palette);
   }
   assert.equal(seen.size,1200);
   assert.ok(counts.size>=10,topic+' repeated the same calculation too often');
   assert.ok(variants.size>=16,topic+' did not vary illustration themes');
  });
 }
}
test('explicit option formats, zero and misleading strings are handled safely',()=>{
 const zero={...generateQuestion('count-to-10'),answerSpec:{kind:'number',value:0}};
 assert.equal(evaluateQuestion(zero,0),true);
 assert.equal(evaluateQuestion(zero,'0'),true);
 for(const input of ['','-1','0.0','1e2','Infinity','<img>','  ','foo',null,undefined])assert.equal(evaluateQuestion(zero,input),false);
 const q=generateQuestion('compare-to-10',{seed:11});
 assert.equal(evaluateQuestion(q,q.answerSpec.value),true);
 assert.equal(evaluateQuestion(q,'LEFT'),false);
});
test('tampered mathematical answers, ambiguous options and missing languages fail',()=>{
 for(const topic of TOPIC_IDS){
  const q=generateQuestion(topic,{seed:93});
  const wrong=structuredClone(q);
  wrong.answerSpec.value=topic==='compare-to-10'?(q.answerSpec.value==='left'?'right':'left'):(q.answerSpec.value===10?0:q.answerSpec.value+1);
  assert.ok(validateQuestion(wrong).some(x=>x.includes('incorrect')));
  const dup=structuredClone(q);dup.options[1]=structuredClone(dup.options[0]);
  assert.ok(validateQuestion(dup).some(x=>x.includes('duplicate')));
  const loc=structuredClone(q);loc.prompt.vi='';
  assert.ok(validateQuestion(loc).some(x=>x.includes('translation')));
  const bad=structuredClone(q);bad.manipulative.counts[0]=11;
  assert.ok(validateQuestion(bad).some(x=>x.includes('invalid manipulative')));
 }
});
test('range guards and generated sets prevent invalid input',()=>{
 for(const topic of TOPIC_IDS){
  const qs=generateSet(topic,{seed:17,count:100});
  assert.equal(qs.length,100);
  assert.equal(new Set(qs.map(q=>q.id)).size,100);
 }
 assert.throws(()=>generateQuestion('other'),RangeError);
 assert.throws(()=>generateQuestion('count-to-10',{difficulty:'expert'}),RangeError);
 assert.throws(()=>generateQuestion('count-to-10',{seed:-1}),RangeError);
 assert.throws(()=>generateSet('bonds-to-10',{count:0}),RangeError);
});
