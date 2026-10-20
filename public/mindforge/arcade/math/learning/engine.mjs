/**
 * MindForge Math Learning V1: deterministic, offline-only topic questions.
 * Pure ESM; shared by browser Learn/Practice and Node unit tests.
 * The mathematical answer is ALWAYS derived from manipulative.counts.
 */
export const TOPIC_IDS=Object.freeze(['count-to-10','compare-to-10','bonds-to-10']);
export const DIFFICULTIES=Object.freeze(['starter','normal','advanced']);
const ICONS=Object.freeze(['dot','apple','star','leaf','fish','flower']);
const PALETTES=Object.freeze(['mint','violet','peach','sky']);
const L=(en,vi)=>({en,vi});
const inRange=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;

/** Mulberry32: reproducible local PRNG, deliberately NOT cryptographic. */
function randomSource(seed){
 let state=(seed>>>0)||0x6d2b79f5;
 return ()=>{state=(state+0x6d2b79f5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296};
}
function shuffle(arr,random){const out=[...arr];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function hint(topic,count){
 if(topic==='count-to-10')return [L('Count each item once, from left to right.','Đếm từng vật một lần, từ trái sang phải.'),L('The last number you say is the total.','Số cuối con đọc là tổng số.')];
 if(topic==='compare-to-10')return [L('Pair one item from each group.','Ghép từng cặp đồ vật của hai nhóm.'),L('If one group has extras, it has more. No extras means equal.','Nhóm còn đồ vật thừa có nhiều hơn. Không thừa thì bằng nhau.')];
 return [L('Look at the empty spaces in the ten-frame.','Nhìn vào các ô trống trong khung mười ô.'),L('Count on until you reach ten.','Đếm tiếp cho đến khi đủ mười.')];
}
export function generateQuestion(topicId,{seed=1,index=0,difficulty='starter'}={}){
 if(!TOPIC_IDS.includes(topicId))throw new RangeError('Unknown math topic: '+topicId);
 if(!DIFFICULTIES.includes(difficulty))throw new RangeError('Invalid difficulty');
 if(!inRange(seed,0,0xffffffff)||!inRange(index,0,1000000))throw new RangeError('Seed/index must be nonnegative integers');
 const random=randomSource((seed ^ Math.imul(index+1,0x9e3779b1))>>>0);
 const next=n=>Math.floor(random()*n);
 const tokenId=ICONS[next(ICONS.length)],palette=PALETTES[next(PALETTES.length)];
 const visual={tokenId,palette,arrangement:next(2)?'row':'grid',flip:Boolean(next(2))};
 let a,b,answerSpec,prompt,explanation,kind;
 if(topicId==='count-to-10'){
  a=next(11);kind='ten-frame';answerSpec={kind:'number',value:a};
  prompt=L('How many objects do you see?','Con nhìn thấy bao nhiêu đồ vật?');
  explanation=L('There are '+a+' objects.','Có '+a+' đồ vật.');
 }else if(topicId==='compare-to-10'){
  a=next(11);b=(index%5===0)?a:next(11);kind='two-groups';
  const value=a===b?'equal':a>b?'left':'right';answerSpec={kind:'side',value};
  prompt=L('Which group has more objects, or are they equal?','Nhóm nào có nhiều đồ vật hơn, hay hai nhóm bằng nhau?');
  const en=value==='equal'?'The groups are equal.':('The '+value+' group has more.');
  const vi=value==='equal'?'Hai nhóm bằng nhau.':(value==='left'?'Nhóm bên trái nhiều hơn.':'Nhóm bên phải nhiều hơn.');
  explanation=L('Left: '+a+'; right: '+b+'. '+en,'Bên trái: '+a+'; bên phải: '+b+'. '+vi);
 }else{
  a=next(11);kind='ten-frame';answerSpec={kind:'number',value:10-a};
  prompt=L('How many more objects do you need to make 10?','Cần thêm bao nhiêu đồ vật để đủ 10?');
  explanation=L(a+' + '+(10-a)+' = 10',a+' + '+(10-a)+' = 10');
 }
 const m={kind,counts:kind==='two-groups'?[a,b]:[a],target:10,visual};
 const distractors=answerSpec.kind==='side'
  ?shuffle(['left','right','equal'],random)
  :shuffle([answerSpec.value,...Array.from({length:11},(_,i)=>i).filter(v=>v!==answerSpec.value)].slice(0,4),random);
 const q={id:topicId+'-'+difficulty+'-'+seed+'-'+index,topicId,schemaVersion:1,seed,index,difficulty,
   prompt,manipulative:m,answerSpec,options:distractors.map(value=>({kind:answerSpec.kind,value})),
   hintSteps:hint(topicId,a),explanation};
 const errors=validateQuestion(q);
 if(errors.length)throw new Error('Invalid generated question: '+errors.join('; '));
 return q;
}
export function evaluateQuestion(question,answer){
 if(!question||!question.answerSpec)return false;
 const spec=question.answerSpec;
 if(spec.kind==='side')return typeof answer==='string'&&answer===spec.value;
 if(spec.kind!=='number')return false;
 if(typeof answer==='string'&&!/^(0|[1-9]\d*)$/.test(answer.trim()))return false;
 const n=typeof answer==='string'?Number(answer.trim()):answer;
 return inRange(n,0,10)&&n===spec.value;
}
/** A separate deterministic validator, rather than trusting the generated answer. */
export function validateQuestion(q){
 const errors=[];
 if(!q||typeof q!=='object')return ['question must be object'];
 if(q.schemaVersion!==1)errors.push('unsupported schemaVersion');
 if(!TOPIC_IDS.includes(q.topicId))errors.push('invalid topic');
 if(!DIFFICULTIES.includes(q.difficulty))errors.push('invalid difficulty');
 for(const key of ['prompt','explanation'])if(!q[key]||!['en','vi'].every(lang=>typeof q[key][lang]==='string'&&q[key][lang].trim()))errors.push(key+' missing translation');
 if(!Array.isArray(q.hintSteps)||q.hintSteps.length<2||q.hintSteps.some(h=>!h?.en||!h?.vi))errors.push('missing strategy hints');
 const m=q.manipulative,spec=q.answerSpec;
 if(!m||!spec||!Array.isArray(m.counts)||!m.counts.every(n=>inRange(n,0,10))||m.target!==10)return [...errors,'invalid manipulative'];
 const [a,b]=m.counts;
 if(q.topicId==='compare-to-10'){
  if(m.kind!=='two-groups'||m.counts.length!==2)errors.push('requires two groups');
  else if(spec.kind!=='side'||spec.value!==(a===b?'equal':a>b?'left':'right'))errors.push('comparison answer incorrect');
 }else{
  if(m.kind!=='ten-frame'||m.counts.length!==1)errors.push('requires one ten-frame');
  else if(spec.kind!=='number'||spec.value!==(q.topicId==='count-to-10'?a:10-a))errors.push('number answer incorrect');
 }
 const options=q.options;
 if(!Array.isArray(options)||options.length<3||options.length>4)errors.push('invalid options length');
 else{
  const values=options.map(o=>o?.value);
  if(new Set(values).size!==values.length)errors.push('duplicate answer options');
  if(!options.some(o=>o?.kind===spec.kind&&o?.value===spec.value))errors.push('correct option missing');
  if(options.some(o=>o?.kind!==spec.kind))errors.push('mismatched option kind');
 }
 if(!m.visual||!ICONS.includes(m.visual.tokenId)||!PALETTES.includes(m.visual.palette)||!['row','grid'].includes(m.visual.arrangement))errors.push('invalid visual variant');
 return errors;
}
export function generateSet(topicId,{seed=1,count=10,difficulty='starter'}={}){
 if(!inRange(count,1,10000))throw new RangeError('count must be 1..10000');
 return Array.from({length:count},(_,i)=>generateQuestion(topicId,{seed:(seed+i)>>>0,index:i,difficulty}));
}
