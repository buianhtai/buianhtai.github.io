import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = 4512;
const path = '/en/blog/deepseek-harness-architecture-everything-is-a-plugin/';
const base = 'http://127.0.0.1:' + port;
const server = spawn('npm', ['run','preview','--','--host','127.0.0.1','--port',String(port)], { stdio:'ignore' });
let browser;

try {
  let ready = false;
  for (let i=0;i<120;i++){
    try { ready = (await fetch(base+path)).ok; } catch {}
    if (ready) break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert(ready,'Pinned DeepSeek Harness architecture article must be published as a build route');
  browser=await chromium.launch();
  await mkdir('artifacts/deepseek-harness-article',{recursive:true});
  for(const width of [390,768,1440]){
    for(const theme of ['light','dark']){
      const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await ctx.addInitScript(t=>localStorage.setItem('theme',t),theme);
      const page=await ctx.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});
      assert(response?.ok(),'Article returns HTTP success');
      await page.locator('h1').first().waitFor();
      assert.match(await page.locator('h1').first().innerText(),/DeepSeek Harness/);
      assert.equal(await page.locator('.mermaid-figure').count(),3,'Three architecture diagrams are present');
      assert((await page.locator('a[href*="deepseek-harness-clarity"]').count())>=3,'Article links repeatedly to interactive full architecture explorer');
      const text=await page.locator('article').innerText();
      for(const section of ['What is DeepSeek Harness','How it actually works','Real use cases','What should an architect learn']){
        assert(text.includes(section),'Article answers expected reader question: '+section);
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Article has no horizontal page overflow');
      await page.locator('.mermaid-figure').first().scrollIntoViewIfNeeded();
      // Mermaid loads from an external CDN and can be blocked in CI; the source
      // and vector controls must remain usable even when external CDN is down.
      for(const figure of await page.locator('.mermaid-figure').all()){
        assert.equal(await figure.locator('.mermaid-control-buttons button').count(),3,'Editorial vector controls stay available');
        assert((await figure.locator('pre.mermaid').count())===1,'Source diagram markup survives build');
      }
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:'artifacts/deepseek-harness-article/article-'+theme+'-'+width+'.png',fullPage:true});
      assert.deepEqual(errors.filter(e=>!e.includes('Failed to fetch dynamically imported module')),[],'No JavaScript runtime errors from article');
      await ctx.close();
    }
  }
  console.log('DeepSeek Harness article: mobile/tablet/desktop, light/dark, source links and diagrams validated.');
}finally{
  await browser?.close();
  server.kill();
}
