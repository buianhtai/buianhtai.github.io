import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const port=4395,host='http://127.0.0.1:'+port,route='/en/labs/deepseek-harness-clarity/';
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port',String(port)],{stdio:'ignore'});
let browser;
try {
  let ready=false;
  for(let attempt=0;attempt<120;attempt++){
    try {ready=(await fetch(host+route)).ok;}catch{}
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert(ready,'Clarity prototype must be served from Astro preview');
  browser=await chromium.launch();
  await mkdir('artifacts/harness-clarity',{recursive:true});
  for(const width of [390,768,1440]){
    for(const theme of ['light','dark']){
      const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await ctx.addInitScript(value=>localStorage.setItem('theme',value),theme);
      const page=await ctx.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(host+route);
      const app=page.locator('clarity-explorer');
      await page.waitForSelector('clarity-explorer[data-ready="true"]');
      assert.equal(await app.locator('[data-ce-zone-node]').count(),6,'Overview uses 6 source-backed subsystems');
      assert.equal(await app.locator('.ce-zone').count(),3,'Overview has exactly three editorial areas');
      await page.screenshot({path:'artifacts/harness-clarity/overview-'+theme+'-'+width+'.png',fullPage:true});
      await app.locator('[data-ce-zone-node="core"]').click();
      assert.match(await app.locator('[data-ce-zone-title]').innerText(),/Execution core/);
      await app.locator('[data-ce-go="dependencies"]').click();
      assert.equal(await app.locator('button[data-ce-tab="dependencies"]').getAttribute('aria-pressed'),'true');
      const select=app.locator('[data-ce-component]');
      await select.selectOption('core-agent-loop');
      assert.match(await app.locator('[data-ce-focus-name]').innerText(),/agent-loop/);
      assert((await app.locator('[data-ce-outbound] .ce-relation-card').count())>=3,'Agent loop has source-linked dependencies');
      assert((await app.locator('[data-ce-node-sources] a').first().getAttribute('href')).includes('1517a4dbca0a2789ff1d41ba439600f8547d23fa'));
      await page.screenshot({path:'artifacts/harness-clarity/dependencies-'+theme+'-'+width+'.png',fullPage:true});
      await app.locator('button[data-ce-tab="execution"]').click();
      assert.equal(await app.locator('[data-ce-step]').count(),6);
      await app.locator('[data-ce-step="4"]').click();
      assert.match(await app.locator('[data-ce-step-title]').innerText(),/Schedule tools/);
      await app.locator('[data-ce-next]').click();
      assert.match(await app.locator('[data-ce-step-title]').innerText(),/Continue or stop/);
      await page.screenshot({path:'artifacts/harness-clarity/execution-'+theme+'-'+width+'.png',fullPage:true});
      await app.locator('button[data-ce-tab="source"]').click();
      assert.equal(await app.locator('.ce-file-option').count(),7);
      await app.locator('.ce-file-option').nth(4).click();
      assert.match(await app.locator('[data-ce-file-name]').innerText(),/Tool scheduler/);
      assert((await app.locator('.ce-code-line').count())>=10);
      assert((await app.locator('[data-ce-file-link]').getAttribute('href')).includes('1517a4dbca0a2789ff1d41ba439600f8547d23fa'));
      await page.screenshot({path:'artifacts/harness-clarity/source-'+theme+'-'+width+'.png',fullPage:true});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
      assert.deepEqual(errors,[], 'No uncaught browser runtime errors');
      await ctx.close();
    }
  }
  console.log('Clarity prototype validated across 4 genuinely distinct reading views, 3 viewport widths and 2 themes.');
} finally {
  await browser?.close();
  server.kill();
}
