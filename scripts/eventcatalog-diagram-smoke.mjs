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
  for(const name of ['agent-platform-plug-and-play','extension-lifecycle']){
    const imageUrl=host+'/architecture/illustrations/'+name+'.svg';
    const response=await page.request.get(imageUrl);
    assert.equal(response.status(),200,'Missing infographic illustration: '+name);
    const raw=await response.text();
    assert(raw.includes('<svg') && raw.includes('role="img"'),'Invalid or inaccessible infographic SVG: '+name);
    assert(!/Glide|Sanmina|\bPLM\b|99\.9%/i.test(raw),'Branded or fabricated claims in infographic: '+name);
  }
  const heroInfographic=page.locator('img[src$="agent-platform-plug-and-play.svg"]').first();
  await heroInfographic.waitFor({state:'visible',timeout:15000});
  await heroInfographic.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const image=document.querySelector('img[src$="agent-platform-plug-and-play.svg"]');
    return image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  },null,{timeout:15000});
  assert(await heroInfographic.isVisible(),'Illustrated platform image not visible in Chromium');
  await page.screenshot({path:output+'/PlugAndPlayInfographic.png',fullPage:false,timeout:15000});
  console.log('Brand-neutral architecture illustrations loaded and rendered successfully');

  const executiveImage=page.locator('[data-editorial-overview] img');
  await executiveImage.waitFor({state:'visible',timeout:20000});
  const executiveValid=await executiveImage.evaluate((img)=>img.complete && img.naturalWidth >= 1400);
  assert(executiveValid,'Editorial L0 SVG missing or not loaded');
  for(const name of ['executive','containers']){
    const url=host+'/architecture/showcase/editorial-'+name+'.svg';
    const response=await page.request.get(url);
    assert.equal(response.status(),200,'Editorial SVG route unavailable: '+name);
    const data=await response.text();
    assert(data.includes('<svg') && data.includes('diagram-title'),'Invalid generated editorial vector '+name);
    const editable=await page.request.get(host+'/architecture/showcase/editorial-'+name+'.drawio');
    assert.equal(editable.status(),200,'Editable draw.io view missing: '+name);
    assert((await editable.text()).includes('<mxfile'),'Invalid diagrams.net source '+name);
  }
  await page.locator('#editorial-container-details summary').click();
  const containerImage=page.locator('#editorial-container-details img');
  await containerImage.waitFor({state:'visible',timeout:15000});
  assert(await containerImage.evaluate((img)=>img.complete && img.naturalWidth>=1800),'Editable container SVG preview not visible');
  console.log('Professional L0/L2 vector previews and editable diagrams.net downloads passed');
  await page.screenshot({path:output+'/EditorialContainerBoundaries.png',fullPage:false,timeout:15000});

  const ids=['PlugAndPlayBlueprint','ExtensionLifecycle','ExecutiveOverview','ArchitectureOverview','C4SystemContext','C4Containers','C4ControlPlane','C4ExecutionPlane','C4FrontendComponents','C4APIComponents','C4IntegrationComponents','C4Deployment','AgentRunStateMachine','ToolInvocationSequence','TrustBoundaries'];
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
    if(id==='ExecutiveOverview'||id==='C4FrontendComponents'||id==='C4Containers'||id==='C4Deployment'){
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
  // Atlas is a self-contained design prototype published alongside EventCatalog:
  // verify the static route, responsive 2D fallback and a meaningful interaction.
  const atlasErrors=[];
  const atlasErrorListener=error=>atlasErrors.push(error.message);
  page.on('pageerror',atlasErrorListener);
  const atlas=await page.goto(host+'/architecture/atlas/',{waitUntil:'domcontentloaded',timeout:20000});
  assert.equal(atlas?.status(),200,'Architecture Atlas preview missing');
  await page.locator('#spatial').waitFor({state:'visible',timeout:15000});
  await page.locator('#view2d').click();
  await page.locator('#svgmap.show').waitFor({state:'visible',timeout:15000});
  await page.locator('[data-scenario="approval"]').click();
  await page.locator('#policyChoice:not(.hidden)').waitFor({state:'visible',timeout:15000});
  await page.locator('[data-policy="denied"]').click();
  assert.equal(await page.locator('[data-policy="denied"]').getAttribute('aria-pressed'),'true','Approval rejection simulation failed');
  await page.locator('#view3d').click();
  await page.screenshot({path:output+'/AtlasDesktop.png',fullPage:false,timeout:15000});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#view2d').click();
  assert(await page.locator('#svgmap.show').isVisible(),'Atlas mobile schematic unavailable');
  const noHorizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2);
  assert(noHorizontalOverflow,'Atlas mobile layout overflows the page');
  await page.screenshot({path:output+'/AtlasMobile.png',fullPage:false,timeout:15000});
  assert.equal(atlasErrors.length,0,'Atlas JavaScript errors: '+atlasErrors.join('; '));
  page.off('pageerror',atlasErrorListener);
  console.log('Architecture Atlas public route, interactions and mobile layout passed');
  await context.close();
}finally{
  await browser?.close().catch(()=>{});
  server.kill('SIGTERM');
}
