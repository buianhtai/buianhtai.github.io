import {generateQuestion,evaluateQuestion} from './engine.mjs';
import {renderTenFrame,renderCompare,mountTenFrame,mountCompare} from './manipulatives.mjs';
import {TOPICS,read,write,createSession,recordAnswer,reviewQuestions,summary,exportData,clearProgress} from './progress.mjs';

const root=document.getElementById('app');
const isReview=location.pathname.includes('/review/');
const messages={
en:{brand:'Visual Math',back:'Math Quest',learn:'Learn',practice:'Practice',review:'Review',light:'Light',dark:'Dark',
title:'Practice with pictures.',reviewTitle:'Make every mistake a chance to learn.',
intro:'Choose a topic, count real pictures and learn one question at a time. No timer.',reviewIntro:'Review the concepts that were tricky. The pictures change so you can practice understanding.',
topics:'Choose a topic',count:'Count to 10',compare:'Compare groups',bonds:'Make 10',difficulty:'Difficulty',starter:'Beginner',normal:'Normal',advanced:'Advanced',begin:'Start practice',restart:'New session',
question:'Question',of:'of',score:'Score',attempts:'Attempts',correct:'Correct',retry:'Try again',reveal:'The answer is',good:'Great thinking! Correct.',bad:'Not quite. Look again and try once more.',check:'Check answer',next:'Next question',finish:'See results',hint:'Show hint',choose:'Choose an answer',selectMore:'Which group has more?',left:'Left group',right:'Right group',equal:'Equal groups',countTip:'Tap each object, then select the number.',compareTip:'Pair objects and decide which group has more.',bondTip:'Tap the empty boxes until you make ten.',bondsPicked:'Objects added',timer:'No timer. Learn at your own pace.',auto:'Auto Next',on:'On',off:'Off',complete:'Nice work! Session complete.',summary:'Your activity on this device',noMistakes:'No missed concepts to review yet. Practice first, then come back.',startReview:'Start mistake review',unresolved:'Needs practice',reviewAgain:'Another review',reviewTip:'Same concept, different picture',replayed:'Saved automatically',total:'Total attempts',correctCount:'Correct answers',afterRetry:'Correct after retry',last:'Last played',clear:'Clear learning data',export:'Export progress',clearAsk:'Clear Math Learning attempts and mistakes on this device? Existing Math Quest scores will remain.',privacy:'No accounts or remote analytics. This is practice, not an intelligence score.',error:'Sorry, we could not open this question. Try starting a new session.',learnlink:'Learn with pictures',free:'Keep practicing',done:'Done'},
vi:{brand:'Toán trực quan',back:'Math Quest',learn:'Học',practice:'Luyện tập',review:'Ôn lại',light:'Sáng',dark:'Tối',
title:'Luyện toán bằng hình ảnh.',reviewTitle:'Mỗi lỗi sai là một cơ hội học thêm.',
intro:'Chọn chủ đề, đếm hình và giải từng câu theo nhịp của bé. Không giới hạn thời gian.',reviewIntro:'Ôn lại những kiến thức còn khó. Hình ảnh sẽ thay đổi để bé thực sự hiểu bài.',
topics:'Chọn chủ đề',count:'Đếm đến 10',compare:'So sánh nhóm',bonds:'Ghép thành 10',difficulty:'Cấp độ',starter:'Làm quen',normal:'Bình thường',advanced:'Nâng cao',begin:'Bắt đầu luyện tập',restart:'Lượt mới',
question:'Câu',of:'trên',score:'Điểm',attempts:'Số lần làm',correct:'Làm đúng',retry:'Thử lại',reveal:'Đáp án đúng là',good:'Giỏi lắm! Chính xác.',bad:'Chưa đúng. Nhìn lại và thử thêm một lần nhé.',check:'Kiểm tra',next:'Câu tiếp',finish:'Xem kết quả',hint:'Xem gợi ý',choose:'Chọn đáp án',selectMore:'Nhóm nào nhiều hơn?',left:'Bên trái',right:'Bên phải',equal:'Hai nhóm bằng nhau',countTip:'Chạm từng đồ vật rồi chọn số đúng.',compareTip:'Ghép cặp và tìm nhóm có nhiều đồ vật hơn.',bondTip:'Chạm các ô trống để điền đủ mười đồ vật.',bondsPicked:'Số đồ vật đã thêm',timer:'Không tính giờ. Bé học theo nhịp của mình.',auto:'Tự chuyển',on:'Bật',off:'Tắt',complete:'Tuyệt vời! Hoàn thành lượt chơi.',summary:'Hoạt động trên thiết bị này',noMistakes:'Hiện chưa có kiến thức nào cần ôn. Bé hãy luyện tập trước nhé.',startReview:'Bắt đầu ôn lỗi sai',unresolved:'Cần ôn thêm',reviewAgain:'Ôn lần nữa',reviewTip:'Cùng kiến thức, hình ảnh khác',replayed:'Tự động lưu',total:'Tổng lượt trả lời',correctCount:'Làm đúng',afterRetry:'Đúng sau khi thử lại',last:'Lần gần nhất',clear:'Xóa dữ liệu luyện tập',export:'Xuất tiến trình',clearAsk:'Xóa lịch sử và lỗi sai của Math Learning trên thiết bị này? Điểm Math Quest cũ vẫn được giữ.',privacy:'Không cần tài khoản, không theo dõi trực tuyến. Đây là trò chơi luyện tập, không đánh giá trí thông minh.',error:'Không thể mở câu hỏi. Hãy thử bắt đầu lượt mới.',learnlink:'Học qua hình',free:'Luyện tập thêm',done:'Hoàn thành'}
};
const toText=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
let lang=navigator.language?.toLowerCase().startsWith('vi')?'vi':'en',theme='light',store=read(),session=store.session;
let chosenTopic='count-to-10',chosenDifficulty='starter',hint=false,chosen=null,mounted=null,autoTimer=null;
const tr=k=>messages[lang][k]||k;
const trObj=o=>o?.[lang]||o?.en||'';
const persist=()=>{store.session=session;write(store)};
function cancelTimer(){if(autoTimer!==null){clearTimeout(autoTimer);autoTimer=null}}
function themeSet(){
 document.documentElement.lang=lang;
 document.documentElement.dataset.theme=theme;
 const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='dark'?'#10172a':'#f6f8fc';
}
function active(){
 if(!session||session.finished||session.index>=session.questions.length)return null;
 const q=session.questions[session.index];
 return generateQuestion(q.topicId,{seed:q.seed,index:q.index,difficulty:q.difficulty});
}
function newSession(){
 cancelTimer();hint=false;chosen=null;
 if(isReview){
  const list=reviewQuestions(store,{max:7});if(!list.length){session=null;persist();draw();return}
  session=createSession({topicId:list[0].topicId,difficulty:list[0].difficulty,mode:'review',seed:list[0].seed,questions:list});
 }else session=createSession({topicId:chosenTopic,difficulty:chosenDifficulty,mode:'practice',seed:Date.now()>>>0});
 persist();draw();
}
function header(){
 const nav=[['../','back'],['../learn/','learn'],['../practice/','practice'],['../review/','review']];
 return '<header class="top"><a class="brand" href="../">✦ MindForge <em>/ '+tr('brand')+'</em></a><nav class="topnav" aria-label="Math Quest">'+nav.map(([url,key])=>'<a class="btn" href="'+url+'" '+((key==='practice'&&!isReview||key==='review'&&isReview)?'aria-current="page"':'')+'>'+tr(key)+'</a>').join('')+
 '<button class="btn" data-action="theme" aria-pressed="'+(theme==='dark')+'">'+(theme==='dark'?'☀ ':'☾ ')+tr(theme)+'</button><button class="btn" data-action="language" aria-label="Switch language">'+(lang==='vi'?'EN':'VI')+'</button></nav></header>';
}
function modeCards(){
 const label=(id)=>id==='count-to-10'?tr('count'):id==='compare-to-10'?tr('compare'):tr('bonds');
 const icons=['🧮','⚖️','🔟'];
 return '<div class="modes">'+TOPICS.map((id,i)=>'<button class="mode" data-topic="'+id+'" aria-pressed="'+(chosenTopic===id)+'"><span aria-hidden="true" style="font-size:26px">'+icons[i]+'</span><strong>'+label(id)+'</strong><small>'+tr('practice')+' ↗</small></button>').join('')+'</div>';
}
function controls(){
 return '<div class="control-row"><label for="difficulty">'+tr('difficulty')+'</label><select id="difficulty">'+['starter','normal','advanced'].map(d=>'<option value="'+d+'" '+(chosenDifficulty===d?'selected':'')+'>'+tr(d)+'</option>').join('')+'</select><button class="btn primary" data-action="new">'+tr('begin')+'</button></div>';
}
function stats(){
 const s=summary(store);
 const fields=[['total',s.attempts],['correctCount',s.correct],['unresolved',s.unresolved],['score',session?.score||0]];
 return '<div class="stats">'+fields.map(([k,v])=>'<div class="stat"><b>'+v+'</b><span>'+tr(k)+'</span></div>').join('')+'</div>';
}
function aside(){
 const s=summary(store);
 const rows=TOPICS.map(id=>{
  const k=id==='count-to-10'?'count':id==='compare-to-10'?'compare':'bonds';
  const z=s.topics[id];
  return '<tr><td>'+tr(k)+'</td><td>'+z.attempts+'</td><td>'+z.correct+'</td><td>'+z.unresolved+'</td></tr>';
 });
 return '<aside class="card aside"><h3>'+tr('summary')+'</h3>'+stats()+
 '<table class="summary-table"><thead><tr><th>'+tr('topics')+'</th><th>'+tr('attempts')+'</th><th>'+tr('correct')+'</th><th>'+tr('unresolved')+'</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>'+
 '<p>'+tr('timer')+'</p><div class="actions"><button class="btn" data-action="export">'+tr('export')+'</button><button class="btn" data-action="clear">'+tr('clear')+'</button></div></aside>';
}
function intro(){
 const content=isReview?'<p class="warning">'+tr('reviewTip')+'</p><div class="actions"><button class="btn primary" data-action="new">'+tr('startReview')+'</button><a class="btn" href="../practice/">'+tr('free')+'</a></div>':'<p class="muted">'+tr('intro')+'</p>';
 const completed=session?.finished?finish():isReview&&!store.mistakes.length?'<div class="card completion"><h2>'+tr('noMistakes')+'</h2><a class="btn primary" href="../practice/">'+tr('free')+'</a></div>':'<div class="card">'+content+'</div>';
 return '<section class="hero"><p class="eyebrow">MINDFORGE / '+(isReview?'REVIEW':'PRACTICE')+'</p><h1>'+tr(isReview?'reviewTitle':'title')+'</h1><p>'+tr(isReview?'reviewIntro':'intro')+'</p></section>'+
 (!isReview?'<section aria-label="'+tr('topics')+'">'+modeCards()+controls()+'</section>':'')+
 '<div class="deck"><div>'+completed+'</div>'+aside()+'</div>';
}
function choices(q){
 const side=q.answerSpec.kind==='side';
 const labels={left:tr('left'),right:tr('right'),equal:tr('equal')};
 return '<div class="choices '+(side?'side':'')+'" role="group" aria-label="'+tr('choose')+'">'+
  q.options.map(a=>'<button class="choice" data-answer="'+a.value+'" aria-pressed="'+(chosen===a.value)+'" '+(session.feedback==='correct'||session.feedback==='revealed'?'disabled':'')+'>'+toText(side?labels[a.value]:a.value)+'</button>').join('')+'</div>';
}
function questionView(){
 const q=active();if(!q)return '<div class="card"><p>'+tr('error')+'</p><button class="btn" data-action="new">'+tr('restart')+'</button></div>';
 const ended=session.feedback==='correct'||session.feedback==='revealed';
 const visual=q.manipulative.kind==='two-groups'?renderCompare(q.manipulative.counts[0],q.manipulative.counts[1],{language:lang,token:q.manipulative.visual.tokenId,palette:q.manipulative.visual.palette,showCounts:false}):renderTenFrame(q.manipulative.counts[0],{language:lang,mode:'count',token:q.manipulative.visual.tokenId,palette:q.manipulative.visual.palette});
 let feedback='';
 if(session.feedback){
  const correct=session.feedback==='correct';
  feedback='<div class="feedback '+(correct?'good':'bad')+'" role="status"><strong>'+tr(correct?'good':session.feedback==='revealed'?'reveal':'bad')+'</strong> '+
  (ended?toText(trObj(q.explanation)):'')+'</div>';
 }
 const tip=q.topicId==='count-to-10'?'countTip':q.topicId==='compare-to-10'?'compareTip':'bondTip';
 return '<section class="card problem"><div class="progress-line"><span>'+tr('question')+' '+(session.index+1)+' '+tr('of')+' '+session.questions.length+'</span><span>'+tr('replayed')+'</span></div>'+
 '<div class="progress"><i style="width:'+(100*session.index/session.questions.length)+'%"></i></div><p class="eyebrow">'+tr(q.topicId==='count-to-10'?'count':q.topicId==='compare-to-10'?'compare':'bonds')+'</p>'+
 '<h2>'+toText(trObj(q.prompt))+'</h2><p class="muted">'+tr(tip)+'</p>'+
 '<div class="artboard" id="visual" aria-label="'+toText(tr(tip))+'">'+visual+'</div>'+
 choices(q)+feedback+
 (hint?'<div class="feedback" role="status">💡 '+toText(trObj(q.hintSteps[Math.min(1,session.tries)]))+'</div>':'')+
 '<div class="actions"><button class="btn" data-action="hint" '+(ended?'disabled':'')+'>💡 '+tr('hint')+'</button>'+
 '<button class="btn primary" data-action="check" '+(ended||chosen===null?'disabled':'')+'>'+tr('check')+'</button>'+
 '<button class="btn primary" data-action="next" '+(!ended?'disabled':'')+'>'+tr(session.index+1===session.questions.length?'finish':'next')+' →</button></div>'+
 '<div class="control-row" style="margin-top:16px"><label>'+tr('auto')+'</label><button class="btn" data-action="auto" aria-pressed="'+store.preferences.autoNext+'">'+tr(store.preferences.autoNext?'on':'off')+'</button></div></section>';
}
function finish(){
 const count=session?.questions.length||0;
 return '<section class="card completion"><div style="font-size:52px" aria-hidden="true">🏆</div><p class="eyebrow">'+tr('complete')+'</p><h2>'+tr('complete')+'</h2><p class="muted">'+tr('score')+': '+(session?.score||0)+' / '+(count*10)+'</p><div class="finish-actions"><button class="btn primary" data-action="new">'+tr(isReview?'reviewAgain':'restart')+'</button><a class="btn" href="'+(isReview?'../practice/':'../review/')+'">'+tr(isReview?'free':'review')+'</a></div></section>';
}
function draw(){
 cancelTimer();
 if(mounted){mounted.destroy();mounted=null}
 themeSet();
 if(isReview&&!session?.finished&&session?.mode!=='review')session=null;
 if(!isReview&&session?.mode==='review')session=null;
 const q=active();
 root.innerHTML=header()+((!session||session.finished)?intro():'<section class="hero"><p class="eyebrow">MINDFORGE / '+(isReview?'REVIEW':'PRACTICE')+'</p><h1>'+tr(isReview?'reviewTitle':'title')+'</h1><p>'+tr(isReview?'reviewIntro':'intro')+'</p></section><div class="deck">'+questionView()+aside()+'</div>')+'<p class="bottomnote">'+tr('privacy')+'</p>';
 if(q){
  const host=document.getElementById('visual');
  if(q.manipulative.kind==='two-groups'){
   mounted=mountCompare(host,{left:q.manipulative.counts[0],right:q.manipulative.counts[1],language:lang,token:q.manipulative.visual.tokenId,palette:q.manipulative.visual.palette,onChange:()=>{}});
  }else{
   mounted=mountTenFrame(host,{count:q.manipulative.counts[0],mode:'count',language:lang,token:q.manipulative.visual.tokenId,palette:q.manipulative.visual.palette,onChange:()=>{}});
  }
 }
}
function check(){
 if(!session||session.finished||session.feedback==='correct'||session.feedback==='revealed'||chosen===null)return;
 const q=active();const good=evaluateQuestion(q,chosen);session.tries++;
 if(good){
  session.feedback='correct';session.score+=(session.tries===1?10:5);
  store=recordAnswer(store,q,{answer:chosen,correct:true,hintUsed:hint,tries:session.tries});
  persist();draw();
  if(store.preferences.autoNext&&!matchMedia('(prefers-reduced-motion: reduce)').matches)autoTimer=setTimeout(next,1700);
 }else if(session.tries>=2){
  session.feedback='revealed';store=recordAnswer(store,q,{answer:chosen,correct:false,hintUsed:hint,tries:session.tries});persist();draw();
 }else{
  session.feedback='wrong';persist();draw();
 }
}
function next(){
 cancelTimer();if(!session||!['correct','revealed'].includes(session.feedback))return;
 session.index++;session.tries=0;session.answer=null;session.feedback=null;session.hintUsed=false;hint=false;chosen=null;
 if(session.index>=session.questions.length)session.finished=true;
 persist();draw();
}
function exportFile(){
 const data=exportData(store);
 const blob=new Blob([data],{type:'application/json'});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='mindforge-math-learning-progress.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),4000);
}
root.addEventListener('click',e=>{
 const b=e.target.closest('[data-action],[data-topic],[data-answer]');if(!b)return;
 if(b.dataset.topic){chosenTopic=b.dataset.topic;draw();return}
 if(b.dataset.answer!==undefined){
  if(!session||['correct','revealed'].includes(session.feedback))return;
  const a=b.dataset.answer;chosen=/^(0|[1-9]\d*)$/.test(a)?Number(a):a;
  document.querySelectorAll('[data-answer]').forEach(node=>node.setAttribute('aria-pressed',String(node===b)));
  document.querySelector('[data-action="check"]')?.removeAttribute('disabled');return;
 }
 const k=b.dataset.action;if(!k)return;
 if(k==='theme'){theme=theme==='dark'?'light':'dark';try{localStorage.setItem('mf-library-theme',theme)}catch{}draw()}
 if(k==='language'){lang=lang==='vi'?'en':'vi';draw()}
 if(k==='new')newSession();
 if(k==='check')check();
 if(k==='next')next();
 if(k==='hint'){hint=true;session.hintUsed=true;persist();draw()}
 if(k==='auto'){store.preferences.autoNext=!store.preferences.autoNext;persist();draw()}
 if(k==='export')exportFile();
 if(k==='clear'&&confirm(tr('clearAsk'))){cancelTimer();store=clearProgress(store);session=null;persist();draw();}
});
root.addEventListener('change',e=>{if(e.target.id==='difficulty'){chosenDifficulty=e.target.value;draw()}});
function init(){
 try{theme=localStorage.getItem('mf-library-theme')==='dark'?'dark':'light'}catch{}
 if(session?.topicId)chosenTopic=session.topicId;
 if(session?.difficulty)chosenDifficulty=session.difficulty;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!session?.finished){store.preferences.autoNext=false}
 draw();
}
init();
