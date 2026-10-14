import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const host='http://127.0.0.1:4362';
const route='/en/blog/agno-agentos-distributed-systems-data-architecture/';
const out='artifacts/agno-infographic';
await mkdir(out,{recursive:true});
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4362'],{env:process.env,stdio:['ignore','pipe','pipe']});
let serverLogs='';server.stdout.on('data',c=>serverLogs+=String(c));server.stderr.on('data',c=>serverLogs+=String(c));
let browser;
try{
  let ready=false;
  for(let attempt=0;attempt<80;attempt++){
    try{ready=(await fetch(host+route)).ok;if(ready)break}catch{}
    await new Promise(r=>setTimeout(r,200));
  }
  assert(ready,'Astro preview not ready: '+serverLogs.slice(-1000));
  browser=await chromium.launch({headless:true});
  for(const width of [390,1440]){
    const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await ctx.addInitScript(()=>localStorage.setItem('theme','terminal'));
    await ctx.route('**/*',r=>r.request().url().startsWith(host)?r.continue():r.abort());
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(host+route,{waitUntil:'domcontentloaded'});
    const lab=page.locator('#agno-infographic');
    assert.equal(await lab.count(),1,'Infographic mounted');
    assert.equal(await lab.getAttribute('data-ready'),'1','Infographic behavior loaded');
    assert.equal(await lab.locator('[data-node]').count(),18,'Every main component shown');
    assert.equal(await lab.locator('.ai-node-icon').count(),18,'Every architecture node has a meaningful icon');
    assert.match(await lab.locator('[data-node="postgres"] .ai-node-icon').getAttribute('href'),/database/);
    assert.equal(await lab.locator('[data-link]').count(),24,'Every explicit relation shown');
    assert.equal(await lab.locator('.ai-boundary').count(),5,'Distinct system boundaries');
    assert.equal(await lab.locator('#ai-region').count(),1,'Subsystem navigation available');
    assert.equal(await lab.locator('#ai-find option').count(),19,'Searchable node picker includes every component');
    assert.equal(await lab.locator('#ai-lines').getAttribute('aria-pressed'),'false','Essential lines are the initial view');
    assert.equal(await lab.locator('#ai-play').isDisabled(),true,'Overview cannot autoplay');
    assert.equal(await lab.locator('.ai-runtime-inspector').count(),1,'Visible guided protocol inspector');
    await lab.scrollIntoViewIfNeeded();
    await page.screenshot({path:out+'/overview-'+width+'-dark.png',fullPage:false});

    const firstEdge=lab.locator('[data-link="client-edge"]');
    const opacityBefore=await firstEdge.evaluate(el=>el.style.opacity);
    await lab.locator('#ai-lines').click();
    assert.equal(await lab.locator('#ai-lines').getAttribute('aria-pressed'),'true');
    const opacityAll=await firstEdge.evaluate(el=>el.style.opacity);
    assert.notEqual(opacityAll,opacityBefore,'All connections mode changes visible link strength');
    await lab.locator('#ai-lines').click();

    await lab.locator('#ai-region').selectOption('runtime');
    assert.match(await lab.locator('#ai-view-status').innerText(),/runtime and worker/i);
    assert.notEqual(await lab.locator('#ai-svg').getAttribute('viewBox'),'0 0 1200 762','Subsystem navigates camera');
    await lab.locator('#ai-find').selectOption('agent');
    assert.match(await lab.locator('#ai-selected-title').innerText(),/Agent Runtime/i);
    await lab.locator('#ai-fit').click();
    assert.equal(await lab.locator('#ai-svg').getAttribute('viewBox'),'0 0 1200 762');

    await lab.locator('[data-node="agent"]').click();
    assert.match(await lab.locator('#ai-selected-title').innerText(),/Agent Runtime/i);
    assert.match(await lab.locator('#ai-selected-detail').innerText(),/model/i);
    assert((await lab.locator('.ai-edge.is-active').count())>=3,'Focused relations highlighted');
    assert((await lab.locator('.ai-rel-link').count())>=3,'Inspectable relation list');
    assert.equal(await lab.locator('.ai-rel-link').first().evaluate(el=>getComputedStyle(el).display),'flex','Dynamic relation cards inherit scoped styles');
    assert.match(await lab.locator('#ai-source').getAttribute('href'),/1f2aac51eb28dc9c0970836d3b7ae046bae81bbb/);

    await lab.locator('.ai-filter [data-layer="data"]').click();
    assert.equal(await lab.locator('.ai-filter [data-layer="data"]').getAttribute('aria-pressed'),'true','Data layer active');
    assert.equal(await lab.locator('[data-node="agent"]').getAttribute('aria-pressed'),null,'Node is not mistakenly handled as filter button');

    await lab.locator('.ai-scenarios [data-scenario="queue"]').click();
    assert.match(await lab.locator('#ai-story-title').innerText(),/AgentOS API/i);
    const count=await lab.locator('.ai-edge.is-active').count();
    await lab.locator('#ai-next').click();
    assert((await lab.locator('.ai-edge.is-active').count())>=count,'Scenario path advances');
    assert.match(await lab.locator('#ai-step-count').innerText(),/02/);
    assert.match(await lab.locator('#ai-journey-heading').innerText(),/Step 2/i,'Simple journey follows selected execution step');
    assert.match(await lab.locator('#ai-from').innerText(),/AgentOS API/i);
    assert.match(await lab.locator('#ai-to').innerText(),/Queue Configuration/i);
    assert.match(await lab.locator('#ai-journey-protocol').innerText(),/INVOKE|Enqueue/i);
    assert.equal(await lab.locator('.ai-journey-step[aria-current="step"]').count(),1,'One numbered journey step is active');
    await lab.locator('.ai-journey-step').last().click();
    assert.match(await lab.locator('#ai-step-count').innerText(),/09/,'Numbered journey strips navigate to a stage');
    await lab.locator('#ai-scrub').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});

    assert.equal(await lab.locator('#ai-play').isEnabled(),true,'Scenario enables playback');
    assert.match(await lab.locator('#ai-runtime-protocol').innerText(),/queue|http|durable/i);
    assert.match(await lab.locator('#ai-runtime-source').getAttribute('href'),/1f2aac51eb28dc9c0970836d3b7ae046bae81bbb/);
    const prevView=await lab.locator('#ai-svg').getAttribute('viewBox');
    await lab.locator('#ai-scrub').evaluate(el=>{el.value='3';el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.match(await lab.locator('#ai-step-count').innerText(),/04/,'Scrubbing updates stage');
    assert.notEqual(await lab.locator('#ai-svg').getAttribute('viewBox'),prevView,'Following flow moves architecture camera');
    await lab.locator('#ai-play').click();
    assert.equal(await lab.locator('#ai-play').getAttribute('aria-pressed'),'true','Playback starts');
    await lab.locator('#ai-play').click();
    assert.equal(await lab.locator('#ai-play').getAttribute('aria-pressed'),'false','Playback pauses');
    assert.match(await lab.locator('#ai-step-label').textContent(),/4 ·/,'Selected relationship is annotated on map');
    assert.equal(await lab.locator('#ai-step-annotation').getAttribute('visibility'),'visible');

    const initial=await lab.locator('#ai-svg').getAttribute('viewBox');
    await lab.locator('#ai-zoom-in').click();
    assert.notEqual(await lab.locator('#ai-svg').getAttribute('viewBox'),initial,'SVG zoom changes viewBox');
    await lab.locator('#ai-fit').click();
    assert.equal(await lab.locator('#ai-svg').getAttribute('viewBox'),'0 0 1200 762','Fit restores whole architecture');
    await lab.locator('#ai-clear').click();
    assert.equal(await lab.locator('.ai-scenarios [data-scenario="overview"]').getAttribute('aria-pressed'),'true');

    if(width===390){
      await lab.locator('#ai-region').selectOption('api');
      assert.match(await lab.locator('#ai-view-status').innerText(),/AgentOS API and registry/i);
    }
    await lab.scrollIntoViewIfNeeded();
    await page.screenshot({path:out+'/architecture-'+width+'-dark.png',fullPage:false});
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html.theme-light').count(),1,'Theme switched to light');
    await lab.scrollIntoViewIfNeeded();
    await page.screenshot({path:out+'/architecture-'+width+'-light.png',fullPage:false});
    assert.deepEqual(errors,[],'No JavaScript exceptions');
    const standalone=await ctx.newPage();
    const labErrors=[];standalone.on('pageerror',e=>labErrors.push(e.message));
    await standalone.goto(host+'/en/labs/agno-architecture/',{waitUntil:'domcontentloaded'});
    assert.equal(await standalone.locator('#agno-infographic').count(),1,'Dedicated Agno lab includes architecture');
    assert.equal(await standalone.locator('#agno-source-lab').count(),1,'Dedicated lab includes source explorer');
    await standalone.locator('#agno-infographic .ai-scenarios [data-scenario="answer"]').click();
    assert.equal(await standalone.locator('#agno-infographic #ai-play').isEnabled(),true);
    const standaloneLab=standalone.locator('#agno-infographic');
    await standaloneLab.locator('#ai-fullscreen').click();
    assert.equal(await standaloneLab.evaluate(el=>el.classList.contains('is-immersive')),true,'Immersive fullscreen becomes active');
    assert.equal(await standaloneLab.locator('#ai-fullscreen').getAttribute('aria-pressed'),'true');
    await standalone.screenshot({path:out+'/fullscreen-'+width+'.png',fullPage:false});
    await standaloneLab.locator('#ai-fullscreen').click();
    assert.equal(await standaloneLab.evaluate(el=>el.classList.contains('is-immersive')),false,'Fullscreen exits');
    await standalone.waitForFunction(()=>document.fullscreenElement===null,'',{timeout:4000});
    await standaloneLab.locator('#ai-presentation').click();
    assert.equal(await standaloneLab.evaluate(el=>el.classList.contains('is-presenting')),true,'Presentation enters');
    assert.match(await standaloneLab.locator('#ai-slide-title').innerText(),/whole system/i);
    await standaloneLab.locator('#ai-slide-next').click();
    assert.match(await standaloneLab.locator('#ai-slide-title').innerText(),/direct answer/i);
    assert.equal(await standaloneLab.locator('.ai-journey-step').count(),8,'Presentation shows numbered request path');
    await standaloneLab.locator('#ai-slide-next').click();
    assert.match(await standaloneLab.locator('#ai-slide-title').innerText(),/tool/i);
    await standalone.screenshot({path:out+'/presentation-'+width+'.png',fullPage:false});
    await standalone.keyboard.press('Escape');
    assert.equal(await standaloneLab.evaluate(el=>el.classList.contains('is-presenting')),false,'Escape exits presentation');

    assert.deepEqual(labErrors,[]);
    await standalone.close();
    await ctx.close();
    console.log('PASS Agno infographic '+width+'px: component map, focus, layers, flows, zoom, theme');
  }
}catch(error){
  console.error('FAIL Agno architecture infographic',error);
  process.exitCode=1;
}finally{
  if(browser)await browser.close().catch(()=>{});
  server.kill('SIGKILL');process.exit(process.exitCode||0);
}