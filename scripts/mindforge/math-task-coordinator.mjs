/**
 * MindForge Math Learning issue coordinator.
 * GitHub Actions calls this with a repository-scoped GITHUB_TOKEN.
 * It manages only labels on the explicit Math V1 task allowlist.
 * It DOES NOT implement code, assign agents, close issues or merge PRs.
 */
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const TASK_IDS=Object.freeze([120,121,122,123,124,125,126,127]);
export const EPIC_ID=119;
export const LABELS=Object.freeze({
 ready:'math:ready',blocked:'math:blocked',merged:'math:implementation-merged',
 building:'math:building',qa:'math:qa',review:'math:review'
});
const ACTIVE=[LABELS.building,LABELS.qa,LABELS.review];
const ALL_MANAGED=[LABELS.ready,LABELS.blocked];
const LABEL_STYLE=[
 [LABELS.ready,'0e8a16','Dependencies satisfied; ready for an agent or developer'],
 [LABELS.blocked,'d93f0b','Waiting for a prerequisite implementation'],
 [LABELS.merged,'5319e7','Implementation merged; QA may still remain open'],
 [LABELS.building,'0052cc','Implementation in progress'],
 [LABELS.qa,'fbca04','Quality verification in progress'],
 [LABELS.review,'bfdadc','Ready for independent human review']
];
export function getBlockers(body){
 const text=typeof body==='string'?body:'';
 const match=text.match(/^##[ \t]+Blocked by[ \t]*\r?\n([\s\S]*?)(?=\r?\n##[ \t]+|$)/im);
 if(!match)return {ids:[],error:'missing ## Blocked by section'};
 const lines=match[1].split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.some(x=>/^none(?:[.\s]|$)/i.test(x)||/^[-*][ \t]+none(?:[.\s]|$)/i.test(x)))return {ids:[]};
 const ids=[...new Set(lines.map(line=>line.match(/^[-*]\s+#(\d+)\b/)).filter(Boolean).map(x=>Number(x[1])))];
 if(!ids.length)return {ids:[],error:'dependency section has no valid issue references or None'};
 if(lines.some(line=>/^\s*[-*]/.test(line)&&!/^[-*]\s+#\d+\b/.test(line)))return {ids,error:'invalid dependency line'};
 return {ids};
}
export function resolvePlan(issues){
 const map=new Map(issues.map(issue=>[issue.number,issue]));
 const records=[];
 for(const id of TASK_IDS){
  const issue=map.get(id);
  if(!issue){records.push({id,status:'blocked',blockers:[id],error:'missing task'});continue}
  const {ids,error}=getBlockers(issue.body);
  const labels=new Set((issue.labels||[]).map(label=>typeof label==='string'?label:label.name));
  const remaining=ids.filter(d=>{
   const dep=map.get(d);
   if(!dep)return true;
   const flags=new Set((dep.labels||[]).map(l=>typeof l==='string'?l:l.name));
   return dep.state!=='closed'&&!flags.has(LABELS.merged);
  });
  let status='ready';
  if(issue.state==='closed')status='done';
  else if(labels.has(LABELS.merged))status='implementation-merged';
  else if(ACTIVE.some(name=>labels.has(name)))status='in-progress';
  else if(error||remaining.length)status='blocked';
  records.push({id,status,blockers:remaining,dependencies:ids,error});
 }
 return records;
}
export function labelDiff(issue,record){
 const existing=new Set((issue.labels||[]).map(x=>typeof x==='string'?x:x.name));
 const desired=record.status==='ready'?LABELS.ready:record.status==='blocked'?LABELS.blocked:null;
 const add=desired&&!existing.has(desired)?[desired]:[];
 const remove=ALL_MANAGED.filter(l=>l!==desired&&existing.has(l));
 return {add,remove};
}
function requestFactory(repo,token,base){
 return async (method,path,body,allow=[] )=>{
  const res=await fetch(base+'/repos/'+repo+path,{
   method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'MindForge-Math-Coordinator'},
   ...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  if(!res.ok&&!allow.includes(res.status)){
   const snippet=(await res.text()).slice(0,450);
   throw new Error(method+' '+path+' failed '+res.status+': '+snippet);
  }
  if(res.status===204)return null;
  const bodyText=await res.text();return bodyText?JSON.parse(bodyText):null;
 };
}
function summarize(records,mutations,dryRun){
 const title='## MindForge Math tasks · '+(dryRun?'dry run':'automatic reconciliation');
 const lines=[title,'','This workflow only labels dependencies. It cannot create implementation PRs, run super-board agents or auto-merge code.','','| Issue | Status | Blocked by |','|---|---|---|'];
 for(const r of records)lines.push('| #'+r.id+' | '+r.status.replace(/-/g,' ')+' | '+(r.blockers?.map(n=>'#'+n).join(', ')||'—')+' |');
 if(mutations.length){lines.push('','Changes:');for(const x of mutations)lines.push('- '+x);}
 const errs=records.filter(x=>x.error);
 if(errs.length){lines.push('','Dependency parsing warnings:');for(const x of errs)lines.push('- #'+x.id+': '+x.error);}
 return lines.join('\n')+'\n';
}
async function main(){
 const repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
 if(repo!=='buianhtai/buianhtai.github.io')throw new Error('Unexpected repository; no issue changes permitted');
 if(!token)throw new Error('GITHUB_TOKEN is required');
 const dryRun=process.env.MATH_AUTOMATION_DRY_RUN==='true';
 const call=requestFactory(repo,token,process.env.GITHUB_API_URL||'https://api.github.com');
 const issues=await Promise.all(TASK_IDS.map(async id=>{
  const data=await call('GET','/issues/'+id);
  return {number:id,state:data.state,body:data.body||'',labels:data.labels||[]};
 }));
 const byId=new Map(issues.map(i=>[i.number,i]));
 const changes=[];
 if(!dryRun)for(const [name,color,description] of LABEL_STYLE)
   await call('POST','/labels',{name,color,description},[422]);
 // Existing merged foundations: verify exact PR state before marking implementation merged.
 // This DOES NOT close issue or certify physical-device QA.
 for(const [id,prs] of [[122,[130]],[123,[131,132]]]){
  const issue=byId.get(id);
  if(issue.state==='closed'||issue.labels.some(l=>(typeof l==='string'?l:l.name)===LABELS.merged))continue;
  const checked=await Promise.all(prs.map(n=>call('GET','/pulls/'+n)));
  if(checked.every(pr=>pr.merged===true)){
    changes.push('#'+id+': implementation confirmed merged via PR '+prs.map(n=>'#'+n).join(', '));
    if(!dryRun)await call('POST','/issues/'+id+'/labels',{labels:[LABELS.merged]});
    issue.labels.push({name:LABELS.merged});
  }
 }
 const records=resolvePlan(issues);
 for(const r of records){
  const issue=byId.get(r.id);if(!issue)continue;
  const {add,remove}=labelDiff(issue,r);
  if(r.error)continue; // report bad dependencies rather than incorrectly unblocking tasks
  for(const label of add){
    changes.push('#'+r.id+': add '+label);
    if(!dryRun)await call('POST','/issues/'+r.id+'/labels',{labels:[label]});
  }
  for(const label of remove){
    changes.push('#'+r.id+': remove '+label);
    if(!dryRun)await call('DELETE','/issues/'+r.id+'/labels/'+encodeURIComponent(label),undefined,[404]);
  }
 }
 const report=summarize(records,changes,dryRun);
 process.stdout.write(report);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,report+'\n');
 // Only post a status comment if something actually changed; avoid scheduled spam.
 if(changes.length&&!dryRun)await call('POST','/issues/'+EPIC_ID+'/comments',{body:report});
 if(records.some(r=>r.error))process.exitCode=1; // dependency errors must be visible
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error);process.exitCode=1;});
