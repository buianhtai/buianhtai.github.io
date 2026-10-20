#!/usr/bin/env node
/**
 * Versioned Math Learning V1 content validator. Node 22, no npm dependencies.
 * Validates semantics beyond the JSON Schema (the right answer must follow
 * mathematically from the displayed manipulatives).
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const DEFAULT_FILE = fileURLToPath(new URL('../../public/mindforge/arcade/math/content/v1/topics.json', import.meta.url));
const TOPICS = new Set(['count-to-10','compare-to-10','bonds-to-10']);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const int = n => Number.isInteger(n);
const textOk = s => typeof s === 'string' && s.trim().length > 0;

export function validateCurriculum(content) {
  const errors = [], ids = new Set();
  const requireAt = (ok, path, reason) => { if (!ok) errors.push(path + ': ' + reason); };
  const localized = (val, path) => {
    requireAt(isObj(val), path, 'expected bilingual text object');
    if (isObj(val)) for (const lang of ['en','vi']) {
      requireAt(textOk(val[lang]), path + '.' + lang, 'translation required');
      if (typeof val[lang] === 'string') requireAt(!/<[a-z/!]/i.test(val[lang]), path + '.' + lang, 'untrusted HTML is not allowed');
    }
  };
  const unique = (id,path) => {
    requireAt(textOk(id), path, 'id required');
    if (textOk(id)) { requireAt(!ids.has(id),path,'duplicate id'); ids.add(id); }
  };
  const puzzle = (q, topic, path) => {
    if (!isObj(q)) {errors.push(path + ': expected puzzle object');return;}
    localized(q.prompt, path + '.prompt');
    const m=q.manipulative, a=q.answerSpec;
    requireAt(isObj(m), path + '.manipulative', 'missing visual model');
    requireAt(isObj(a), path + '.answerSpec', 'missing answer');
    if(!isObj(m)||!isObj(a))return;
    const vals=m.counts;
    requireAt(Array.isArray(vals),path+'.manipulative.counts','expected counts array');
    if(!Array.isArray(vals))return;
    requireAt(vals.every(v=>int(v)&&v>=0&&v<=10),path+'.manipulative.counts','counts must be integers in 0..10');
    requireAt(m.target===10,path+'.manipulative.target','the target must be ten');
    if(topic==='compare-to-10'){
      requireAt(m.kind==='two-groups'&&vals.length===2,path+'.manipulative','comparison requires two groups');
      if(vals.length===2&&vals.every(int)){
        const expected=vals[0]===vals[1]?'equal':vals[0]>vals[1]?'left':'right';
        requireAt(a.kind==='side'&&a.value===expected,path+'.answerSpec','answer does not match the larger group');
      }
    }else{
      requireAt(m.kind==='ten-frame'&&vals.length===1,path+'.manipulative','single ten-frame required');
      if(vals.length===1&&int(vals[0])){
        const expected=topic==='count-to-10'?vals[0]:10-vals[0];
        requireAt(a.kind==='number'&&a.value===expected,path+'.answerSpec','answer does not match visible counters');
      }
    }
    requireAt(Array.isArray(q.hintSteps)&&q.hintSteps.length>=2,path+'.hintSteps','at least two strategy hints');
    if(Array.isArray(q.hintSteps))q.hintSteps.forEach((v,i)=>localized(v,path+'.hintSteps['+i+']'));
    localized(q.explanation,path+'.explanation');
  };
  requireAt(isObj(content),'root','object required');
  if(!isObj(content))return errors;
  requireAt(content.schemaVersion===1,'schemaVersion','expected v1');
  requireAt(textOk(content.contentVersion),'contentVersion','version required');
  requireAt(Array.isArray(content.topics)&&content.topics.length===3,'topics','expected three MVP topics');
  if(!Array.isArray(content.topics))return errors;
  const found=new Set();
  for(const [ti,topic] of content.topics.entries()){
    const path='topics['+ti+']';
    if(!isObj(topic)){errors.push(path+': invalid topic');continue;}
    requireAt(TOPICS.has(topic.id),path+'.id','unknown topic id');
    requireAt(!found.has(topic.id),path+'.id','duplicate topic');found.add(topic.id);
    localized(topic.name,path+'.name');
    requireAt(Array.isArray(topic.prerequisites),path+'.prerequisites','array required');
    if(Array.isArray(topic.prerequisites))topic.prerequisites.forEach((id,i)=>requireAt(TOPICS.has(id)&&id!==topic.id,path+'.prerequisites['+i+']','invalid prerequisite'));
    requireAt(Array.isArray(topic.objectives)&&topic.objectives.length>=3,path+'.objectives','at least three objectives');
    if(Array.isArray(topic.objectives))topic.objectives.forEach((o,i)=>localized(o,path+'.objectives['+i+']'));
    requireAt(Array.isArray(topic.lessons)&&topic.lessons.length>=3,path+'.lessons','at least three guided lessons');
    if(Array.isArray(topic.lessons))for(const [li,lesson] of topic.lessons.entries()){
      const p=path+'.lessons['+li+']';
      if(!isObj(lesson)){errors.push(p+': invalid lesson');continue;}
      unique(lesson.id,p+'.id'); requireAt(lesson.topicId===topic.id,p+'.topicId','lesson topic mismatch');
      localized(lesson.title,p+'.title');
      requireAt(Array.isArray(lesson.steps)&&lesson.steps.length===3,p+'.steps','three explicit steps required');
      if(!Array.isArray(lesson.steps))continue;
      for(const [si,step] of lesson.steps.entries()){
        const sp=p+'.steps['+si+']';const mode=['explain','try','reflect'][si];
        requireAt(isObj(step),sp,'invalid step');
        if(!isObj(step))continue;
        requireAt(step.mode===mode,sp+'.mode','expected '+mode);
        localized(step.prompt,sp+'.prompt');
        if(mode==='try')puzzle(step,topic.id,sp);
        if(mode==='explain'){requireAt(isObj(step.manipulative),sp+'.manipulative','illustration required');}
      }
    }
    requireAt(Array.isArray(topic.examples)&&topic.examples.length>=6,path+'.examples','at least six distinct practice examples');
    if(Array.isArray(topic.examples))for(const [qi,q] of topic.examples.entries()){
      const p=path+'.examples['+qi+']';
      if(!isObj(q)){errors.push(p+': invalid example');continue;}
      unique(q.id,p+'.id');
      requireAt(q.topicId===topic.id,p+'.topicId','question topic mismatch');
      requireAt(q.schemaVersion===1,p+'.schemaVersion','expected schema version 1');
      requireAt(int(q.seed)&&q.seed>=0,p+'.seed','nonnegative integer seed required');
      requireAt(['starter','normal','advanced'].includes(q.difficulty),p+'.difficulty','invalid difficulty');
      puzzle(q,topic.id,p);
    }
  }
  for(const id of TOPICS)requireAt(found.has(id),'topics','missing topic '+id);
  return errors;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const file=process.argv[2]?resolve(process.argv[2]):DEFAULT_FILE;
  try{
    const errors=validateCurriculum(JSON.parse(readFileSync(file,'utf8')));
    if(errors.length){console.error('FAIL Math Learning content:',errors.length,'errors');for(const e of errors)console.error(' -',e);process.exitCode=1;}
    else console.log('PASS Math Learning V1: 3 topics, bilingual lessons, visual questions and mathematically correct answers');
  }catch(e){console.error('FAIL reading curriculum:',e.message);process.exitCode=1;}
}
