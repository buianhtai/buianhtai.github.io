/* MindForge Sound Kit v2.5. Original Web Audio SFX, inspired by Earshot's named synthesis bank.
 * Reference: https://github.com/Leonxlnx/earshot (MIT). No Earshot code/audio bundled.
 * Opt-in, offline, no microphone, tracking, remote assets or autoplay.
 */
(()=>{'use strict';
const STORAGE_ON='mf-audio-enabled-v1',STORAGE_VOLUME='mf-audio-volume-v1';
const load=(key,fallback)=>{try{const val=localStorage.getItem(key);return val===null?fallback:val}catch{return fallback}};
let enabled=load(STORAGE_ON,'false')==='true';
let volume=Math.max(0,Math.min(1,parseFloat(load(STORAGE_VOLUME,'0.55'))||0));
let ctx=null,master=null,lastAt=Object.create(null),voices=0;
const MAX_VOICES=16;
const toneBank={
 tap:[[520,420,.064,0,'sine',.15]],
 open:[[392,560,.11,0,'triangle',.18],[590,700,.13,.07,'sine',.12]],
 next:[[470,640,.10,0,'sine',.17]],
 select:[[690,780,.075,0,'sine',.15]],
 move:[[290,350,.073,0,'triangle',.14]],
 step:[[300,370,.075,0,'sine',.12]],
 place:[[400,320,.09,0,'triangle',.20],[650,520,.055,.024,'sine',.08]],
 undo:[[400,270,.1,0,'sine',.14]],
 collect:[[660,880,.12,0,'sine',.19],[890,1160,.13,.07,'sine',.14]],
 miss:[[265,220,.14,0,'triangle',.14],[220,185,.14,.065,'sine',.08]],
 success:[[523,622,.15,0,'sine',.17],[659,740,.16,.068,'sine',.16],[784,900,.19,.138,'sine',.14]],
 complete:[[440,495,.18,0,'sine',.18],[554,640,.19,.095,'sine',.16],[659,784,.20,.19,'sine',.15],[880,1100,.28,.30,'triangle',.17]]
};
const save=(key,value)=>{try{localStorage.setItem(key,String(value))}catch{}};
const ensureAudio=()=>{
 if(!enabled)return null;
 if(!ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;
  try{ctx=new Audio();master=ctx.createGain();master.gain.value=volume*.52;master.connect(ctx.destination)}catch{ctx=null;master=null;return null}}
 if(ctx.state==='suspended'){try{ctx.resume().catch(()=>{})}catch{}}
 return ctx;
};
function play(role='tap'){
 if(!enabled||volume<=0||document.hidden)return false;
 const recipe=toneBank[role]||toneBank.tap,now=performance.now(),limit=['move','step','tap','select','place'].includes(role)?75:role==='miss'?180:0;
 if(now-(lastAt[role]||-1e8)<limit)return false;
 const c=ensureAudio();if(!c||voices>=MAX_VOICES)return false;
 lastAt[role]=now;
 try{
  for(const [start,end,duration,offset,wave,peak] of recipe){
   if(voices>=MAX_VOICES)break;
   const osc=c.createOscillator(),env=c.createGain(),t=c.currentTime+offset;
   osc.type=wave;osc.frequency.setValueAtTime(start,t);osc.frequency.exponentialRampToValueAtTime(Math.max(30,end),t+duration);
   env.gain.setValueAtTime(.0001,t);env.gain.exponentialRampToValueAtTime(peak,t+.012);
   env.gain.exponentialRampToValueAtTime(.0001,t+duration+.018);
   osc.connect(env);env.connect(master);voices++;
   osc.onended=()=>{voices=Math.max(0,voices-1);osc.disconnect();env.disconnect()};
   osc.start(t);osc.stop(t+duration+.03);
  }
  return true;
 }catch{return false}
}
function setEnabled(next){enabled=!!next;save(STORAGE_ON,enabled);renderUI();if(enabled)play('open');else if(ctx&&ctx.state==='running'){ctx.suspend().catch(()=>{})}}
function setVolume(v){volume=Math.max(0,Math.min(1,Number(v)||0));save(STORAGE_VOLUME,volume.toFixed(2));if(master)master.gain.value=volume*.52;renderUI()}
const isVi=()=>document.documentElement.lang.toLowerCase().startsWith('vi');
function renderUI(){
 const button=document.getElementById('mf-sfx-toggle'),slider=document.getElementById('mf-sfx-volume');
 if(!button||!slider)return;
 button.textContent=(enabled?'🔊 ':'🔇 ')+(isVi()?(enabled?'Âm thanh bật':'Âm thanh tắt'):(enabled?'Sound on':'Sound off'));
 button.setAttribute('aria-pressed',String(enabled));
 button.setAttribute('aria-label',isVi()?(enabled?'Tắt âm thanh trò chơi':'Bật âm thanh trò chơi'):(enabled?'Mute game sounds':'Enable game sounds'));
 slider.value=String(Math.round(volume*100));slider.disabled=!enabled;
 slider.setAttribute('aria-label',isVi()?'Âm lượng trò chơi':'Game sound volume');
 slider.title=isVi()?'Âm lượng':'Volume';
 document.getElementById('mf-sfx-panel')?.classList.toggle('mf-sfx-muted',!enabled);
}
function buildUI(){
 const host=document.querySelector('.top-actions, .top-tools');if(!host||host.querySelector('#mf-sfx-panel'))return;
 const panel=document.createElement('div');panel.id='mf-sfx-panel';panel.className='mf-sfx-panel';
 panel.innerHTML='<button type="button" class="mf-sfx-toggle" id="mf-sfx-toggle" aria-pressed="false"></button><input type="range" min="0" max="100" step="5" value="55" id="mf-sfx-volume">';
 host.append(panel);renderUI();
}
const css=".mf-sfx-panel{display:inline-flex;align-items:center;gap:8px;min-height:42px;border:1px solid #6e75a068;background:#252d4a;border-radius:13px;padding:4px 10px 4px 4px;max-width:100%;flex-shrink:0}.mf-sfx-toggle{min-width:132px;min-height:36px;display:inline-flex;align-items:center;justify-content:center;padding:5px 8px;border:0;background:transparent;color:#f7f5ff;font-weight:750;font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}.mf-sfx-toggle:focus-visible,.mf-sfx-panel input:focus-visible{outline:3px solid #e3d9ff;outline-offset:3px;border-radius:7px}.mf-sfx-panel input[type=range]{width:74px;min-width:60px;accent-color:#a8a0ff;height:30px;touch-action:pan-y;cursor:pointer}.mf-sfx-muted input[type=range]{opacity:.42;cursor:not-allowed}@media(max-width:520px){.mf-sfx-panel{padding-right:7px;gap:3px}.mf-sfx-toggle{min-width:118px;padding:5px 3px;font-size:11px}.mf-sfx-panel input[type=range]{width:64px;min-width:45px}}";
const style=document.createElement('style');style.id='mf-sfx-style';style.textContent=css;document.head.append(style);
document.addEventListener('click',e=>{if(e.target.closest('#mf-sfx-toggle')){e.preventDefault();setEnabled(!enabled);return}if(e.target.closest('[data-lang],#lang'))queueMicrotask(renderUI)},true);
document.addEventListener('input',e=>{if(e.target.id==='mf-sfx-volume')setVolume(e.target.value/100)});
let pending=false;const update=()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;buildUI()})};
const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true});
window.MindForgeSound={play,setEnabled,setVolume,get enabled(){return enabled},get volume(){return volume},roles:Object.keys(toneBank)};
buildUI();
})();