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
      if(width>700){
        assert.equal(await app.locator('button[data-mode="full"]').getAttribute('aria-pressed'),'true','Desktop opens complete architecture map');
        assert.equal(await app.locator('.de-model-subsystem').count(),6,'Full map shows six distinct nested subsystem boundaries');
        assert.equal(await app.locator('[data-node]').count(),32,'Full map includes all six subsystems and twenty-six source-backed packages');
        assert.equal(await app.locator('.de-edge').count(),6,'Full map shows six verified highlighted relationships by default');
        const packageNode=app.locator('[data-node="core-agent-loop"]');
        await packageNode.click();
        assert.match(await app.locator('[data-title]').innerText(),/agent-loop/);
        assert((await app.locator('.de-sources a').count())>0,'Full-map package links to pinned code evidence');
        await app.locator('[data-action="close"]').click();
        await app.locator('[data-action="connections"]').click();
        assert.equal(await app.locator('.de-edge').count(),16,'Expanded full-map layer shows all sixteen verified system dependencies');
        await app.locator('[data-action="connections"]').click();
        await page.screenshot({path:'artifacts/harness-clarity/full-model-'+theme+'-'+width+'.png',fullPage:true});
        await app.locator('button[data-mode="architecture"]').click();
      }
      assert.equal(await app.locator('.de-group').count(),3,'Only conceptual boundaries shown initially');
      assert.equal(await app.locator('[data-node]').count(),6,'All six system subsystems visible');
      if(width===390){
        for(const node of await app.locator('[data-node]').all()){
          const box=await node.boundingBox();
          assert(box&&box.x>=-1&&box.x+box.width<=width+1,'Every system component fits phone width');
        }
        const last=await app.locator('[data-node="session"]').boundingBox();
        const viewportBox=await app.locator('.de-viewport').boundingBox();
        assert(last&&viewportBox&&last.y+last.height<=viewportBox.y+viewportBox.height,'System boundaries expand naturally in vertical layout');
        assert(await app.locator('.de-viewport').evaluate(el=>getComputedStyle(el).overflowY==='visible'),'Mobile uses page scrolling, not nested canvas scrolling');
      }
      assert.equal(await app.locator('.de-edge').count(),0,'No initial spaghetti edges');
      assert.equal(await app.locator('.de-detail').isVisible(),false,'No sidebars until user selects node');
      assert.equal(await app.locator('.de-mini-zones rect').count(),3,'Minimap mirrors architecture boundaries');
      assert.equal(await app.locator('.de-mini-nodes rect').count(),6,'Minimap shows real architecture nodes');
      await app.locator('[data-action="connections"]').click();
      assert((await app.locator('.de-edge[data-edge-from]').count())>=5,'Source-derived dependency overlay is available');
      const line=app.locator('.de-edge[data-edge-from]').first();
      await line.dispatchEvent('click');
      assert.match(await app.locator('[data-kind]').innerText(),/SOURCE-DECLARED/);
      assert((await app.locator('.de-sources a').count())>0,'Connection inspector exposes provenance');
      await app.locator('[data-action="close"]').click();
      await app.locator('[data-action="connections"]').click();
      assert.equal(await app.locator('.de-edge').count(),0,'Disabling overlay restores clean diagram');
      const expectedMap=width>=700;
      assert.equal(await app.locator('.de-map-control').isVisible(),expectedMap,'Mobile minimap is optional by default');
      if(width===390){
        await app.locator('[data-action="mobile-tools"]').click();
        assert.equal(await app.locator('[data-action="mobile-tools"]').getAttribute('aria-expanded'),'true','Advanced controls expand on demand');
      }
      await app.locator('[data-action="minimap"]').click();
      assert.equal(await app.locator('.de-map-control').isVisible(),!expectedMap);
      await app.locator('[data-action="minimap"]').click();
      assert.equal(await app.locator('.de-map-control').isVisible(),expectedMap);
      if(width===390)await app.locator('[data-action="mobile-tools"]').click();
      await page.evaluate(()=>{window.scrollTo(0,0);if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});
      await page.screenshot({path:'artifacts/harness-clarity/diagram-overview-'+theme+'-'+width+'.png',fullPage:true});

      await app.locator('[data-node="core"]').click();
      assert.equal(await app.locator('.de-detail').isVisible(),true,'Diagram node opens contextual content');
      if(width===390){
        assert.equal(await app.locator('.de-backdrop').isVisible(),true,'Mobile details provide a dismissible backdrop');
        const bounds=await app.locator('.de-detail').boundingBox();
        assert(bounds&&bounds.y>=0&&bounds.y+bounds.height<=901&&bounds.width>=width-1,'Details fit as a bottom sheet in the phone viewport');
      }
      assert.match(await app.locator('[data-title]').innerText(),/Agent runtime/);
      assert((await app.locator('.de-sources a').count())>=1,'Selected component links to code evidence');
      await app.locator('[data-action="expand"]').click();
      assert.equal(await app.locator('.de-group').count(),3,'Expanded view has incoming, center, outgoing columns');
      if(width===390)
        assert((await app.locator('.de-mobile-direction').count())>=3,'Mobile dependencies have explicit, readable direction labels');
      else
        assert((await app.locator('.de-edge').count())>=3,'Desktop related dependency arrows appear on demand');
      assert((await app.locator('.de-node').count())>=4,'One-hop related nodes expand');
      if(width===390){
        const focus=await app.locator('[data-node="core"]').boundingBox();
        const usedBy=await app.locator('.de-group').nth(1).boundingBox();
        const uses=await app.locator('.de-group').nth(2).boundingBox();
        assert(focus&&usedBy&&uses&&focus.y<usedBy.y&&usedBy.y<uses.y,'Mobile dependencies read focus, incoming then outgoing');
        for(const text of await app.locator('.de-group').nth(1).locator('.de-mobile-direction').allTextContents())
          assert.match(text,/USED BY/,'Incoming label is correct even when the same component is also outbound');
        for(const text of await app.locator('.de-group').nth(2).locator('.de-mobile-direction').allTextContents())
          assert.match(text,/USES/,'Outgoing label is correct even when the same component is also inbound');
        for(const node of await app.locator('[data-node]').all()){
          const b=await node.boundingBox();assert(b&&b.x>=-1&&b.x+b.width<=width+1,'Expanded dependency cards never crop');
        }
      }
      if(width===1440){
        const header=await app.locator('.de-group h3').first().boundingBox();
        const viewport=await app.locator('.de-viewport').boundingBox();
        assert(header&&viewport&&header.y>=viewport.y,'Expanded graph keeps its section headings in view');
      }
      await app.locator('[data-action="close"]').click();
      await page.evaluate(()=>{window.scrollTo(0,0);if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});
      await page.screenshot({path:'artifacts/harness-clarity/diagram-expanded-'+theme+'-'+width+'.png',fullPage:true});

      await app.locator('[data-node="core"]').click();
      await app.locator('[data-action="inside"]').click();
      assert.equal(await app.locator('[data-node]').count(),6,'Drill from runtime subsystem to six packages');
      await app.locator('[data-node="core-agent-loop"]').click();
      await app.locator('[data-action="inside"]').click();
      assert.equal(await app.locator('[data-node]').count(),7,'Agent-loop drill shows seven implementation files');
      await app.locator('[data-node="file-agent.ts"]').click();
      assert.equal(await app.locator('.de-source-preview').isVisible(),true,'File click displays source content');
      assert((await app.locator('.de-code-row').count())>10,'Source content has real pinned lines');
      if(width===390){
        await app.locator('[data-action="dismiss"]').click({position:{x:20,y:120}});
        assert.equal(await app.locator('.de-detail').isVisible(),false,'Touching the backdrop dismisses the mobile sheet');
      }
      await app.locator('[data-action="back"]').click();
      await app.locator('[data-action="back"]').click();
      assert((await app.locator('[data-node]').count())>=6,'Back restores previous architecture');
      await app.locator('button[data-mode="flow"]').click();
      assert.equal(await app.locator('.de-flow-node').count(),6,'Flow has six visible ordered nodes');
      if(width===390){
        const last=await app.locator('[data-step="5"]').boundingBox();
        const canvas=await app.locator('.de-viewport').boundingBox();
        assert(last&&canvas&&last.y+last.height<=canvas.y+canvas.height,'All six flow stages belong to one naturally scrolling mobile diagram');
        assert.equal(await app.locator('.de-map-control').isVisible(),false,'No minimap covers mobile flow');
      }
      assert.equal(await app.locator('.de-edge').count(),5,'Each ordered stage has an explicit connecting arrow');
      assert.equal(await app.locator('.de-tip').count(),5,'Arrowheads establish actual visual direction');
      assert.equal(await app.locator('.de-group').count(),3,'Source-grounded flow has three distinct editorial phase boundaries');
      assert.equal(await app.locator('.de-stage-owner').count(),6,'Each flow component displays ownership');
      assert.equal(await app.locator('.de-mini-nodes rect').count(),6,'Minimap includes flow nodes');
      assert.equal(await app.locator('.de-tour').isVisible(),true,'Flow-only stage controls appear');
      await app.locator('[data-action="next-step"]').click();
      assert.match(await app.locator('[data-step-status]').innerText(),/Stage 2/);
      if(width===390){
        await app.locator('.de-related-button').first().click();
        assert.match(await app.locator('[data-step-status]').innerText(),/Stage 1/);
      }else{
        await app.locator('[data-action="previous-step"]').click();
        assert.match(await app.locator('[data-step-status]').innerText(),/Stage 1/);
      }
      await app.locator('[data-action="close"]').click();
      if(width===1440){
        const last=await app.locator('[data-step="5"]').boundingBox();
        const viewport=await app.locator('.de-viewport').boundingBox();
        assert(last&&viewport&&last.y+last.height<=viewport.y+viewport.height,'All six steps fit the desktop canvas at readable size');
      }
      assert.match(await app.locator('[data-disclaimer]').innerText(),/curated/i);
      await page.evaluate(()=>{window.scrollTo(0,0);if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});
      await page.screenshot({path:'artifacts/harness-clarity/diagram-flow-'+theme+'-'+width+'.png',fullPage:true});
      await app.locator('[data-step="4"]').click();
      assert.match(await app.locator('[data-title]').innerText(),/Schedule tools/);
      assert((await app.locator('.de-sources a').first().getAttribute('href')).includes(model.revision));
      assert.equal(await app.locator('.de-source-preview').isVisible(),true,'Flow stage also reveals pinned implementation excerpt');
      await page.screenshot({path:'artifacts/harness-clarity/diagram-flow-detail-'+theme+'-'+width+'.png',fullPage:true});
      await app.locator('[data-action="close"]').click();
      assert.equal(await app.locator('.de-detail').isVisible(),false);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
      assert.equal(await app.locator('.de-map-control').isVisible(),expectedMap);
      await app.locator('button[data-mode="full"]').click();
      assert.equal(await app.locator('.de-model-subsystem').count(),6,'Complete model always has all six nested subsystem boundaries');
      assert.equal(await app.locator('[data-node]').count(),32,'Complete model always exposes all packages');
      if(width===390){
        assert(await app.locator('.de-viewport').evaluate(el=>getComputedStyle(el).overflowX==='auto'),'Mobile full map is pan-and-zoom canvas, not a cut-off stack');
        assert((await app.locator('.de-viewport').evaluate(el=>el.scrollWidth))>width,'Mobile full map is larger than the viewport');
      }
      await page.screenshot({path:'artifacts/harness-clarity/full-model-mobile-or-final-'+theme+'-'+width+'.png',fullPage:true});
      assert.deepEqual(errors,[],'No uncaught browser errors');
      await ctx.close();
    }
  }
  console.log('Diagram-only prototype validated: click-to-inspect, one-hop expandable imports, true arrowed flow, code evidence, drill/back, mobile/themes.');
}finally{
  await browser?.close();
  server.kill();
}
