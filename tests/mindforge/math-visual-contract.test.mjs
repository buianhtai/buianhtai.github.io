import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOPIC_IDS,generateQuestion} from '../../public/mindforge/arcade/math/learning/engine.mjs';

const schema=JSON.parse(readFileSync(new URL('../../public/mindforge/arcade/math/content/v1/contract.schema.json',import.meta.url),'utf8'));
const defs=schema.$defs.manipulative.properties.visual;

test('optional visual metadata is declared with the same values as generated questions',()=>{
 assert.equal(defs.type,'object');
 assert.equal(defs.additionalProperties,false);
 for(const key of ['tokenId','palette','arrangement','flip'])assert.ok(defs.required.includes(key));
 for(const id of TOPIC_IDS)for(let seed=0;seed<100;seed++){
  const vis=generateQuestion(id,{seed}).manipulative.visual;
  assert.deepEqual(Object.keys(vis).sort(),[...defs.required].sort());
  for(const [key,value] of Object.entries(vis)){
   const rule=defs.properties[key];
   if(rule.enum)assert.ok(rule.enum.includes(value),key+': '+value);
   if(rule.type==='boolean')assert.equal(typeof value,'boolean');
  }
 }
});
test('existing lesson fixtures without visual metadata stay compatible',()=>{
 const data=JSON.parse(readFileSync(new URL('../../public/mindforge/arcade/math/content/v1/topics.json',import.meta.url),'utf8'));
 for(const topic of data.topics)for(const q of topic.examples){
  assert.ok(q.manipulative&&!('visual' in q.manipulative));
 }
 assert.ok(!schema.$defs.manipulative.required.includes('visual'));
});
