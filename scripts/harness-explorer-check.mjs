import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const model=JSON.parse(await readFile('src/data/architecture/deepseek-harness.json','utf8'));
const previews=JSON.parse(await readFile('src/data/architecture/deepseek-harness-excerpts.json','utf8'));
assert.equal(previews.revision,model.revision,'Source previews match pinned architecture commit');
assert.equal(Object.keys(previews.excerpts).length,7,'All seven loop files have pinned excerpts');
for(const preview of Object.values(previews.excerpts)){assert(preview.url.includes('/'+model.revision+'/'));assert(preview.code.length>0);}
const ids=new Set(model.nodes.map(n=>n.id));
assert.equal(ids.size,model.nodes.length);
for(const e of model.edges){assert(ids.has(e.from)&&ids.has(e.to));assert(e.sources.length>0);}
for(const n of model.nodes){for(const s of n.sources)assert(s.url.includes('/'+model.revision+'/'));}
const host='http://127.0.0.1:4392',route='/en/labs/deepseek-harness/';
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4392'],{stdio:'ignore'});
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){try{ready=(await fetch(host+route)).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,150));}
 assert(ready);browser=await chromium.launch();await mkdir('artifacts/harness-explorer',{recursive:true});
 for(const width of [390,768,1440])for(const theme of ['dark','light']){
  const ctx=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await ctx.addInitScript(t=>localStorage.setItem('theme',t),theme);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(host+route);const app=page.locator('architecture-explorer');
  await page.waitForSelector('architecture-explorer[data-ready="true"]');
  assert.equal(await app.locator('[data-node]').count(),6);
  assert.equal(await app.locator('[data-mode="overview"]').getAttribute('aria-pressed'),'true');
  assert.equal(await app.locator('.ae-minimap-button').count(),1,'Minimap is present');
  assert((await app.locator('.ae-mini-nodes rect').count())>=6,'Minimap contains architecture nodes');
  await app.locator('[data-action="inspector"]').click();
  assert.equal(await app.locator('.ae-inspector').isVisible(),false,'Inspector collapses to free canvas width');
  await app.locator('[data-action="inspector"]').click();
  assert.equal(await app.locator('.ae-inspector').isVisible(),true,'Inspector can be restored');
  await app.locator('[data-action="navigation"]').click();
  assert.equal(await app.locator('.ae-nav').isVisible(),false);
  await app.locator('[data-action="navigation"]').click();
  assert.equal(await app.locator('.ae-nav').isVisible(),true);
  await app.locator('[data-mode="dependencies"]').click();
  assert.equal(await app.locator('[data-mode="dependencies"]').getAttribute('aria-pressed'),'true');
  assert.equal(await app.locator('.ae-zone').count(),3,'Overview presents three conceptual zones');
  await app.locator('[data-node="core"]').click();
  assert.equal(await app.locator('.ae-zone.is-zone-active').count(),1,'Active module highlights its boundary');
  assert.equal(await app.locator('.ae-zone-jump').count(),3,'Reader can jump directly between bounded zones');
  await app.locator('.ae-zone-jump').first().click();
  assert.match(await app.locator('[data-detail-title]').innerText(),/Composition/);
  await app.locator('.ae-zone-jump').nth(1).click();
  assert.match(await app.locator('[data-detail-title]').innerText(),/Agent runtime/);
  assert(await app.locator('.ae-edges > path.is-outgoing').count()>0,'Outgoing dependencies are visually distinguished');
  assert(await app.locator('.ae-edges > path.is-incoming').count()>0,'Incoming dependencies are visually distinguished');
  assert.match(await app.locator('[data-detail-stats]').innerText(),/outgoing.*incoming/);
  assert.match(await app.locator('[data-detail-title]').innerText(),/Agent runtime/);
  await app.locator('[data-action="drill"]').click();
  assert.equal(await app.locator('[data-node]').count(),6);
  assert.equal(await app.locator('.ae-zone').count(),3,'Runtime groups are visible');
  await app.locator('[data-node="core-agent-loop"]').click();
  await app.locator('[data-action="drill"]').click();
  assert.equal(await app.locator('[data-node]').count(),7);
  assert.equal(await app.locator('.ae-zone').count(),3,'Source modules have visible responsibility boundaries');
  assert.match(await app.locator('[data-view-title]').innerText(),/Agent-loop/);
  await app.locator('[data-mode="source"]').click();
  assert.equal(await app.locator('[data-mode="source"]').getAttribute('aria-pressed'),'true');
  await app.locator('[data-node="file-agent.ts"]').click();
  assert.equal(await app.locator('.ae-source-preview').isVisible(),true,'Source mode displays pinned code');
  assert.match(await app.locator('.ae-preview-note').innerText(),/preStep/);
  assert((await app.locator('.ae-code-line').count())>=10);
  assert((await app.locator('.ae-preview-link').getAttribute('href')).includes(model.revision));
  await app.locator('[data-mode="execution"]').click();
  assert.equal(await app.locator('.ae-journey-rail button').count(),6,'Execution mode opens curated stage rail');
  assert.match(await app.locator('[data-step-count]').innerText(),/1 \/ 6/);
  await app.locator('[data-mode="dependencies"]').click();
  await app.locator('[data-action="in"]').click();assert.equal(await app.locator('output').innerText(),'115%');
  await app.locator('[data-action="back"]').click();assert.match(await app.locator('[data-detail-title]').innerText(),/agent-loop/);
  await app.locator('input').fill('Assistant stream');
  await app.locator('.ae-results button').first().click();
  assert.match(await app.locator('[data-detail-title]').innerText(),/Assistant stream/);
  const source=await app.locator('.ae-sources a').first().getAttribute('href');assert(source.includes(model.revision));
  await app.locator('[data-action="tour"]').click();
  assert.equal(await app.locator('.ae-journey-rail button').count(),6,'All six stages remain directly selectable');
  for(let i=0;i<model.journey.length;i++){
   assert.match(await app.locator('[data-step-count]').innerText(),new RegExp(`${i+1} / 6`));
   assert.equal(await app.locator(`[data-node="${model.journey[i].node}"]`).getAttribute('aria-pressed'),'true');
   if(i<model.journey.length-1)await app.locator('[data-action="next"]').click();
  }
  await app.locator('.ae-journey-rail button').first().click();
  assert.match(await app.locator('[data-step-count]').innerText(),/1 \/ 6/,'Reader can jump directly to a stage');
  await app.locator('[data-action="stop"]').click();
  await app.locator('[data-action="expand"]').click();assert.equal(await app.locator('dialog').evaluate(e=>e.open),true);
  await page.keyboard.press('Escape');assert.equal(await app.locator('dialog').evaluate(e=>e.open),false);
  assert.equal(await app.locator('[data-action="expand"]').evaluate(e=>e===document.activeElement),true);
  await app.locator('[data-action="only"]').click();assert.equal(await app.locator('.ae-inspector').isVisible(),false);
  await app.locator('[data-action="fit"]').click();
  if(width===390){
    const viewportHeight=await app.locator('.ae-viewport').evaluate(el=>el.getBoundingClientRect().height);
    assert(viewportHeight<=701,'Fitted mobile canvas must not reserve excess blank height');
  }
  await app.scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/harness-explorer/map-${theme}-${width}.png`,fullPage:true});
  await app.locator('[data-action="only"]').click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
  await page.screenshot({path:`artifacts/harness-explorer/inspect-${theme}-${width}.png`,fullPage:true});
  const url=page.url();await page.goto(url);await page.waitForSelector('architecture-explorer[data-ready="true"]');assert.match(await app.locator('[data-view-title]').innerText(),/Agent-loop/);
  assert.deepEqual(errors,[]);await ctx.close();
 }
 console.log('Harness explorer passed: version-pinned code previews, four modes, minimap, collapsible panels, drilldown, back, source, execution rail, zoom, modal, diagram-only, deep links, 3 widths and 2 themes.');
}finally{await browser?.close();server.kill();}
