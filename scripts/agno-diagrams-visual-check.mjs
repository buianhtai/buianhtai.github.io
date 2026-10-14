import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const host='http://127.0.0.1:4387',route='/en/labs/agno-diagrams/',out='artifacts/agno-diagrams';
await mkdir(out,{recursive:true});
const proc=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4387'],{stdio:['ignore','pipe','pipe'],env:process.env});
let logs='';proc.stdout.on('data',x=>logs+=String(x));proc.stderr.on('data',x=>logs+=String(x));
let browser;
try{
 let ready=false;
 for(let i=0;i<90;i++){
  try{ready=(await fetch(host+route)).ok;if(ready)break}catch{}
  await new Promise(r=>setTimeout(r,175))
 }
 assert(ready,'Diagram viewer unavailable: '+logs.slice(-500));
 browser=await chromium.launch({headless:true});
 for(const width of [390,768,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await ctx.route('**/*',r=>r.request().url().startsWith(host)?r.continue():r.abort());
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(host+route,{waitUntil:'domcontentloaded'});
  const lab=page.locator('#agno-diagram-explorer');
  await page.waitForFunction(()=>document.querySelector('#agno-diagram-explorer')?.dataset.initialized==='yes');
  assert.equal(await lab.getAttribute('data-initialized'),'yes');
  assert.equal(await lab.locator('[data-diagram]').count(),4,'Four architecture diagrams');
  assert.equal(await lab.locator('[data-scene="system"] .de-node').count(),8);
  assert.equal(await lab.locator('[data-scene="system"]').isVisible(),true,'System diagram is starting view');
  assert.equal(await lab.locator('[data-scene="assembly"]').isVisible(),false);
  const bounds=await lab.locator('#de-stage').boundingBox();
  assert(bounds&&bounds.y<310,'Diagram should be immediately visible above fold: '+bounds?.y);
  const initialBox=await lab.locator('[data-scene="system"] .de-svg').getAttribute('viewBox');
  if(width===390){
    assert.equal(await lab.locator('[data-scene="system"] .de-mobile-flow').isVisible(),true,'Mobile opens as readable vertical architecture');
    assert.equal(await lab.locator('[data-scene="system"] .de-mobile-card').count(),8);
    assert.equal(await lab.locator('[data-scene="system"] .de-svg').isVisible(),false,'Do not shrink complete desktop graph by default');
  }
  await page.screenshot({path:out+'/system-'+width+'.png',fullPage:false});
  await lab.locator('#de-only').click();
  assert.equal(await lab.evaluate(el=>el.classList.contains('is-only')),true,'Diagram-only hides explanatory panels');
  assert.equal(await lab.locator('#de-inspector').isVisible(),false);
  const onlyStage=await lab.locator('#de-stage').boundingBox();
  assert(onlyStage&&onlyStage.height>530,'Diagram-only enlarges the diagram');
  await page.screenshot({path:out+'/diagram-only-'+width+'.png',fullPage:false});
  await lab.locator('[data-diagram="assembly"]').click();
  assert.equal(await lab.locator('[data-scene="assembly"]').isVisible(),true);
  assert.equal(await lab.locator('[data-scene="system"]').isVisible(),false);
  if(width===390){
    await lab.locator('[data-scene="assembly"] [data-mobile-node="app"]').click();
    assert.match(await lab.locator('#de-inspect-title').innerText(),/get_app/);
    const card=lab.locator('[data-scene="assembly"] [data-mobile-card="app"]');
    assert.match(await card.innerText(),/Read implementation/);
  }
  await page.screenshot({path:out+'/assembly-only-'+width+'.png',fullPage:false});
  await lab.locator('#de-only').click();
  assert.equal(await lab.locator('#de-inspector').isVisible(),true);
  await lab.locator('[data-scene="assembly"] [data-node="app"]').evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.match(await lab.locator('#de-inspect-title').innerText(),/get_app/);
  assert.match(await lab.locator('#de-inspect-source').getAttribute('href'),/os\/app.py#L1430$/);
  assert((await lab.locator('#de-relationships button').count())>=2,'Connected relationships are inspectable');
  const before=await lab.locator('[data-scene="assembly"] .de-svg').getAttribute('viewBox');
  if(width===390){
    await lab.locator('#de-mobile-canvas').click();
    assert.equal(await lab.locator('[data-scene="assembly"] .de-svg').isVisible(),true,'Phone can switch to pannable canvas');
  }
  await lab.locator('#de-zoom-in').click();
  assert.notEqual(await lab.locator('[data-scene="assembly"] .de-svg').getAttribute('viewBox'),before,'Zoom updates diagram viewport');
  await lab.locator('#de-fit').click();
  assert.equal(await lab.locator('[data-scene="assembly"] .de-svg').getAttribute('viewBox'),'0 0 1300 650');
  if(width===390){
    await lab.locator('#de-mobile-canvas').click();
    assert.equal(await lab.locator('[data-scene="assembly"] .de-mobile-flow').isVisible(),true,'Readable mobile map restored');
  }
  await lab.locator('[data-diagram="request"]').click();
  assert.match(await lab.locator('#de-heading-title').innerText(),/normal answer/i);
  await page.screenshot({path:out+'/request-'+width+'.png',fullPage:false});
  await lab.locator('[data-diagram="durable"]').click();
  await lab.locator('[data-scene="durable"] [data-node="postgres"]').evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.match(await lab.locator('#de-inspect-source').getAttribute('href'),/db\/schemas\/jobs.py#L48$/);
  await page.screenshot({path:out+'/durable-'+width+'.png',fullPage:false});
  await lab.locator('#de-full').click();
  assert.equal(await lab.evaluate(el=>el.classList.contains('is-fullscreen')),true,'Fullscreen state opens');
  await page.keyboard.press('Escape');
  assert.equal(await lab.evaluate(el=>el.classList.contains('is-fullscreen')),false,'Escape exits fullscreen');
  const dims=await page.evaluate(()=>({inner:innerWidth,doc:document.documentElement.scrollWidth}));
  assert(dims.doc<=dims.inner+3,'No horizontal overflow: '+JSON.stringify(dims));
  assert.deepEqual(errors,[],'No browser JavaScript errors');
  console.log('PASS Agno diagram-only explorer '+width+'px: four diagrams, source links, zoom, fullscreen');
  await ctx.close();
 }
}catch(e){console.error('FAIL Agno diagram-only explorer',e);process.exitCode=1}
finally{if(browser)await browser.close().catch(()=>{});proc.kill('SIGKILL');process.exit(process.exitCode||0)}
