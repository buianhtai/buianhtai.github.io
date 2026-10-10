// Runtime smoke test: diagrams must render as SVG in the published static EventCatalog.
// This complements build-time route checks, which alone cannot detect Mermaid parse errors.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = 4355;
const host = 'http://127.0.0.1:' + port;
const output = 'artifacts/architecture';
await mkdir(output, {recursive:true});
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','dist'], {stdio:['ignore','pipe','pipe']});
let logs='';
server.stderr.on('data',b=>logs+=b.toString());
let browser;
try{
  let ready=false;
  for(let attempt=0;attempt<50;attempt++){
    if(server.exitCode!==null)throw Error('Static server exited: '+logs);
    try{const x=await fetch(host+'/architecture/');if(x.ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,200));
  }
  assert(ready,'Static architecture server unavailable: '+logs);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1400,height:900}, deviceScaleFactor:1, reducedMotion:'reduce'});
  const page=await context.newPage();
  const homeResponse=await page.goto(host+'/architecture/',{waitUntil:'domcontentloaded',timeout:20000});
  assert.equal(homeResponse?.status(),200,'Architecture homepage missing');
  const contextPlaceholder=page.locator('#system-context-map-portal');
  const graphPlaceholder=page.locator('[data-architecture-graph-portal]').first();
  assert.equal(await contextPlaceholder.count(),1,'Missing native SystemContextMap placeholder');
  assert.equal(await graphPlaceholder.count(),1,'Missing native ArchitectureGraph placeholder');
  await graphPlaceholder.locator('canvas').first().waitFor({state:'visible',timeout:25000});
  // Native context maps use the EventCatalog React Flow visualizer.
  await contextPlaceholder.locator('.react-flow').first().waitFor({state:'visible',timeout:25000});
  console.log('Native SystemContextMap and ArchitectureGraph mounted successfully');
  await page.screenshot({path:output+'/NativeArchitectureHomepage.png',fullPage:false,timeout:15000});
  const ids=['ArchitectureOverview','C4SystemContext','C4Containers','C4ControlPlane','C4ExecutionPlane','C4Deployment','TrustBoundaries'];
  for(const id of ids){
    const url=host+'/architecture/diagrams/'+id+'/0.1.0/embed/';
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
    assert.equal(response?.status(),200,'Embed route failed: '+id);
    // Mermaid diagrams render client-side. A generated static HTML page alone
    // is not evidence the diagram actually appears.
    await page.locator('.mermaid svg').first().waitFor({state:'visible',timeout:25000});
    const n=await page.locator('.mermaid svg').count();
    assert(n>0,'No rendered SVG for '+id);
    const pageText=await page.locator('body').innerText();
    assert(!/syntax error in text|mermaid version .*error/i.test(pageText),'Mermaid error on '+id);
    console.log('Rendered '+id+' ('+n+' SVG)');
    if(id==='ArchitectureOverview'||id==='C4Containers'||id==='C4Deployment'){
      await page.screenshot({path:output+'/'+id+'.png',fullPage:true,timeout:15000});
    }
  }
  for(const slug of ['agent-platform-container-map','agent-run-sequence','approval-swimlane']){
    const response=await page.goto(host+'/architecture/showcase/'+slug+'.html',{waitUntil:'domcontentloaded',timeout:25000});
    assert.equal(response?.status(),200,'Archify pilot route missing: '+slug);
    await page.locator('svg').first().waitFor({state:'visible',timeout:20000});
    assert((await page.locator('svg').count())>=1,'Archify pilot has no SVG visualization: '+slug);
    console.log('Archify pilot rendered: '+slug);
    if(slug==='agent-platform-container-map')await page.screenshot({path:output+'/ArchifyContainerPilot.png',fullPage:false});
  }
  await context.close();
}finally{
  await browser?.close().catch(()=>{});
  server.kill('SIGTERM');
}
