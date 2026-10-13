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
    assert.equal(await lab.locator('[data-link]').count(),24,'Every explicit relation shown');
    assert.equal(await lab.locator('.ai-boundary').count(),5,'Distinct system boundaries');

    await lab.locator('[data-node="agent"]').click();
    assert.match(await lab.locator('#ai-selected-title').innerText(),/Agent Runtime/i);
    assert.match(await lab.locator('#ai-selected-detail').innerText(),/model/i);
    assert((await lab.locator('.ai-edge.is-active').count())>=3,'Focused relations highlighted');
    assert((await lab.locator('.ai-rel-link').count())>=3,'Inspectable relation list');
    assert.match(await lab.locator('#ai-source').getAttribute('href'),/1f2aac51eb28dc9c0970836d3b7ae046bae81bbb/);

    await lab.locator('.ai-filter [data-layer="data"]').click();
    assert.equal(await lab.locator('.ai-filter [data-layer="data"]').getAttribute('aria-pressed'),'true','Data layer active');
    assert.equal(await lab.locator('[data-node="agent"]').getAttribute('aria-pressed'),null,'Node is not mistakenly handled as filter button');

    await lab.locator('.ai-scenarios [data-scenario="queue"]').click();
    assert.match(await lab.locator('#ai-story-title').innerText(),/Queue Configuration/i);
    const count=await lab.locator('.ai-edge.is-active').count();
    await lab.locator('#ai-next').click();
    assert((await lab.locator('.ai-edge.is-active').count())>=count,'Scenario path advances');
    assert.match(await lab.locator('#ai-step-count').innerText(),/02/);

    const initial=await lab.locator('#ai-svg').getAttribute('viewBox');
    await lab.locator('#ai-zoom-in').click();
    assert.notEqual(await lab.locator('#ai-svg').getAttribute('viewBox'),initial,'SVG zoom changes viewBox');
    await lab.locator('#ai-fit').click();
    assert.equal(await lab.locator('#ai-svg').getAttribute('viewBox'),'0 0 1200 762','Fit restores whole architecture');
    await lab.locator('#ai-clear').click();
    assert.equal(await lab.locator('.ai-scenarios [data-scenario="overview"]').getAttribute('aria-pressed'),'true');

    await lab.scrollIntoViewIfNeeded();
    await page.screenshot({path:out+'/architecture-'+width+'-dark.png',fullPage:false});
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html.theme-light').count(),1,'Theme switched to light');
    await lab.scrollIntoViewIfNeeded();
    await page.screenshot({path:out+'/architecture-'+width+'-light.png',fullPage:false});
    assert.deepEqual(errors,[],'No JavaScript exceptions');
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