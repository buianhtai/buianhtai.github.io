/* MindForge V2: progressively enhance v1 gameplay and progress; no tracking. */
(()=>{'use strict';
 const app=document.getElementById('app');if(!app)return;
 const STORE='mindforge-data-v1';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const tr=(en,vi)=>document.documentElement.lang==='vi'?vi:en;
 const load=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return {}}};
 const profile=()=>{const d=load();return(d.profiles||[]).find(v=>v.id===d.activeId)||(d.profiles||[])[0]||null};
 function memoryPreview(){
  const grid=app.querySelector('.memory-grid');if(!grid)return;
  const lit=grid.querySelectorAll('.memory-cell.lit').length;
  const hint=app.querySelector('.memory-hint');
  if(!lit||!hint||hint.nextElementSibling?.classList.contains('mf-timer'))return;
  const age=profile()?.age;
  const delay=(age==='sprout'||age==='senior'?5500:4300)+Math.max(0,lit-3)*400;
  const bar=document.createElement('div');bar.className='mf-timer';bar.setAttribute('aria-hidden','true');
  const inner=document.createElement('i');inner.style.setProperty('--mf-duration',delay+'ms');bar.append(inner);hint.after(bar);
 }
 function renderTrend(){
  const chart=app.querySelector('.chart');if(!chart||chart.dataset.mfChart)return;
  const records=(profile()?.records||[]).slice(-7);if(!records.length)return;
  const values=records.map(r=>Math.max(0,Math.min(100,Number(r.score)||0)));
  const x=i=>48+(values.length===1?260:i*520/(values.length-1));
  const y=v=>148-v*1.2;
  const path=values.map((v,i)=>x(i)+','+y(v)).join(' ');
  const labels=values.map((v,i)=>(i+1)+': '+esc(records[i].date||'?')+' — '+v+'%').join(' · ');
  const dots=values.map((v,i)=>'<circle class="mf-dot" cx="'+x(i)+'" cy="'+y(v)+'" r="6"><title>'+esc(records[i].date||'')+' — '+v+'%</title></circle>').join('');
  const grid=[0,50,100].map(v=>'<line class="mf-gridline" x1="48" y1="'+y(v)+'" x2="568" y2="'+y(v)+'"/><text class="mf-axis-label" x="36" y="'+(y(v)+5)+'" text-anchor="end">'+v+'%</text>').join('');
  const nums=values.map((v,i)=>'<text class="mf-axis-label" x="'+x(i)+'" y="166" text-anchor="middle">'+(i+1)+'</text>').join('');
  chart.dataset.mfChart='true';chart.classList.add('mf-chart');
  chart.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 180" role="img" aria-label="'+esc(tr('Accuracy in the last','Độ chính xác trong'))+' '+values.length+' '+esc(tr('sessions','lượt chơi'))+'">'+grid+'<polyline class="mf-line" points="'+path+'"/>'+dots+nums+'</svg><p class="mf-summary">'+esc(tr('Sessions and accuracy','Lượt chơi và độ chính xác'))+': '+labels+'</p>';
  const summary=chart.nextElementSibling;if(summary?.classList.contains('tiny'))summary.hidden=true;
 }
 function enhance(){memoryPreview();renderTrend()}
 const observer=new MutationObserver(enhance);observer.observe(app,{childList:true,subtree:true});
 app.addEventListener('click',event=>{
  const cell=event.target.closest('.memory-cell[data-cell]');if(!cell)return;
  const n=cell.dataset.cell;
  requestAnimationFrame(()=>{const next=app.querySelector('.memory-cell[data-cell="'+n+'"]');if(next&&!next.disabled)next.focus({preventScroll:true})});
 },true);
 app.addEventListener('keydown',event=>{
  const cell=event.target.closest('.memory-cell[data-cell]');
  if(!cell||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  const grid=cell.closest('.memory-grid');if(!grid)return;
  const cols=(getComputedStyle(grid).gridTemplateColumns.match(/\S+/g)||[]).length||3;
  const index=Number(cell.dataset.cell),delta=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:event.key==='ArrowUp'?-cols:cols;
  const target=grid.querySelector('.memory-cell[data-cell="'+(index+delta)+'"]');
  if(target&&!target.disabled){event.preventDefault();target.focus()}
 });
 enhance();
})();
