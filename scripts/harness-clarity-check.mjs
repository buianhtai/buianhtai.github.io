import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const model=JSON.parse(await readFile('src/data/architecture/deepseek-harness.json','utf8'));
const port=4395,base='http://127.0.0.1:'+port,path='/en/labs/deepseek-harness-clarity/';
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port',String(port)],{stdio:'ignore'});
let browser;
try{
  let ready=false;
  for(let i=0;i<120;i++){
    try{ready=(await fetch(base+path)).ok;}catch{}
    if(ready)break;
    await new Promise(r=>setTimeout(r,250));
  }
  assert(ready,'Preview route must be served');
  browser=await chromium.launch();
  await mkdir('artifacts/harness-clarity',{recursive:true});
  for(const width of [390,768,1440]){
    for(const theme of ['light','dark']){
      const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await ctx.addInitScript(t=>localStorage.setItem('theme',t),theme);
      const page=await ctx.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base+path);
      const app=page.locator('diagram-only-explorer');
      await page.waitForSelector('diagram-only-explorer[data-ready="true"]');
      assert.equal(await app.locator('.de-group').count(),3,'Only conceptual boundaries shown initially');
      assert.equal(await app.locator('[data-node]').count(),6,'All six system subsystems visible');
      assert.equal(await app.locator('.de-edge').count(),0,'No initial spaghetti edges');
      assert.equal(await app.locator('.de-detail').isVisible(),false,'No sidebars until user selects node');
      await page.screenshot({path:'artifacts/harness-clarity/diagram-overview-'+theme+'-'+width+'.png',fullPage:true});

      await app.locator('[data-node="core"]').click();
      assert.equal(await app.locator('.de-detail').isVisible(),true,'Diagram node opens contextual content');
      assert.match(await app.locator('[data-title]').innerText(),/Agent runtime/);
      assert((await app.locator('.de-sources a').count())>=1,'Selected component links to code evidence');
      await app.locator('[data-action="expand"]').click();
      assert.equal(await app.locator('.de-group').count(),3,'Expanded view has incoming, center, outgoing columns');
      assert((await app.locator('.de-edge').count())>=3,'Related dependency arrows appear on demand');
      assert((await app.locator('.de-node').count())>=4,'One-hop related nodes expand');
      if(width===1440){
        const header=await app.locator('.de-group h3').first().boundingBox();
        const viewport=await app.locator('.de-viewport').boundingBox();
        assert(header&&viewport&&header.y>=viewport.y,'Expanded graph keeps its section headings in view');
      }
      await app.locator('[data-action="close"]').click();
      await page.screenshot({path:'artifacts/harness-clarity/diagram-expanded-'+theme+'-'+width+'.png',fullPage:true});

      await app.locator('[data-node="core"]').click();
      await app.locator('[data-action="inside"]').click();
      assert.equal(await app.locator('[data-node]').count(),6,'Drill from runtime subsystem to six packages');
      await app.locator('[data-action="back"]').click();
      assert((await app.locator('[data-node]').count())>=6,'Back restores previous architecture');
      await app.locator('button[data-mode="flow"]').click();
      assert.equal(await app.locator('.de-flow-node').count(),6,'Flow has six visible ordered nodes');
      assert.equal(await app.locator('.de-edge').count(),5,'Each ordered stage has an explicit connecting arrow');
      assert.equal(await app.locator('.de-tip').count(),5,'Arrowheads establish actual visual direction');
      if(width===1440){
        const last=await app.locator('[data-step="5"]').boundingBox();
        const viewport=await app.locator('.de-viewport').boundingBox();
        assert(last&&viewport&&last.y+last.height<=viewport.y+viewport.height,'All six steps fit the desktop canvas at readable size');
      }
      assert.match(await app.locator('[data-disclaimer]').innerText(),/curated/i);
      await page.screenshot({path:'artifacts/harness-clarity/diagram-flow-'+theme+'-'+width+'.png',fullPage:true});
      await app.locator('[data-step="4"]').click();
      assert.match(await app.locator('[data-title]').innerText(),/Schedule tools/);
      assert((await app.locator('.de-sources a').first().getAttribute('href')).includes(model.revision));
      await page.screenshot({path:'artifacts/harness-clarity/diagram-flow-detail-'+theme+'-'+width+'.png',fullPage:true});
      await app.locator('[data-action="close"]').click();
      assert.equal(await app.locator('.de-detail').isVisible(),false);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
      assert.deepEqual(errors,[],'No uncaught browser errors');
      await ctx.close();
    }
  }
  console.log('Diagram-only prototype validated: click-to-inspect, one-hop expandable imports, true arrowed flow, code evidence, drill/back, mobile/themes.');
}finally{
  await browser?.close();
  server.kill();
}
