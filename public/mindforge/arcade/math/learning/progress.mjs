/**
 * MindForge visual practice and mistake review, versioned local-only data.
 * No PII or remote analytics. Legacy mf-math-quest-v1 is never overwritten.
 */
export const KEY='mf-math-learning-v1';
export const MAX_ATTEMPTS=200;
export const MAX_MISSES=60;
export const TOPICS=['count-to-10','compare-to-10','bonds-to-10'];
export const defaults=()=>({schemaVersion:1,attempts:[],mistakes:[],session:null,preferences:{autoNext:true}});
const topic=x=>TOPICS.includes(x);
const num=x=>Number.isInteger(x)&&x>=0&&x<=4294967295;
const small=x=>Number.isInteger(x)&&x>=0&&x<=10000;
const diff=x=>['starter','normal','advanced'].includes(x);
const mode=x=>['practice','review'].includes(x);
const safeId=id=>typeof id==='string'&&/^[a-z0-9-]{1,120}$/.test(id);
export function sanitize(v){
 const out=defaults();
 if(!v||v.schemaVersion!==1||typeof v!=='object')return out;
 if(v.preferences&&typeof v.preferences.autoNext==='boolean')out.preferences.autoNext=v.preferences.autoNext;
 if(Array.isArray(v.attempts)){
  out.attempts=v.attempts.filter(a=>a&&topic(a.topicId)&&diff(a.difficulty)&&num(a.seed)&&small(a.index)&&
   typeof a.correct==='boolean'&&Number.isFinite(a.timestamp)&&a.timestamp>=0&&
   typeof a.hintUsed==='boolean'&&small(a.tries)&&a.tries<=2&&
   (typeof a.answer==='number'||typeof a.answer==='string'||a.answer===null))
  .map(a=>({topicId:a.topicId,difficulty:a.difficulty,seed:a.seed,index:a.index,correct:a.correct,hintUsed:a.hintUsed,tries:a.tries,answer:a.answer,timestamp:a.timestamp}))
  .slice(-MAX_ATTEMPTS);
 }
 if(Array.isArray(v.mistakes)){
  const seen=new Set();
  out.mistakes=v.mistakes.filter(a=>a&&topic(a.topicId)&&diff(a.difficulty)&&num(a.seed)&&small(a.index))
   .filter(a=>{const id=a.topicId+':'+a.difficulty+':'+a.seed+':'+a.index;if(seen.has(id))return false;seen.add(id);return true})
   .map(a=>({topicId:a.topicId,difficulty:a.difficulty,seed:a.seed,index:a.index}))
   .slice(-MAX_MISSES);
 }
 const s=v.session;
 if(s&&topic(s.topicId)&&diff(s.difficulty)&&mode(s.mode)&&num(s.seed)&&small(s.index)&&s.index<=10&&
    Array.isArray(s.questions)&&s.questions.length>0&&s.questions.length<=10&&s.questions.every(q=>q&&topic(q.topicId)&&num(q.seed)&&small(q.index)&&diff(q.difficulty))&&
    small(s.score)&&small(s.tries)&&s.tries<=2&&
    typeof s.finished==='boolean'){
   out.session={topicId:s.topicId,difficulty:s.difficulty,mode:s.mode,seed:s.seed,index:s.index,questions:s.questions.map(q=>({topicId:q.topicId,difficulty:q.difficulty,seed:q.seed,index:q.index})),score:s.score,tries:s.tries,finished:s.finished,answer:typeof s.answer==='number'||typeof s.answer==='string'?s.answer:null,feedback:['correct','wrong','revealed',null].includes(s.feedback)?s.feedback:null,hintUsed:!!s.hintUsed,reviewOf:safeId(s.reviewOf)?s.reviewOf:null};
 }
 return out;
}
export function storageKey(storage=globalThis.localStorage){
 try{const profile=JSON.parse(storage.getItem('mindforge-data-v1')||'null');const id=profile?.activeId;if(typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id))return KEY+'-'+id}catch{}
 return KEY;
}
export function read(storage=globalThis.localStorage){
 try{return sanitize(JSON.parse(storage.getItem(storageKey(storage))||'null'))}catch{return defaults()}
}
export function write(data,storage=globalThis.localStorage){
 const value=sanitize(data);try{storage.setItem(storageKey(storage),JSON.stringify(value));return true}catch{return false}
}
export function createSession({topicId='count-to-10',difficulty='starter',mode='practice',seed=1,questions=null}={}){
 if(!topic(topicId)||!diff(difficulty)||!['practice','review'].includes(mode)||!num(seed))throw Error('Invalid session');
 const entries=Array.isArray(questions)?questions:Array.from({length:7},(_,i)=>({topicId,difficulty,seed:(seed+i)>>>0,index:i}));
 if(entries.length<1||entries.length>10||entries.some(q=>!topic(q.topicId)||!num(q.seed)||!small(q.index)||!diff(q.difficulty)))throw Error('Invalid questions');
 return {topicId,difficulty,mode,seed,index:0,questions:entries.map(q=>({topicId:q.topicId,seed:q.seed,index:q.index,difficulty:q.difficulty})),score:0,tries:0,finished:false,answer:null,feedback:null,hintUsed:false,reviewOf:null};
}
export const keyFor=q=>q.topicId+':'+q.difficulty+':'+q.seed+':'+q.index;
export function recordAnswer(store,q,{answer=null,correct=false,hintUsed=false,tries=1}={}){
 const updated=sanitize(store);
 if(!q||!topic(q.topicId)||!diff(q.difficulty)||!num(q.seed)||!small(q.index))throw Error('Invalid question');
 const item={topicId:q.topicId,difficulty:q.difficulty,seed:q.seed,index:q.index,answer:typeof answer==='number'||typeof answer==='string'?answer:null,correct:!!correct,hintUsed:!!hintUsed,tries:Math.max(1,Math.min(2,Number.isInteger(tries)?tries:1)),timestamp:Date.now()};
 updated.attempts.push(item);
 updated.attempts=updated.attempts.slice(-MAX_ATTEMPTS);
 const key=keyFor(q);
 if(!correct&&!updated.mistakes.some(x=>keyFor(x)===key))updated.mistakes.push({topicId:q.topicId,difficulty:q.difficulty,seed:q.seed,index:q.index});
 if(correct){const index=updated.mistakes.findIndex(x=>x.topicId===q.topicId);if(index>=0)updated.mistakes.splice(index,1);}
 updated.mistakes=updated.mistakes.slice(-MAX_MISSES);
 return updated;
}
export function reviewQuestions(store,{max=7}={}){
 const v=sanitize(store);
 return v.mistakes.slice(0,Math.max(1,Math.min(10,max))).map((m,i)=>({
  topicId:m.topicId,difficulty:m.difficulty,
  seed:(m.seed+1009+(i*23))>>>0,index:m.index+1
 }));
}
export function summary(store){
 const v=sanitize(store),topics={};
 for(const id of TOPICS)topics[id]={attempts:0,correct:0,afterRetry:0,unresolved:v.mistakes.filter(m=>m.topicId===id).length};
 for(const a of v.attempts){const t=topics[a.topicId];t.attempts++;if(a.correct)t.correct++;if(a.correct&&a.tries>1)t.afterRetry++;}
 return {attempts:v.attempts.length,correct:v.attempts.filter(a=>a.correct).length,topics,unresolved:v.mistakes.length,lastPlayed:v.attempts.at(-1)?.timestamp||null};
}
export function exportData(store){return JSON.stringify(sanitize(store),null,2)}
export function clearProgress(store){return {...defaults(),preferences:{autoNext:sanitize(store).preferences.autoNext}}}
