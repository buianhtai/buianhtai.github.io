import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const host='http://127.0.0.1:4360';
const route='/en/blog/agno-agentos-distributed-systems-data-architecture/';
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4360'],{env:process.env,stdio:'ignore'});
let browser;
try{
  let ready=false;
  for(let attempt=0;attempt<80;attempt++){
    try{ready=(await fetch(host+route)).ok;if(ready)break}catch{}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert(ready,'Agno article preview not available');
  browser=await chromium.launch({headless:true});
  for(const width of [390,1440]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await context.addInitScript(()=>localStorage.setItem('theme','terminal'));
    await context.route('**/*',route=>route.request().url().startsWith(host)?route.continue():route.abort());
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(host+route,{waitUntil:'domcontentloaded'});
    const lab=page.locator('#agno-source-lab');
    assert.equal(await lab.getAttribute('data-ready'),'1');
    assert.equal(await lab.locator('.sl-stage').count(),4);
    await lab.locator('[data-mode="queue"]').click();
    assert.match(await lab.locator('#sl-symbol').innerText(),/QueueConfig/);
    await lab.locator('#sl-next').click();
    assert.match(await lab.locator('#sl-title').innerText(),/worker/i);
    await lab.locator('[data-mode="failure"]').click();
    await lab.locator('[data-fault="crash"]').click();
    assert.match(await lab.locator('#sl-verdict').innerText(),/Worker crash/i);
    assert.match(await lab.locator('#sl-caveat').innerText(),/lease/i);
    assert.match(await lab.locator('#sl-link').getAttribute('href'),/1f2aac51eb28dc9c0970836d3b7ae046bae81bbb/);
    await lab.locator('#sl-scrub').evaluate(el=>{el.value='3';el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.match(await lab.locator('#sl-title').innerText(),/worker/i);
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html.theme-light').count(),1);
    assert.deepEqual(errors,[]);
    await context.close();
    console.log('PASS source execution lab '+width+'px');
  }
}catch(error){console.error('FAIL Agno source lab',error);process.exitCode=1}finally{
 if(browser)await browser.close().catch(()=>{});
 server.kill('SIGKILL');
 process.exit(process.exitCode||0);
}