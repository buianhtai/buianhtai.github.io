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
  await context.close();
}finally{
  await browser?.close().catch(()=>{});
  server.kill('SIGTERM');
}
