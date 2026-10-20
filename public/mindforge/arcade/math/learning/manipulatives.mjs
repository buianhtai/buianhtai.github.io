/** Accessible ten-frame / compare / number-line widgets for MindForge.
 * DOM-free renderers are testable in Node; mount functions support pointer and keyboard.
 * All visible labels are fixed local strings, never injected user HTML.
 */
const text={en:{object:'Object',empty:'Empty slot',count:'Tap an object to count it',build:'Fill the ten-frame',compare:'Match objects between groups',line:'Choose a number',left:'Left',right:'Right'},vi:{object:'Đồ vật',empty:'Ô trống',count:'Chạm vào đồ vật để đếm',build:'Điền đủ mười ô',compare:'Ghép cặp đồ vật giữa hai nhóm',line:'Chọn một số',left:'Trái',right:'Phải'}};
const good=n=>Number.isInteger(n)&&n>=0&&n<=10;
const tr=lang=>text[lang==='vi'?'vi':'en'];
function icon(token,color){
 if(token==='star')return '<path d="M0-22 7-7 22-5 10 6 14 22 0 14-14 22-10 6-22-5-7-7Z" fill="'+color+'"/>';
 if(token==='leaf')return '<path d="M-22 16C-26-12 2-30 23-23 29 6 5 28-22 16Z" fill="'+color+'"/>';
 if(token==='flower')return '<g fill="'+color+'"><circle cx="-12" cy="-10" r="11"/><circle cx="12" cy="-10" r="11"/><circle cx="-12" cy="12" r="11"/><circle cx="12" cy="12" r="11"/></g><circle r="8" fill="#ffe1a0"/>';
 return '<circle r="22" fill="'+color+'"/><circle cx="-7" cy="-7" r="7" fill="#fff7"/>';
}
const ink=p=>({mint:'#19a68f',violet:'#7564db',peach:'#e98c6c',sky:'#468bcf'})[p]||'#19a68f';
export function renderTenFrame(count,opts={}){
 if(!good(count))throw new RangeError('count must be 0..10');
 const mode=opts.mode||'count';if(!['count','build'].includes(mode))throw new RangeError('Invalid mode');
 const selected=new Set(opts.selected||[]),t=tr(opts.language),color=ink(opts.palette);
 let cells='';
 for(let i=0;i<10;i++){
  const x=12+(i%5)*102,y=12+Math.floor(i/5)*102,cx=x+48,cy=y+48;
  const original=i<count,added=mode==='build'&&!original&&selected.has(i);
  const filled=original||added,usable=mode==='count'?original:!original,active=mode==='count'?selected.has(i):added;
  cells+='<g data-mf-cell="'+i+'" role="button" tabindex="'+(usable?'0':'-1')+'" aria-disabled="'+(!usable)+'" aria-pressed="'+active+'" aria-label="'+(filled?t.object:t.empty)+' '+(i+1)+'" class="mf-cell '+(filled?'filled ':'')+(active?'selected':'')+'">';
  cells+='<rect x="'+x+'" y="'+y+'" width="96" height="96" rx="16" stroke="currentColor" stroke-width="2" fill="none" opacity=".48"/>';
  if(filled)cells+='<g transform="translate('+cx+' '+cy+')">'+icon(opts.token,color)+'</g>';
  else if(mode==='build')cells+='<path d="M'+(cx-12)+' '+cy+'h24M'+cx+' '+(cy-12)+'v24" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
  if(active)cells+='<circle cx="'+(cx+32)+'" cy="'+(cy-31)+'" r="10" fill="#12a38d" stroke="#fff" stroke-width="3"/>';
  cells+='</g>';
 }
 return '<svg class="mf-tenframe" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 220" role="group" aria-label="'+t[mode]+'">'+cells+'</svg>';
}
function bind(host,selector,fn){
 const click=e=>{const n=e.target.closest?.(selector);if(n&&host.contains(n))fn(n)};
 const key=e=>{if(!['Enter',' '].includes(e.key))return;const n=e.target.closest?.(selector);if(n&&host.contains(n)){e.preventDefault();fn(n)}};
 host.addEventListener('click',click);host.addEventListener('keydown',key);
 return ()=>{host.removeEventListener('click',click);host.removeEventListener('keydown',key)};
}
export function mountTenFrame(host,opts={}){
 if(!host||!host.addEventListener)throw new TypeError('host required');
 const count=opts.count??0,mode=opts.mode||'count';if(!good(count))throw new RangeError('Invalid count');
 const selected=new Set();const paint=()=>{host.innerHTML=renderTenFrame(count,{...opts,mode,selected})};
 const stop=bind(host,'[data-mf-cell]',node=>{
  const i=Number(node.dataset.mfCell);if(mode==='count'&&i>=count||mode==='build'&&i<count)return;
  selected.has(i)?selected.delete(i):selected.add(i);paint();
  host.querySelector('[data-mf-cell="'+i+'"]')?.focus({preventScroll:true});
  const total=mode==='build'?count+selected.size:selected.size;
  opts.onChange?.({count,total,selected:[...selected],complete:mode==='build'?total===10:total===count});
 });paint();
 return {getState:()=>({count,selected:[...selected],total:mode==='build'?count+selected.size:selected.size}),reset:()=>{selected.clear();paint()},destroy:stop};
}
export function renderCompare(left,right,opts={}){
 if(!good(left)||!good(right))throw new RangeError('Invalid comparison counts');
 const t=tr(opts.language);
 return '<div class="mf-compare" role="group" aria-label="'+t.compare+'"><section class="mf-group" data-mf-group="left"><h3>'+t.left+' · '+left+'</h3>'+renderTenFrame(left,{...opts,mode:'count',selected:opts.paired||[]})+'</section><section class="mf-group" data-mf-group="right"><h3>'+t.right+' · '+right+'</h3>'+renderTenFrame(right,{...opts,mode:'count',selected:opts.paired||[]})+'</section></div>';
}
export function mountCompare(host,opts={}){
 const left=opts.left??2,right=opts.right??4;if(!good(left)||!good(right))throw new RangeError('Invalid comparison');
 const paired=new Set(),comparison=left===right?'equal':left>right?'left':'right';
 const paint=()=>{host.innerHTML=renderCompare(left,right,{...opts,paired})};
 const stop=bind(host,'[data-mf-cell]',node=>{
  const i=Number(node.dataset.mfCell);if(i>=Math.min(left,right))return;
  const side=node.closest('[data-mf-group]')?.dataset.mfGroup||'left';
  paired.has(i)?paired.delete(i):paired.add(i);paint();
  host.querySelector('[data-mf-group="'+side+'"] [data-mf-cell="'+i+'"]')?.focus({preventScroll:true});
  opts.onChange?.({paired:[...paired],unpairedLeft:left-paired.size,unpairedRight:right-paired.size,comparison});
 });paint();return{getState:()=>({paired:[...paired],comparison}),destroy:stop};
}
export function renderNumberLine(opts={}){
 const value=opts.value??null;if(value!==null&&!good(value))throw new RangeError('Invalid number');
 const t=tr(opts.language);
 return '<div class="mf-numberline" role="group" aria-label="'+t.line+'">'+Array.from({length:11},(_,n)=>'<button type="button" data-mf-number="'+n+'" aria-pressed="'+(n===value)+'">'+n+'</button>').join('')+'</div>';
}
export function mountNumberLine(host,opts={}){
 let value=opts.value??null;
 const paint=()=>{host.innerHTML=renderNumberLine({...opts,value})};
 const stop=bind(host,'[data-mf-number]',node=>{
  value=Number(node.dataset.mfNumber);paint();host.querySelector('[data-mf-number="'+value+'"]')?.focus({preventScroll:true});opts.onChange?.({value});
 });paint();return{getState:()=>({value}),destroy:stop};
}
