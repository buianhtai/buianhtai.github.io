import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOPICS,MAX_ATTEMPTS,MAX_MISSES,defaults,sanitize,read,write,createSession,recordAnswer,reviewQuestions,summary,clearProgress,exportData} from '../../public/mindforge/arcade/math/learning/progress.mjs';
import {generateQuestion,evaluateQuestion,validateQuestion} from '../../public/mindforge/arcade/math/learning/engine.mjs';

function memory(){
 const saved=new Map();
 return {getItem:k=>saved.has(k)?saved.get(k):null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
}
test('practice and review routes resolve the same validated module paths',()=>{
 for(const route of ['practice','review']){
  const page=readFileSync(new URL('../../public/mindforge/arcade/math/'+route+'/index.html',import.meta.url),'utf8');
  assert.match(page,/src="\.\.\/learning\/flow\.mjs"/);
  assert.match(page,/href="\.\.\/learning\/flow\.css"/);
 }
 const js=readFileSync(new URL('../../public/mindforge/arcade/math/learning/flow.mjs',import.meta.url),'utf8');
 assert.match(js,/evaluateQuestion\(q,chosen\)/);
 assert.match(js,/recordAnswer\(store,q/);
 assert.match(js,/reviewQuestions\(store/);
 assert.match(js,/newSession\(\)/);
});
test('generated practice tasks are uniquely seeded with valid mathematical options',()=>{
 for(const id of TOPICS){
  let distinct=new Set();
  for(let seed=0;seed<1500;seed++){
   const q=generateQuestion(id,{seed,index:seed%7,difficulty:'normal'});
   assert.deepEqual(validateQuestion(q),[]);
   assert.equal(evaluateQuestion(q,q.answerSpec.value),true);
   distinct.add(q.id);
  }
  assert.equal(distinct.size,1500);
 }
});
test('session and auto-next preference survive reload; legacy Math Quest key is untouched',()=>{
 const storage=memory();storage.setItem('mf-math-quest-v1','legacy-saved-score');
 let store=read(storage);
 store.preferences.autoNext=false;
 store.session=createSession({topicId:'bonds-to-10',seed:234});
 store.session.index=3;store.session.score=20;
 assert.equal(write(store,storage),true);
 const recovered=read(storage);
 assert.equal(recovered.session.seed,234);
 assert.equal(recovered.session.index,3);
 assert.equal(recovered.session.score,20);
 assert.equal(recovered.preferences.autoNext,false);
 assert.equal(storage.getItem('mf-math-quest-v1'),'legacy-saved-score');
});
test('missed concepts create a review queue with fresh seed and are reduced after correct review',()=>{
 let store=defaults();
 const missed=[
  {topicId:'count-to-10',difficulty:'starter',seed:9,index:0},
  {topicId:'compare-to-10',difficulty:'normal',seed:20,index:1},
  {topicId:'count-to-10',difficulty:'starter',seed:15,index:2}
 ];
 for(const q of missed)store=recordAnswer(store,q,{answer:5,correct:false,tries:2,hintUsed:true});
 assert.equal(store.mistakes.length,3);
 const review=reviewQuestions(store,{max:7});
 assert.equal(review.length,3);
 assert.notEqual(review[0].seed,missed[0].seed);
 for(const q of review)assert.deepEqual(validateQuestion(generateQuestion(q.topicId,q)),[]);
 store=recordAnswer(store,review[0],{answer:7,correct:true,tries:2});
 assert.equal(store.mistakes.length,2);
 assert.equal(store.mistakes.filter(q=>q.topicId==='count-to-10').length,1);
 const info=summary(store);
 assert.equal(info.attempts,4);assert.equal(info.correct,1);
 assert.equal(info.topics['count-to-10'].afterRetry,1);
});
test('storage retention, corrupted state, and reset/export are bounded',()=>{
 let store=defaults();
 for(let i=0;i<300;i++)store=recordAnswer(store,{topicId:'count-to-10',difficulty:'starter',seed:i,index:0},{answer:1,correct:false,tries:2});
 assert.equal(store.attempts.length,MAX_ATTEMPTS);
 assert.equal(store.mistakes.length,MAX_MISSES);
 const restored=sanitize({...store,session:{foo:'bad'}});
 assert.equal(restored.session,null);
 assert.equal(JSON.parse(exportData(store)).mistakes.length,MAX_MISSES);
 assert.equal(clearProgress(store).attempts.length,0);
 const m=memory();m.setItem('mf-math-learning-v1','broken{');
 assert.equal(read(m).attempts.length,0);
});
test('invalid Math Learning session construction fails closed',()=>{
 assert.throws(()=>createSession({topicId:'insecure'}));
 assert.throws(()=>createSession({difficulty:'expert'}));
 assert.throws(()=>createSession({questions:[]}));
 assert.throws(()=>createSession({seed:-1}));
});
