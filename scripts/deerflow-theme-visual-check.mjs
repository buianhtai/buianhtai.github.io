import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const host='http://127.0.0.1:4342';
const routes=[
  {path:'/en/labs/deerflow-code-xray/',root:'.code-xray',name:'code-xray'},
  {path:'/en/labs/deerflow-source-atlas/',root:'.sa',name:'source-atlas'},
  {path:'/en/labs/deerflow-code-flow/',root:'.cf-page',name:'code-flow'},
];
const out='artifacts/deerflow-theme';
await mkdir(out,{recursive:true});
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4342'],{env:process.env,stdio:['ignore','pipe','pipe']});
let logs='';
server.stdout.on('data',d=>logs+=d.toString());
server.stderr.on('data',d=>logs+=d.toString());
let browser;
function brightness(color){
  const parts=(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  assert.equal(parts.length,3,'Expected RGB color, received '+color);
  return (parts[0]*0.2126+parts[1]*0.7152+parts[2]*0.0722);
}
try {
  let ready=false;
  for(let i=0;i<70;i++){
    try{if((await fetch(host+routes[0].path)).ok){ready=true;break}}catch{}
    await new Promise(r=>setTimeout(r,220));
  }
  assert(ready,'Preview server not ready: '+logs.slice(-1000));
  browser=await chromium.launch({headless:true});
  for(const width of [390,1400]){
    for(const route of routes){
      const context=await browser.newContext({viewport:{width,height:930},reducedMotion:'reduce'});
      await context.addInitScript(()=>{ if(localStorage.getItem('theme') === null) localStorage.setItem('theme','terminal'); });
      await context.route('**/*',r=>r.request().url().startsWith(host)?r.continue():r.abort());
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(host+route.path,{waitUntil:'domcontentloaded'});
      const shell=page.locator(route.root);
      assert.equal(await shell.count(),1,route.name+' root rendered');
      const controls=page.locator('[data-deerflow-theme-switch]');
      assert.equal(await controls.count(),1,'One visible mode switch on '+route.name);
      assert.equal(await controls.isVisible(),true,'Mode switch visible');
      assert.equal(await controls.locator('[data-theme-mode="dark"]').getAttribute('aria-pressed'),'true');
      const dark=await shell.evaluate(el=>getComputedStyle(el).backgroundColor);
      const savedDark=await page.evaluate(()=>localStorage.getItem('theme'));
      assert.equal(savedDark,'terminal');
      await controls.locator('[data-theme-mode="light"]').click();
      assert.equal(await page.locator('html.theme-light').count(),1,'Light class applies');
      assert.equal(await controls.locator('[data-theme-mode="light"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#theme-toggle').getAttribute('aria-label'),'Switch to dark mode','Shared header theme icon synchronized');
      const light=await shell.evaluate(el=>getComputedStyle(el).backgroundColor);
      assert(brightness(light)>brightness(dark)+70,route.name+' light theme must become visibly lighter: '+light+' vs '+dark);
      assert.equal(await page.evaluate(()=>localStorage.getItem('theme')),'light','Light setting persisted');
      await page.screenshot({path:out+'/'+route.name+'-'+width+'-light.png',fullPage:false});
      await page.reload({waitUntil:'domcontentloaded'});
      assert.equal(await page.locator('html.theme-light').count(),1,'Light mode persists across reload');
      assert.equal(await page.locator('[data-deerflow-theme-switch] [data-theme-mode="light"]').getAttribute('aria-pressed'),'true');
      await page.locator('[data-deerflow-theme-switch] [data-theme-mode="dark"]').click();
      assert.equal(await page.locator('html.theme-light').count(),0,'Dark restores');
      assert.equal(await page.locator('#theme-toggle').getAttribute('aria-label'),'Switch to light mode');
      const after=await shell.evaluate(el=>getComputedStyle(el).backgroundColor);
      assert.equal(after,dark,'Reversible light/dark background');
      await page.screenshot({path:out+'/'+route.name+'-'+width+'-dark.png',fullPage:false});
      assert.equal(errors.length,0,route.name+' browser errors: '+errors.join('; '));
      console.log(route.name+' '+width+'px: dark '+dark+' → light '+light+' → dark '+after+'; click/persist/reload passed');
      await context.close();
    }
  }
  console.log('PASS: all three DeerFlow code labs visibly switch light/dark, persist, and sync shared header on desktop/mobile.');
} catch(error) {
  console.error('FAIL: DeerFlow theme visual regression',error);
  process.exitCode=1;
} finally {
  await Promise.race([browser?.close().catch(()=>{}),new Promise(r=>setTimeout(r,2000))]);
  server.kill('SIGKILL');
  process.exit(process.exitCode||0);
}
