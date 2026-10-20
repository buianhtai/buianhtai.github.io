import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCurriculum} from '../../scripts/mindforge/math-content-validate.mjs';

const data=JSON.parse(readFileSync(new URL('../../public/mindforge/arcade/math/content/v1/topics.json',import.meta.url),'utf8'));
const edit=mutate=>{const x=structuredClone(data);mutate(x);return validateCurriculum(x);};

test('original curriculum passes mathematical and translation validation',()=>{
 assert.deepEqual(validateCurriculum(data),[]);
 assert.equal(data.topics.length,3);
 for(const topic of data.topics){assert.equal(topic.lessons.length,3);assert.equal(topic.examples.length,6);}
});
test('missing Vietnamese translation is rejected',()=>{
 assert.ok(edit(x=>{x.topics[0].name.vi='';}).some(e=>e.includes('translation')));
});
test('wrong count answer is rejected',()=>{
 assert.ok(edit(x=>{x.topics[0].examples[0].answerSpec.value=10;}).some(e=>e.includes('does not match')));
});
test('incorrect comparison direction is rejected',()=>{
 assert.ok(edit(x=>{x.topics[1].examples[0].answerSpec.value='left';}).some(e=>e.includes('larger group')));
});
test('number-bond complement must sum to 10',()=>{
 assert.ok(edit(x=>{x.topics[2].examples[1].answerSpec.value=8;}).some(e=>e.includes('does not match')));
});
test('visual counts cannot be negative or above ten',()=>{
 assert.ok(edit(x=>{x.topics[1].examples[3].manipulative.counts=[-1,11];}).some(e=>e.includes('0..10')));
});
test('invalid ten-frame target is rejected',()=>{
 assert.ok(edit(x=>{x.topics[2].examples[0].manipulative.target=11;}).some(e=>e.includes('target must be ten')));
});
test('duplicates and missing lessons are rejected',()=>{
 const errors=edit(x=>{x.topics[0].examples[1].id=x.topics[0].examples[0].id;x.topics[1].lessons.pop();});
 assert.ok(errors.some(e=>e.includes('duplicate id')));
 assert.ok(errors.some(e=>e.includes('at least three guided lessons')));
});
test('untrusted HTML markup in educational text is rejected',()=>{
 assert.ok(edit(x=>{x.topics[0].examples[0].prompt.en='<img src=x onerror=alert(1)>';}).some(e=>e.includes('untrusted HTML')));
});
test('negative fixture demonstrates failing verification gate',()=>{
 const errors=edit(x=>{x.topics[2].examples[0].answerSpec.value=-9;});
 assert.notEqual(errors.length,0);
});
