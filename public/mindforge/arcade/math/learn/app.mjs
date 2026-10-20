import {renderTenFrame,renderCompare,mountTenFrame,mountCompare} from '../learning/manipulatives.mjs';
const root=document.querySelector('#app'), KEY='mf-math-learn-v1', THEME='mf-library-theme';
const IDS=['count-to-10','compare-to-10','bonds-to-10'];
const ICONS=['🔢','⚖️','🧩'];
const T={
en:{back:'Math Quest',games:'All games',tag:'Learn by doing',title:'See it. Touch it. Understand it.',subtitle:'Three playful visual topics to count, compare and make ten.',topics:'Choose a topic',subtitle2:'Pick any topic and complete three short lessons.',lesson:'Lesson',step:['Watch','Try','Explain'],of:'of',finished:'completed',tapCount:'Tap each object, then choose the matching number.',tapCompare:'Tap matching objects from each group, then compare.',tapBond:'Tap empty squares until the frame has ten objects.',pick:'Select your answer',left:'Left has more',right:'Right has more',equal:'Equal groups',check:'Check answer',next:'Continue',complete:'Finish lesson',success:'Great! That is correct.',wrong:'Not quite. Look again and try once more.',answer:'The answer is',hint:'Get a hint',hintHead:'Hint',choose:'Choose an answer to continue.',progress:'Progress is stored only in this browser',done:'Lesson complete!',doneText:'You finished this lesson. Continue or practice again.',again:'Try again',following:'Next lesson',restart:'First lesson',numberAdded:'Objects added',reflection:'Explain how you worked out the answer, then finish the lesson.',watch:'Look carefully at the picture. Next, try it yourself.',status:'Objects tapped',privacy:'No account required. Age ranges are informal guidance.',loadError:'The lesson content is unavailable. Refresh or return to Math Quest.',refresh:'Refresh',light:'Light',dark:'Dark'},
vi:{back:'Math Quest',games:'Tất cả trò chơi',tag:'Học bằng trải nghiệm',title:'Nhìn. Chạm. Hiểu cách tính.',subtitle:'Ba chủ đề toán trực quan giúp bé tập đếm, so sánh và ghép thành mười.',topics:'Chọn chủ đề',subtitle2:'Bé có thể chọn chủ đề và học qua ba bài học nhỏ.',lesson:'Bài',step:['Quan sát','Thực hành','Giải thích'],of:'trên',finished:'đã hoàn thành',tapCount:'Chạm từng đồ vật, rồi chọn số tương ứng.',tapCompare:'Chạm các đồ vật để ghép cặp, rồi so sánh hai nhóm.',tapBond:'Chạm ô trống để điền đủ mười đồ vật.',pick:'Chọn đáp án',left:'Bên trái nhiều hơn',right:'Bên phải nhiều hơn',equal:'Hai nhóm bằng nhau',check:'Kiểm tra',next:'Tiếp tục',complete:'Hoàn thành bài',success:'Giỏi lắm! Bé đã trả lời đúng.',wrong:'Chưa đúng. Hãy quan sát kỹ và thử lại một lần nhé.',answer:'Đáp án là',hint:'Xem gợi ý',hintHead:'Gợi ý',choose:'Hãy chọn một đáp án.',progress:'Tiến trình chỉ lưu trong trình duyệt',done:'Hoàn thành bài học!',doneText:'Bé đã hoàn thành bài này. Hãy tiếp tục hoặc ôn lại.',again:'Làm lại',following:'Bài tiếp theo',restart:'Bài đầu tiên',numberAdded:'Số đồ vật đã thêm',reflection:'Hãy giải thích cách con tìm ra đáp án, rồi hoàn thành bài nhé.',watch:'Hãy quan sát thật kỹ. Sau đó bé sẽ tự thử nhé.',status:'Đồ vật đã chạm',privacy:'Không cần tài khoản. Độ tuổi chỉ mang tính tham khảo.',loadError:'Không tải được nội dung. Hãy làm mới trang hoặc trở lại Math Quest.',refresh:'Làm mới',light:'Sáng',dark:'Tối'}
};
let data=null,lang='en',theme='light',topicId=IDS[0],lessonIndex=0,stepIndex=0;
let done={},answer=null,attempts=0,outcome='',mounted=null,chosenCount=0;
function tr(k){return T[lang][k]||k}
function localized(v){return v?.[lang]||v?.en||''}
function esc(v){return String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[x]))}
function startState(){
 try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');
 if(raw?.version===1&&IDS.includes(raw.topicId)&&Number.isInteger(raw.lessonIndex)&&raw.lessonIndex>=0&&raw.lessonIndex<3&&Number.isInteger(raw.stepIndex)&&raw.stepIndex>=0&&raw.stepIndex<=3){
 topicId=raw.topicId;lessonIndex=raw.lessonIndex;stepIndex=raw.stepIndex;done=Object.fromEntries(Object.entries(raw.done||{}).filter(([k,v])=>IDS.some(id=>k.startsWith(id+'-lesson-'))&&v===true));lang=['en','vi'].includes(raw.lang)?raw.lang:lang;
 }}catch{}
 try{theme=localStorage.getItem(THEME)==='dark'?'dark':'light'}catch{}
 setTheme();
}
function save(){try{localStorage.setItem(KEY,JSON.stringify({version:1,topicId,lessonIndex,stepIndex,done,lang}))}catch{}}
function setTheme(){document.documentElement.dataset.theme=theme;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='dark'?'#101827':'#f6f8fc'}
function currentTopic(){return data.topics.find(x=>x.id===topicId)}
function currentLesson(){return currentTopic().lessons[lessonIndex]}
function currentStep(){return currentLesson().steps[Math.min(stepIndex,2)]}
function resetAnswers(){answer=null;attempts=0;outcome='';chosenCount=0}
function chooseTopic(id,num=0){if(!IDS.includes(id)||!Number.isInteger(num)||num<0||num>2)return;topicId=id;lessonIndex=num;stepIndex=0;resetAnswers();save();render()}
function header(){return '<header class="top"><a class="brand" href="../"><span class="brand-symbol">✦</span><span>MindForge <span style="color:var(--mint)">/ '+tr('tag')+'</span></span></a><div class="top-controls"><a class="small-button" href="../">← '+tr('back')+'</a><button class="small-button" data-click="theme" aria-pressed="'+(theme==='dark')+'">'+(theme==='dark'?'☀ '+tr('dark'):'☾ '+tr('light'))+'</button><button class="small-button" data-click="language" aria-label="Language">'+(lang==='en'?'VI':'EN')+'</button></div></header>'}
function hero(){return '<section class="masthead"><div><div class="eyebrow">MINDFORGE / VISUAL MATH</div><h1>'+tr('title')+'</h1><p>'+tr('subtitle')+'</p></div><div class="scene-art" aria-hidden="true"><span>🍎</span><span>⭐</span><span>🔟</span></div></section>'}
function topicCards(){
 return '<div class="section-bar"><div><h2>'+tr('topics')+'</h2><p>'+tr('subtitle2')+'</p></div><a class="small-button" href="../../../games/">▦ '+tr('games')+'</a></div><div class="topic-grid">'+data.topics.map((x,i)=>'<button class="topic-card" data-topic="'+x.id+'" aria-pressed="'+(topicId===x.id)+'"><span class="topic-emoji" aria-hidden="true">'+ICONS[i]+'</span><strong>'+esc(localized(x.name))+'</strong><small>'+x.lessons.filter(l=>done[l.id]).length+'/3 '+tr('finished')+'</small><span aria-hidden="true">↗</span></button>').join('')+'</div>';
}
function lessonNav(){return '<aside class="lesson-nav"><h3>'+tr('lesson')+'</h3>'+currentTopic().lessons.map((x,i)=>'<button class="lesson-option" data-lesson="'+i+'" aria-current="'+(i===lessonIndex)+'"><span>'+(done[x.id]?'✓':i+1)+'</span><b>'+tr('lesson')+' '+(i+1)+'</b></button>').join('')+'<p class="tip">'+tr('progress')+'</p></aside>'}
function viewModel(s){
 if(!s?.manipulative)return '';
 const m=s.manipulative,opts={language:lang,token:'star',palette:'violet'};
 if(m.kind==='two-groups')return renderCompare(m.counts[0],m.counts[1],{...opts,showCounts:true});
 return renderTenFrame(m.counts[0],opts);
}
function choices(s){
 const spec=s.answerSpec;
 if(topicId==='bonds-to-10')return '<p class="try-help">'+tr('numberAdded')+': <strong id="counter" aria-live="polite">0</strong></p>';
 const values=spec.kind==='side'?['left','right','equal']:Array.from({length:11},(_,i)=>i);
 const name=x=>spec.kind==='side'?tr(x):String(x);
 return '<p class="try-help">'+tr('pick')+'</p><div class="answers '+(spec.kind==='side'?'side-answers':'')+'" role="group" aria-label="'+tr('pick')+'">'+values.map(x=>'<button class="answer-button" data-answer="'+x+'" aria-pressed="'+(answer===x)+'">'+esc(name(x))+'</button>').join('')+'</div>';
}
function lessonPage(){
 if(stepIndex===3)return '<section class="lesson-card completion"><span class="big">🎉</span><div class="eyebrow">'+tr('finished')+'</div><h2>'+tr('done')+'</h2><p>'+tr('doneText')+'</p><div class="foot-actions"><button class="link-button" data-click="repeat">'+tr('again')+'</button><button class="next-button" data-click="after">'+(lessonIndex===2?tr('restart'):tr('following'))+' →</button></div></section>';
 const s=currentStep(),practicing=stepIndex===1,illustration=stepIndex===2?currentLesson().steps[1]:s;
 const steps=[0,1,2].map(n=>'<span class="step '+(n===stepIndex?'current':n<stepIndex?'past':'')+'"></span>').join('');
 const instructions=stepIndex===0?tr('watch'):stepIndex===2?tr('reflection'):topicId==='count-to-10'?tr('tapCount'):topicId==='compare-to-10'?tr('tapCompare'):tr('tapBond');
 const result=outcome?'<div class="status '+(outcome==='correct'?'good':'bad')+'" role="status">'+(outcome==='correct'?tr('success')+' '+esc(localized(s.explanation)):outcome==='revealed'?tr('answer')+': '+esc(String(s.answerSpec.value))+'. '+esc(localized(s.explanation)):tr('wrong'))+'</div>':'';
 return '<section class="lesson-card"><div class="lesson-meta"><span>'+tr('lesson')+' '+(lessonIndex+1)+' '+tr('of')+' 3</span><span>'+tr('step')[stepIndex]+' '+(stepIndex+1)+'/3</span></div><div class="steps" role="progressbar" aria-label="Lesson progress" aria-valuemin="1" aria-valuemax="3" aria-valuenow="'+(stepIndex+1)+'">'+steps+'</div><div class="eyebrow">'+esc(localized(currentTopic().name))+' / '+tr('step')[stepIndex]+'</div><h2>'+esc(localized(s.prompt))+'</h2><p class="instruction">'+instructions+'</p><div id="visual" class="visual-box">'+(practicing?'':viewModel(s))+'</div>'+ (practicing?choices(s):'')+result+'<div class="foot-actions">'+(practicing?'<button class="link-button" data-click="hint" '+(outcome==='correct'||outcome==='revealed'?'disabled':'')+'>💡 '+tr('hint')+'</button><button class="link-button" data-click="check" '+(outcome==='correct'||outcome==='revealed'?'disabled':'')+'>'+tr('check')+'</button>':'')+'<button class="next-button" data-click="next" '+(practicing&&outcome!=='correct'&&outcome!=='revealed'?'disabled':'')+'>'+(stepIndex===2?tr('complete'):tr('next'))+' →</button></div></section>';
}
function attachVisual(){
 const host=document.getElementById('visual'),m=currentStep().manipulative;
 if(!host||!m)return;
 const opts={language:lang,token:'star',palette:'violet'};
 if(m.kind==='two-groups'){
 const component=mountCompare(host,{left:m.counts[0],right:m.counts[1],...opts,onChange:()=>{}});
 mounted=component.destroy;
 }else{
 const mode=topicId==='bonds-to-10'?'build':'count';
 const component=mountTenFrame(host,{count:m.counts[0],mode,...opts,onChange:s=>{
 chosenCount=s.total;
 if(mode==='build'){answer=s.selected.length;document.getElementById('counter').textContent=String(answer)}
 else host.setAttribute('aria-description',tr('status')+': '+s.total);
 }});
 mounted=component.destroy;
 }
}
function render(){
 if(mounted){mounted();mounted=null}
 document.documentElement.lang=lang;
 root.innerHTML=header()+hero()+topicCards()+'<div class="lesson-layout">'+lessonNav()+lessonPage()+'</div><p class="footer-note">'+tr('privacy')+'</p>';
 if(stepIndex===1){if(outcome==='correct'||outcome==='revealed'){
 const m=currentStep().manipulative;
 const visual=document.getElementById('visual');
 if(m.kind==='two-groups')visual.innerHTML=renderCompare(m.counts[0],m.counts[1],{language:lang,token:'star',palette:'violet',showCounts:true});
 else if(topicId==='bonds-to-10')visual.innerHTML=renderTenFrame(m.counts[0],{language:lang,token:'star',palette:'violet',mode:'build',selected:Array.from({length:10-m.counts[0]},(_,i)=>m.counts[0]+i)});
 else visual.innerHTML=renderTenFrame(m.counts[0],{language:lang,token:'star',palette:'violet'});
 }else attachVisual()}

}
function next(){
 if(stepIndex===1&&outcome!=='correct'&&outcome!=='revealed')return;
 if(stepIndex===2){done[currentLesson().id]=true;stepIndex=3;}
 else if(stepIndex<2){stepIndex++;resetAnswers();}
 save();render();
}
function notify(message,type='info'){
 let x=document.getElementById('feedback-msg');
 if(!x){x=document.createElement('div');x.id='feedback-msg';x.className='status '+type;x.setAttribute('role','status');document.querySelector('.lesson-card .foot-actions')?.before(x)}
 if(x)x.textContent=message;
}
function check(){
 if(stepIndex!==1||outcome==='correct'||outcome==='revealed')return;
 if(answer===null){notify(tr('choose'));return}
 const spec=currentStep().answerSpec;
 const yes=spec.kind==='number'?Number(answer)===spec.value:answer===spec.value;
 if(yes){outcome='correct';}
 else{attempts++;if(attempts>=2)outcome='revealed';else{outcome='wrong';if(topicId==='bonds-to-10'){answer=null;chosenCount=0;}}}
 save();render();
}
root.addEventListener('click',e=>{
 const button=e.target.closest('[data-click],[data-topic],[data-lesson],[data-answer]');
 if(!button)return;
 if(button.dataset.topic){chooseTopic(button.dataset.topic);return}
 if(button.dataset.lesson!==undefined){chooseTopic(topicId,Number(button.dataset.lesson));return}
 if(button.dataset.answer!==undefined){const value=button.dataset.answer;answer=/^(0|[1-9]|10)$/.test(value)?Number(value):value;root.querySelectorAll('[data-answer]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));return}
 const action=button.dataset.click;
 if(action==='language'){lang=lang==='en'?'vi':'en';save();render();}
 else if(action==='theme'){theme=theme==='dark'?'light':'dark';try{localStorage.setItem(THEME,theme)}catch{}setTheme();render();}
 else if(action==='next')next();
 else if(action==='check')check();
 else if(action==='hint'){const s=currentStep();notify(tr('hintHead')+': '+esc(localized(s.hintSteps[0])));}
 else if(action==='repeat')chooseTopic(topicId,lessonIndex);
 else if(action==='after')chooseTopic(topicId,(lessonIndex+1)%3);
});
async function init(){
 lang=navigator.language?.startsWith('vi')?'vi':'en';
 startState();
 try{
 const response=await fetch('../content/v1/topics.json');
 if(!response.ok)throw Error('HTTP '+response.status);
 const j=await response.json();
 if(j.schemaVersion!==1||!Array.isArray(j.topics)||j.topics.length!==3||!IDS.every(id=>j.topics.some(t=>t.id===id&&t.lessons?.length===3)))throw Error('Invalid curriculum data');
 data=j;render();
 }catch(e){
 console.error('MindForge Learn content:',e);
 document.documentElement.lang=lang;
 root.innerHTML=header()+'<section class="lesson-card loading" role="alert">'+tr('loadError')+'<p><button class="next-button" data-click="refresh">'+tr('refresh')+'</button></p></section>';
 }
}
init();
