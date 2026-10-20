/* Original browser-rendered picture cards. No network assets, microphone or tracking. */
(function memoryImagePack(){
 "use strict";
 const inventory=[
 ["cat","🐈","Cat","Mèo","#fff0e5"],["dog","🐕","Dog","Chó","#fff1de"],["fox","🦊","Fox","Cáo","#ffebdc"],["fish","🐠","Fish","Cá","#def6ff"],["rabbit","🐇","Rabbit","Thỏ","#f2eaff"],["owl","🦉","Owl","Cú mèo","#f1e7ff"],
 ["apple","🍎","Apple","Táo","#ffeced"],["strawberry","🍓","Strawberry","Dâu","#ffeaf0"],["cherries","🍒","Cherries","Anh đào","#fff0f2"],["pear","🍐","Pear","Lê","#f4ffe4"],
 ["rocket","🚀","Rocket","Tên lửa","#e9efff"],["car","🚙","Car","Ô tô","#e9f8ff"],["sailboat","⛵","Sailboat","Thuyền buồm","#e1f8ff"],["train","🚂","Train","Tàu hỏa","#fff0e1"],
 ["flower","🌻","Flower","Hoa","#fff0f8"],["tree","🌳","Tree","Cây","#e4f9e8"],["moon","🌙","Moon","Mặt trăng","#e9eaff"],["star","⭐","Star","Ngôi sao","#fff6d6"]
 ];
 const byId=Object.fromEntries(inventory.map(x=>[x[0],x]));
 const shuffle=a=>{let b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
 const label=(id,lang)=>byId[id]?.[lang==="vi"?3:2]||id;
 function picture(id,lang="en"){const v=byId[id]||inventory[0];return `<svg class="mf-image-art" viewBox="0 0 100 100" role="img" aria-label="${label(id,lang)}"><rect width="100" height="100" rx="20" fill="${v[4]}"/><circle cx="75" cy="23" r="14" fill="#fff" opacity=".58"/><circle cx="23" cy="77" r="20" fill="#fff" opacity=".33"/><text x="50" y="70" font-size="57" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${v[1]}</text></svg>`}
 function generate(lv=1,age="adult"){
  lv=Math.min(6,Math.max(1,lv));
  const kinds=age==="sprout"?["objects","objects","places"]:lv<3?["objects","objects","places"]:["objects","places","sequence"];
  const kind=kinds[Math.floor(Math.random()*kinds.length)];
  const count=kind==="places"?Math.min(3,Math.max(2,lv)):Math.min(kind==="sequence"?5:6,Math.max(2,Math.ceil(lv*.65)+1));
  const items=shuffle(inventory.map(x=>x[0])).slice(0,count);
  const candidates=shuffle([...items,...shuffle(inventory.map(x=>x[0]).filter(id=>!items.includes(id))).slice(0,Math.min(4,9-count))]);
  const cells=shuffle(Array.from({length:9},(_,i)=>i)).slice(0,count);
  const target=Math.floor(Math.random()*count);
  const delay=age==="sprout"?5500:Math.max(2500,6200-lv*400);
  return{skill:"memory",variant:"pictures",kind,count,items,candidates,cells,target,delay};
 }
 function select(task,prior,idx){
  const next=new Set(prior),limit=task.kind==="places"?1:task.count;
  if(next.has(idx)){next.delete(idx);return next}
  if(task.kind==="places"){next.clear();next.add(idx);return next}
  if(next.size<limit)next.add(idx);
  return next;
 }
 function check(task,selected,lang){
  const chosen=[...selected],need=task.kind==="places"?1:task.count;let ok=false,solution="";
  if(task.kind==="places"){ok=chosen.length===1&&chosen[0]===task.cells[task.target];solution=(lang==="vi"?"Ô ":"Cell ")+(task.cells[task.target]+1)+": "+label(task.items[task.target],lang)}
  else if(task.kind==="objects"){const picks=chosen.map(i=>task.candidates[i]);ok=chosen.length===need&&task.items.every(x=>picks.includes(x));solution=task.items.map(x=>label(x,lang)).join(", ")}
  else{const picks=chosen.map(i=>task.candidates[i]);ok=chosen.length===need&&task.items.every((id,i)=>picks[i]===id);solution=task.items.map((id,i)=>(i+1)+". "+label(id,lang)).join(" → ")}
  return{ok,answer:chosen.join(","),explanation:(lang==="vi"?"Đáp án: ":"Answer: ")+solution};
 }
 function render(t,phase,selected,lang){
  const vi=lang==="vi",preview=phase==="preview",recall=phase==="recall",feedback=phase==="feedback";
  const intro=vi?["GHI NHỚ HÌNH ẢNH","Ghi nhớ những bức hình","Hãy nhìn kỹ những hình ảnh. Sau đó trả lời."]:["PICTURE MEMORY","Remember the pictures","Look closely at the pictures, then recall what you saw."];
  const taskPrompt=t.kind==="places"?(vi?"Hình này ở vị trí nào?":"Where was this picture?"):t.kind==="sequence"?(vi?"Chạm các hình theo thứ tự cũ.":"Tap the pictures in their original order."):(vi?"Bạn vừa thấy những hình nào?":"Which pictures did you just see?");
  let content="";
  if(phase==="question"){content=`<div class="mf-picture-cover" aria-hidden="true"><span>🌱</span><span>🦊</span><span>🚀</span></div>`}
  else if(t.kind==="places"){
   const target=!preview?`<div class="mf-picture-target"><span>${taskPrompt}</span>${picture(t.items[t.target],lang)}</div>`:"";
   content=target+`<div class="mf-places">${Array.from({length:9},(_,i)=>{
    const j=t.cells.indexOf(i),id=j>=0?t.items[j]:null,correct=feedback&&i===t.cells[t.target];
    return `<button type="button" class="mf-place-cell ${selected.has(i)?"selected":""} ${correct?"right":""}" data-cell="${i}" aria-label="${(vi?"Ô ":"Cell ")+(i+1)}${preview&&id?", "+label(id,lang):""}" aria-pressed="${selected.has(i)}" ${recall?"":"disabled"}>${preview&&id?picture(id,lang):correct?picture(t.items[t.target],lang):selected.has(i)?"✓":""}<small>${i+1}</small></button>`}).join("")}</div>`;
  }else if(preview){
   content=`<div class="mf-image-grid">${t.items.map((id,i)=>`<div class="mf-picture-tile">${picture(id,lang)}<small>${t.kind==="sequence"?i+1:label(id,lang)}</small></div>`).join("")}</div>`;
  }else{
   content=`<div class="mf-image-grid">${t.candidates.map((id,i)=>{
     const order=[...selected].indexOf(i)+1,correct=feedback&&t.items.includes(id);
     return `<button type="button" class="mf-picture-tile mf-picture-choice ${selected.has(i)?"chosen":""} ${correct?"right":""}" data-cell="${i}" aria-label="${label(id,lang)}" aria-pressed="${selected.has(i)}" ${recall?"":"disabled"}>${picture(id,lang)}<small>${label(id,lang)}</small>${order?`<b class="mf-choice-order">${t.kind==="sequence"?order:"✓"}</b>`:""}</button>`}).join("")}</div>`;
  }
  const want=t.kind==="places"?1:t.count;
  const controls=phase==="question"?`<button type="button" class="btn btn-primary" data-action="memory-show">${vi?"▶ Xem hình":"▶ Show pictures"}</button>`:preview?`<p class="mf-preview-notice">${vi?"Ghi nhớ trước khi hình biến mất…":"Remember before the pictures disappear…"}</p>`:recall?`<div class="mf-picture-actions"><span>${selected.size} / ${want}</span><button type="button" class="btn btn-primary" data-action="memory-check" ${selected.size===want?"":"disabled"}>${vi?"Kiểm tra":"Check answers"}</button></div>`:feedback?`<div class="mf-picture-solution">${check(t,new Set(t.kind==="places"?[t.cells[t.target]]:t.items.map(x=>t.candidates.indexOf(x))),lang).explanation}</div>`:"";
  return `<div class="mf-picture-head"><div class="mf-picture-kicker">✿ ${intro[0]}</div><h3>${phase==="question"?intro[1]:preview?(vi?"Hãy ghi nhớ!":"Memorize!"):(vi?"Đến lượt bạn nhớ":"Your turn to remember")}</h3><p>${phase==="question"?intro[2]:preview?(vi?"Hình sẽ tự ẩn đi.":"Pictures will disappear automatically."):taskPrompt}</p></div>`+content+`<div class="mf-picture-bottom">${controls}</div>`;
 }
 const css=`
 .mf-memory-switch{display:flex;flex-wrap:wrap;gap:7px;margin:4px 0 18px}
 .mf-memory-switch button{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:11px;min-height:44px;padding:9px 15px;font:inherit;font-weight:700;cursor:pointer}
 .mf-memory-switch button.active{border-color:var(--purple);background:var(--purple-soft);color:var(--purple)}
 .mf-picture-head{text-align:center;margin:10px auto 16px;max-width:560px}
 .mf-picture-head h3{font-size:clamp(20px,3.5vw,28px);margin:5px 0;color:var(--text);letter-spacing:-.5px}
 .mf-picture-head p{font-size:13px;color:var(--muted);margin:6px 0}
 .mf-picture-kicker{font-size:11px;color:var(--mint);font-weight:850;letter-spacing:2px}
 .mf-picture-cover{margin:0 auto;max-width:500px;padding:25px 10px;background:var(--surface2);border:1px dashed var(--border);border-radius:20px;display:flex;gap:20px;justify-content:center;font-size:52px}
 .mf-image-grid{max-width:600px;margin:auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
 .mf-picture-tile{position:relative;min-width:0;min-height:100px;padding:6px;border:2px solid var(--border);border-radius:15px;background:var(--surface);color:var(--text);display:flex;align-items:center;flex-direction:column;gap:5px;justify-content:center}
 .mf-image-art{width:min(100%,100px);height:auto;aspect-ratio:1}
 .mf-picture-tile small{font-size:11px;font-weight:750;line-height:1.2;text-align:center}
 .mf-picture-choice{cursor:pointer}.mf-picture-choice.chosen{background:var(--purple-soft);border-color:var(--purple)}.mf-picture-choice.right,.mf-place-cell.right{border-color:var(--mint)}
 .mf-choice-order{position:absolute;top:5px;right:5px;background:var(--purple);color:white;min-width:23px;height:23px;border-radius:8px;display:grid;place-items:center;font-size:11px}
 .mf-places{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));max-width:380px;gap:8px;margin:0 auto}
 .mf-place-cell{aspect-ratio:1;min-width:0;position:relative;display:grid;place-items:center;background:var(--surface2);color:var(--text);border:2px solid var(--border);border-radius:14px;font:inherit;font-weight:750}
 .mf-place-cell:not(:disabled){cursor:pointer}.mf-place-cell.selected{border-color:var(--purple);background:var(--purple-soft)}.mf-place-cell svg{max-width:86%}
 .mf-place-cell small{position:absolute;top:5px;left:7px;color:var(--muted);font-size:10px}
 .mf-picture-target{display:flex;align-items:center;justify-content:space-between;max-width:380px;padding:7px 12px;margin:0 auto 13px;border-radius:14px;background:var(--surface2);font-weight:750}
 .mf-picture-target svg{width:63px;flex:0 0 63px}
 .mf-picture-bottom{display:grid;justify-items:center;gap:10px;margin-top:16px}.mf-picture-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center}
 .mf-preview-notice,.mf-picture-solution{font-size:12px;color:var(--muted);text-align:center}.mf-picture-solution{font-weight:700;color:var(--text)}
 .mf-picture-choice:focus-visible,.mf-place-cell:focus-visible,.mf-memory-switch button:focus-visible{outline:3px solid var(--purple);outline-offset:3px}
 @media(max-width:600px){.mf-image-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.mf-picture-tile{min-height:90px;padding:4px}.mf-picture-tile small{font-size:10px}.mf-picture-cover{font-size:38px}.mf-places{gap:6px}.mf-memory-switch button{flex:1;padding:8px 9px;font-size:12px}}
 @media(max-width:330px){.mf-picture-tile small{font-size:9px}}
 @media(prefers-reduced-motion:reduce){.mf-picture-choice{transition:none!important}}
 `;
 const style=document.createElement("style");style.id="mf-picture-style";style.textContent=css;document.head.append(style);
 window.MindForgePictureMemory={generate,select,check,render,label,picture,inventory:inventory.map(x=>x[0])};
})();
