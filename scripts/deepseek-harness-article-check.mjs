import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port=4512,article='/en/blog/deepseek-harness-architecture-everything-is-a-plugin/',base='http://127.0.0.1:'+port;
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port',String(port)],{stdio:'ignore'});
let browser;
try {
  let ready=false;
  for(let i=0;i<120;i++){
    try{ready=(await fetch(base+article)).ok;}catch{}
    if(ready)break;
    await new Promise(r=>setTimeout(r,250));
  }
  assert(ready,'Article route must exist after building Astro');
  await mkdir('artifacts/deepseek-harness-article',{recursive:true});
  browser=await chromium.launch();
  for(const width of [390,768,1440]){
    for(const theme of ['light','dark']){
      const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await context.addInitScript(t=>localStorage.setItem('theme',t),theme);
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const response=await page.goto(base+article,{waitUntil:'domcontentloaded'});
      assert(response?.ok(),'Article HTTP 200');
      const guide=page.locator('[data-bgo-root]');
      await guide.locator('[data-ready="true"]').count(); // root itself provides ready, tested below
      await page.waitForSelector('[data-bgo-root][data-ready="true"]');
      assert.match(await page.locator('h1').first().innerText(),/DeepSeek Harness/i);
      assert.equal(await guide.locator('[data-bgo-node]').count(),5,'One central agent and four in-process service components');
      assert.equal(await guide.locator('[data-bgo-step]').count(),7,'Seven source-backed numbered steps');
      assert.equal(await guide.locator('[data-bgo-case]').count(),3,'Three failure-path walkthroughs');
      assert.equal(await guide.locator('.bgo-diagram').count(),1,'One canonical architecture diagram');
      assert.equal(await guide.locator('.bgo-service-row').count(),4,'All service relationships visibly point from agent loop');
      assert((await page.locator('a[href*="deepseek-harness-clarity"]').count())>=2,'Code explorer is linked');
      assert.equal(await guide.locator('[data-bgo-step="0"]').getAttribute('aria-pressed'),'true');
      assert.match(await guide.locator('[data-bgo-code-preview]').innerText(),/this.inbox.claim/,'Pinned source snippet is visible immediately');
      const codeEvidence=await guide.locator('[data-bgo-source-link]').getAttribute('href');
      assert.match(codeEvidence,/github.com\/deepseek-ai\/deepseek-harness\/blob\/1517a4d/,'Code link pins study revision');
      // One unified model: clicking a service explains its role and provenance.
      await guide.locator('[data-bgo-node="model"]').click();
      assert.equal(await guide.locator('[data-bgo-node-detail]').isVisible(),true);
      assert.match(await guide.locator('[data-bgo-node-why]').innerText(),/replaceable/i);
      assert.match(await guide.locator('[data-bgo-node-key]').innerText(),/ctx.llm/i);
      await guide.locator('[data-bgo-close-node]').click();
      assert.equal(await guide.locator('[data-bgo-node-detail]').isVisible(),false);
      // Stepper reveals code and highlights owning component.
      await guide.locator('[data-bgo-step="2"]').click();
      assert.match(await guide.locator('[data-bgo-step-title]').innerText(),/Ask the model/);
      assert.match(await guide.locator('[data-bgo-code-preview]').innerText(),/AssistantStreamAttempt|\.stream\(/);
      assert.equal(await guide.locator('[data-bgo-node="model"]').evaluate(el=>el.classList.contains('is-linked')),true);
      await guide.locator('[data-bgo-next]').click();
      assert.match(await guide.locator('[data-bgo-step-title]').innerText(),/Check for tool calls/);
      assert.match(await guide.locator('[data-bgo-code-preview]').innerText(),/executeToolCalls/);
      await guide.locator('[data-bgo-step="6"]').click();
      assert.equal(await guide.locator('[data-bgo-next]').isDisabled(),true);
      await guide.locator('[data-bgo-prev]').click();
      assert.match(await guide.locator('[data-bgo-step-title]').innerText(),/Record the outcome/);
      // Failure paths must change the outcome, not just a highlighted tab.
      await guide.locator('[data-bgo-case="denied"]').click();
      assert.match(await guide.locator('[data-bgo-case-title]').innerText(),/rejected before execution/i);
      assert.equal(await guide.locator('[data-bgo-scenario-box="tool"]').getAttribute('data-state'),'denied');
      await guide.locator('[data-bgo-case="disconnect"]').click();
      assert.match(await guide.locator('[data-bgo-case-detail]').innerText(),/session facts/i);
      assert.equal(await guide.locator('[data-bgo-scenario-box="ui"]').getAttribute('data-state'),'disconnected');
      // Responsive and contrast acceptance.
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No sideways body scroll');
      const anchors=['.bgo-diagram','.bgo-walkthrough','.bgo-scenario-map','.bgo-lessons-grid'];
      for(const selector of anchors){
        const b=await guide.locator(selector).boundingBox();
        assert(b&&b.width<=width+2,'Visual segment fits viewport width: '+selector);
      }
      const foreground=await guide.locator('.bgo-service-text strong').first().evaluate(el=>getComputedStyle(el).color);
      const channels=foreground.match(/[0-9]+/g)?.map(Number)||[];
      assert(channels[0]<110&&channels[1]<140&&channels[2]<170,'Diagram uses readable ink on pastel cards: '+foreground);
      assert.deepEqual(errors,[],'No client runtime errors after interaction');
      await guide.locator('[data-bgo-step="0"]').click();
      await guide.locator('[data-bgo-case="normal"]').click();
      await page.evaluate(()=>{(document.activeElement instanceof HTMLElement)&&document.activeElement.blur();window.scrollTo(0,0);});
      await page.screenshot({path:'artifacts/deepseek-harness-article/guide-'+theme+'-'+width+'.png',fullPage:true});
      for(const [id,name] of [['bgo-map','architecture'],['bgo-steps','request-flow'],['bgo-failures','failure-modes']]){
        await page.locator('#'+id).screenshot({path:'artifacts/deepseek-harness-article/'+name+'-'+theme+'-'+width+'.png'});
      }
      await context.close();
    }
  }
  console.log('Byte-sized DeepSeek architecture: a connected model, 7 code steps, 3 failure paths, mobile/tablet/desktop and light/dark validated.');
}finally{
  await browser?.close();
  server.kill();
}