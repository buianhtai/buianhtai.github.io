import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4379', route='/en/labs/agno-architecture-v2/';
const out='artifacts/agno-atlas-v2';
await mkdir(out,{recursive:true});
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4379'],{env:process.env,stdio:['ignore','pipe','pipe']});
let logs='';server.stderr.on('data',c=>logs+=String(c));server.stdout.on('data',c=>logs+=String(c));
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){
  try{ready=(await fetch(origin+route)).ok;if(ready)break}catch{}
  await new Promise(resolve=>setTimeout(resolve,180));
 }
 assert(ready,'V2 preview route not ready: '+logs.slice(-700));
 browser=await chromium.launch({headless:true});
 for(const width of [390,768,1440]){
  const ctx=await browser.newContext({viewport:{width,height:920},reducedMotion:'reduce'});
  await ctx.addInitScript(()=>localStorage.setItem('theme','terminal'));
  await ctx.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+route,{waitUntil:'domcontentloaded'});
  const atlas=page.locator('#agno-atlas-v2');
  assert.equal(await atlas.getAttribute('data-ready'),'1','Atlas interactive JavaScript initialized');
  assert.equal(await atlas.locator('[data-node]').count(),12,'12 readable source-linked components');
  assert.equal(await atlas.locator('[data-wire]').count(),12,'Orthogonal relationships');
  assert.equal(await atlas.locator('.atlas-bound').count(),4,'Clear deployment/process/data boundaries');
  assert.equal(await atlas.locator('[data-panel="overview"]').isVisible(),true,'Overview is the start view');
  assert.equal(await atlas.locator('[data-panel="walkthrough"]').isVisible(),false,'Walkthrough does not compete with overview');
  await page.screenshot({path:out+'/overview-'+width+'-dark.png',fullPage:false});
  await atlas.locator('[data-node="postgres"]').click();
  assert.match(await atlas.locator('#atlas-component-title').innerText(),/PostgreSQL/i);
  assert.match(await atlas.locator('#atlas-component-source').getAttribute('href'),/db\/postgres\/schemas.py$/);
  await atlas.locator('#atlas-open-walk').click();
  assert.equal(await atlas.locator('[data-panel="walkthrough"]').isVisible(),true);
  assert.equal(await atlas.locator('[data-panel="overview"]').isVisible(),false);
  assert.match(await atlas.locator('#atlas-step-from').innerText(),/App \/ SDK/);
  assert.match(await atlas.locator('#atlas-step-to').innerText(),/Ingress/);
  assert.equal(await atlas.locator('#atlas-step-trail button').count(),6,'Each journey has six discrete steps');
  await atlas.locator('#atlas-forward').click();
  assert.match(await atlas.locator('#atlas-step-to').innerText(),/AgentOS API/);
  await atlas.locator('[data-example="background"]').click();
  await atlas.locator('#atlas-step-trail button').nth(2).click();
  assert.match(await atlas.locator('#atlas-step-from').innerText(),/Queue worker/);
  assert.match(await atlas.locator('#atlas-step-to').innerText(),/PostgreSQL/);
  assert.equal(await atlas.locator('.atlas-wire.is-active').count(),1,'No spaghetti: only the selected connection is active');
  await page.screenshot({path:out+'/walkthrough-'+width+'-dark.png',fullPage:false});
  await atlas.locator('#atlas-open-code').click();
  assert.equal(await atlas.locator('[data-panel="code"]').isVisible(),true);
  assert.match(await atlas.locator('#atlas-code-open').getAttribute('href'),/agno-agi\/agno\/blob\/1f2aac51eb28dc9c0970836d3b7ae046bae81bbb/);
  await atlas.locator('[data-symbol="QueueWorker"]').click();
  assert.match(await atlas.locator('#atlas-code-path').innerText(),/os\/job_queue.py/);
  await atlas.locator('[data-tab="walkthrough"]').click();
  await atlas.locator('[data-example="answer"]').click();
  await atlas.locator('#atlas-present').click();
  assert.equal(await atlas.evaluate(x=>x.classList.contains('is-presenting')),true);
  await page.keyboard.press('ArrowRight');
  assert.match(await atlas.locator('#atlas-step-counter').innerText(),/02 \/ 06/);
  await page.keyboard.press('Escape');
  assert.equal(await atlas.evaluate(x=>x.classList.contains('is-presenting')),false);
  await page.screenshot({path:out+'/code-'+width+'-dark.png',fullPage:false});
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html.theme-light').count(),1);
  await atlas.locator('[data-tab="overview"]').click();
  await page.screenshot({path:out+'/overview-'+width+'-light.png',fullPage:false});
  assert.deepEqual(errors,[],'No browser JavaScript errors');
  const widthState=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  assert(widthState.document<=widthState.viewport+3,'No page-wide horizontal overflow '+JSON.stringify(widthState));
  console.log('PASS Agno Atlas V2 '+width+'px: overview, boundaries, walkthrough, source and presentation');
  await ctx.close();
 }
}catch(err){console.error('FAIL Agno Atlas V2',err);process.exitCode=1}
finally{if(browser)await browser.close().catch(()=>{});server.kill('SIGKILL');process.exit(process.exitCode||0)}
