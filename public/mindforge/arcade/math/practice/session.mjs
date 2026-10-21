/** Standalone, deterministic Practice session. Never reads or writes legacy Math Quest state. */
import {TOPIC_IDS,DIFFICULTIES,generateQuestion,evaluateQuestion} from '../learning/engine.mjs';
export const STORAGE_KEY='mf-math-practice-v1';
const validInt=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export function createSession({topicId='count-to-10',difficulty='starter',seed=1,total=5,autoNext=false}={}){
 if(!TOPIC_IDS.includes(topicId)||!DIFFICULTIES.includes(difficulty)||!validInt(seed,0,0xffffffff)||!validInt(total,1,10)||typeof autoNext!=='boolean')throw new RangeError('Invalid Practice session options');
 return {version:1,topicId,difficulty,seed,total,autoNext,position:0,selected:null,attempts:0,hints:0,correct:false,revealed:false,results:[]};
}
export function currentQuestion(session){
 if(session.position>=session.total)return null;
 return generateQuestion(session.topicId,{seed:(session.seed+session.position)>>>0,index:session.position,difficulty:session.difficulty});
}
export function chooseAnswer(session,value){
 if(session.correct||session.revealed||session.position>=session.total)return session;
 const q=currentQuestion(session);
 if(!q.options.some(o=>o.value===value&&typeof o.value===typeof value))return session;
 return {...session,selected:value};
}
export function requestHint(session){
 if(session.correct||session.revealed||session.position>=session.total)return session;
 return {...session,hints:Math.min(2,session.hints+1)};
}
export function submitAnswer(session){
 if(session.correct||session.revealed||session.selected===null||session.position>=session.total)return session;
 const q=currentQuestion(session);
 if(evaluateQuestion(q,session.selected))return {...session,correct:true};
 const attempts=session.attempts+1;
 return {...session,attempts,selected:null,revealed:attempts>=2};
}
export function canAdvance(session){return session.position<session.total&&(session.correct||session.revealed)}
export function advance(session){
 if(!canAdvance(session))return session;
 const q=currentQuestion(session);
 const result={id:q.id,correct:session.correct,attempts:session.attempts,hints:session.hints};
 return {...session,position:session.position+1,selected:null,attempts:0,hints:0,correct:false,revealed:false,results:[...session.results,result]};
}
export function setAutoNext(session,value){return typeof value==='boolean'?{...session,autoNext:value}:session}
export function restoreSession(raw){
 try{
  const obj=typeof raw==='string'?JSON.parse(raw):raw;
  if(!obj||obj.version!==1)return null;
  const fresh=createSession(obj);
  if(!validInt(obj.position,0,fresh.total)||!validInt(obj.attempts,0,2)||!validInt(obj.hints,0,2)||typeof obj.correct!=='boolean'||typeof obj.revealed!=='boolean'||obj.correct&&obj.revealed)return null;
  if(!Array.isArray(obj.results)||obj.results.length!==obj.position||obj.results.some((r,i)=>r?.id!==generateQuestion(fresh.topicId,{seed:(fresh.seed+i)>>>0,index:i,difficulty:fresh.difficulty}).id||typeof r.correct!=='boolean'||!validInt(r.attempts,0,2)||!validInt(r.hints,0,2)))return null;
  if(obj.position===obj.total&&(obj.selected!==null||obj.correct||obj.revealed||obj.attempts||obj.hints))return null;
  if(obj.position<obj.total){
   const q=generateQuestion(fresh.topicId,{seed:(fresh.seed+obj.position)>>>0,index:obj.position,difficulty:fresh.difficulty});
   if(obj.selected!==null&&!q.options.some(o=>o.value===obj.selected&&typeof o.value===typeof obj.selected))return null;
  }
  return {...fresh,position:obj.position,selected:obj.selected,attempts:obj.attempts,hints:obj.hints,correct:obj.correct,revealed:obj.revealed,results:obj.results.map(r=>({...r}))};
 }catch{return null}
}
