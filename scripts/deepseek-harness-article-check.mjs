import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = 4512, path = '/en/blog/deepseek-harness-architecture-everything-is-a-plugin/';
const base = 'http://127.0.0.1:' + port;
const server = spawn('npm', ['run','preview','--','--host','127.0.0.1','--port',String(port)], { stdio:'ignore' });
let browser;

try {
  let ready = false;
  for(let i=0;i<120;i++){
    try{ready=(await fetch(base+path)).ok;}catch{}
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert(ready,'Visual architecture article must exist as built route');
  browser=await chromium.launch();
  await mkdir('artifacts/deepseek-harness-article',{recursive:true});
  for(const width of [390,768,1440]){
    for(const theme of ['light','dark']){
      const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await ctx.addInitScript(t=>localStorage.setItem('theme',t),theme);
      const page=await ctx.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});
      assert(response?.ok(),'Article returns HTTP 200');
      await page.locator('h1').first().waitFor();
      await page.locator('.hvs[data-ready="true"]').waitFor();
      const root=page.locator('[data-harness-story]');
      assert.match(await page.locator('h1').first().innerText(),/DeepSeek Harness/);
      assert.equal(await root.locator('.hvs-chapter').count(),5,'Five interactive editorial infographic chapters');
      assert.equal(await root.locator('[data-capability]').count(),6,'Six clickable capability seams');
      assert.equal(await root.locator('.hvs-service-links > span:not(.hvs-link-hub)').count(),4,'Agent loop explicitly connects to four service contracts');
      for(const selector of ['.hvs-capability strong','.hvs-step strong','.hvs-policy-node strong','.hvs-case strong','.hvs-relation']){
        const ink=await root.locator(selector).first().evaluate(el=>getComputedStyle(el).color);
        const rgb=ink.match(/[0-9]+/g)?.map(Number) || [];
        const perceived=(rgb[0]||0)*.2126+(rgb[1]||0)*.7152+(rgb[2]||0)*.0722;
        assert(perceived>=180,'Dark technical card labels must have high contrast: '+selector+' '+ink);
      }
      assert.equal(await root.locator('[data-stage]').count(),7,'Seven request stages');
      assert.equal(await root.locator('[data-scenario]').count(),3,'Three illustrative policy branches');
      assert.equal(await root.locator('[data-case]').count(),4,'Four example use cases');
      assert.equal(await page.locator('.mermaid-figure').count(),0,'Visual atlas replaces dense Mermaid diagrams');
      assert((await page.locator('a[href*="deepseek-harness-clarity"]').count())>=2,'Connects to existing code explorer');
      // Model / system interaction with upstream provenance
      await root.locator('[data-capability="tools"]').click();
      assert.match(await root.locator('[data-service-title]').innerText(),/Tool registry/i);
      assert.match(await root.locator('[data-service-contract]').innerText(),/ctx.tools/i);
      assert.match(await root.locator('[data-service-source]').getAttribute('href'),/tool-calls.ts#L174/);
      assert.equal(await root.locator('[data-capability="tools"]').getAttribute('aria-pressed'),'true');
      // Source-guided stepper
      await root.locator('[data-stage="5"]').click();
      assert.match(await root.locator('[data-stage-title]').innerText(),/Run tools/i);
      assert.match(await root.locator('[data-stage-source]').getAttribute('href'),/#L551/);
      await root.locator('[data-stage-next]').click();
      assert.match(await root.locator('[data-stage-title]').innerText(),/Continue/i);
      assert.equal(await root.locator('[data-stage-next]').isDisabled(),true);
      await root.locator('[data-stage-prev]').click();
      assert.equal(await root.locator('[data-stage="5"]').getAttribute('aria-pressed'),'true');
      // Guarded workflow alternatives
      await root.locator('[data-scenario="denied"]').click();
      assert.match(await root.locator('[data-outcome-title]').innerText(),/rejected before execution/i);
      assert.equal(await root.locator('[data-policy-node="execute"]').getAttribute('data-outcome'),'skipped');
      await root.locator('[data-scenario="approval"]').click();
      assert.match(await root.locator('[data-outcome-title]').innerText(),/approval granted/i);
      assert.equal(await root.locator('[data-policy-node="guard"]').getAttribute('data-outcome'),'review');
      // Reversible comparison and applied use cases
      await root.locator('[data-compare="hardcoded"]').click();
      assert.match(await root.locator('[data-compare-center]').innerText(),/FIXED AGENT RUNNER/i);
      await root.locator('[data-compare="plugin"]').click();
      assert.match(await root.locator('[data-compare-center]').innerText(),/CORDIS CONTEXT/i);
      await root.locator('[data-case="support"]').click();
      assert.match(await root.locator('[data-case-title]').innerText(),/evidence/i);
      assert.match(await root.locator('[data-case-caveat]').innerText(),/tenant/i);
      await root.locator('[data-case="platform"]').click();
      assert.match(await root.locator('[data-part="1"]').innerText(),/Capability contracts/i);
      assert.deepEqual(errors,[],'No JavaScript errors throughout interaction tour');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),
        'No horizontal page overflow after interactive selections');
      for(const selector of ['.hvs-system-layout','.hvs-stage-body','.hvs-policy-track','.hvs-compare-visual','.hvs-case-detail']){
        const bounds=await root.locator(selector).boundingBox();
        assert(bounds&&bounds.width<=width+2,'Infographic panel respects viewport width: '+selector+' = '+JSON.stringify(bounds));
      }
      // Reset to representative state and capture the complete editorial story.
      await root.locator('[data-capability="agent"]').click();
      await root.locator('[data-stage="3"]').click();
      await root.locator('[data-scenario="read"]').click();
      await root.locator('[data-case="coding"]').click();
      await page.evaluate(()=>{document.activeElement instanceof HTMLElement && document.activeElement.blur();window.scrollTo(0,0);});
      await page.screenshot({path:'artifacts/deepseek-harness-article/visual-story-'+theme+'-'+width+'.png',fullPage:true});
      for(const [name,id] of [['system','hvs-system'],['journey','hvs-journey'],['policy','hvs-policy'],['cases','hvs-cases']]){
        await page.locator('#'+id).screenshot({path:'artifacts/deepseek-harness-article/'+name+'-'+theme+'-'+width+'.png'});
      }
      await ctx.close();
    }
  }
  console.log('Visual DeepSeek Harness story verified at 390, 768, 1440px in light/dark themes; all 5 chapter controls functional.');
} finally {
  await browser?.close();
  server.kill();
}
