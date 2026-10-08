import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const host = 'http://127.0.0.1:4321';
const out = 'artifacts/editorial';
await mkdir(out, { recursive: true });
const server = spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4321'],{
  stdio:['ignore','pipe','pipe'], env:process.env
});
let logs = '';
server.stdout.on('data',d=>logs+=d.toString());
server.stderr.on('data',d=>logs+=d.toString());
let browser;
try {
  let ready = false;
  for(let i=0;i<50;i++){
    try {let r=await fetch(host + '/en/');if(r.ok){ready=true;break;}}catch{}
    if(server.exitCode !== null) throw Error('Astro preview terminated: '+logs);
    await new Promise(r=>setTimeout(r,500));
  }
  assert(ready, 'Astro preview server did not start: '+logs);
  browser=await chromium.launch({headless:true});

  const desktop=await browser.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:1 });
  await desktop.addInitScript(() => localStorage.setItem('theme','terminal'));
  const home=await desktop.newPage();
  await home.goto(host+'/en/',{waitUntil:'networkidle'});
  assert((await home.locator('h1').innerText()).includes('Building systems.'),'Hero text diverged from concept');
  assert.equal(await home.locator('.ed-topic-card').count(),4,'Hero should have four topic tiles');
  assert.equal(await home.locator('.ed-feature-card').count(),3,'Home should show three curated featured articles');
  await home.screenshot({path:out+'/desktop-home.png',fullPage:true});
  const concept=await home.locator('.ed-topic-panel').boundingBox();
  assert(concept && concept.width>300, 'Desktop topic panel must be visible');

  const archive=await desktop.newPage();
  await archive.goto(host+'/en/blog/',{waitUntil:'networkidle'});
  const articleURL='/en/blog/building-support-agents-for-your-platform';
  assert(await archive.locator('a.ed-archive-post[href="'+articleURL+'"]').count()===1,
    'Known standard-layout article is missing from archive');
  const total=Number(await archive.locator('#ed-result-count').innerText());
  assert(total>0,'Archive contains no articles');
  await archive.screenshot({path:out+'/desktop-archive.png',fullPage:true});
  await archive.locator('button[data-category="ai"]').click();
  assert(new URL(archive.url()).searchParams.get('category')==='ai','Category filter must update URL');
  const filtered=Number(await archive.locator('#ed-result-count').innerText());
  assert(filtered<=total,'Category filter count invalid');
  await archive.locator('#ed-article-search').fill('unlikely-keyword-for-no-results-82671');
  assert(!await archive.locator('#ed-no-results').isHidden(),'No-results message missing');
  await archive.locator('#ed-reset').click();
  assert.equal(Number(await archive.locator('#ed-result-count').innerText()),total,'Reset filters broken');

  const article=await desktop.newPage();
  await article.goto(host+articleURL,{waitUntil:'networkidle'});
  assert(await article.locator('#ed-article-body').count()===1,'Article reading area missing');
  await article.screenshot({path:out+'/desktop-article.png',fullPage:true});
  const foundationsLink = await archive.locator('.ed-archive-post[data-category="foundations"]').first().getAttribute('href');
  if(foundationsLink) {
    const foundation=await desktop.newPage();
    await foundation.goto(host+foundationsLink,{waitUntil:'domcontentloaded'});
    assert(await foundation.locator('.f-root').count()===1,'Foundations article layout is missing');
    await foundation.screenshot({path:out+'/desktop-foundations.png',fullPage:true});
    await foundation.close();
  }

  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await mobile.addInitScript(() => localStorage.setItem('theme','terminal'));
  for(const [label,path] of [['home','/en/'],['archive','/en/blog/'],['article',articleURL]]){
    const page=await mobile.newPage();
    await page.goto(host+path,{waitUntil:'networkidle'});
    await page.screenshot({path:out+'/mobile-'+label+'.png',fullPage:true});
    const sizes=await page.evaluate(()=>({
      viewport:document.documentElement.clientWidth,
      content:document.documentElement.scrollWidth
    }));
    assert(sizes.content<=sizes.viewport+2, 'Horizontal overflow on mobile '+label+': '+JSON.stringify(sizes));
    if(label==='article' && (await page.locator('.ed-mobile-toc').count())>0){
      assert(await page.locator('.ed-mobile-toc').isVisible(),'Mobile TOC should be visible');
    }
    await page.close();
  }

  const previousTheme=await home.locator('html').evaluate(el=>el.classList.contains('theme-light'));
  const narrow=await browser.newContext({viewport:{width:320,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await narrow.addInitScript(() => localStorage.setItem('theme','terminal'));
  for(const [label,path] of [['home','/en/'],['archive','/en/blog/']]){
    const page=await narrow.newPage();
    await page.goto(host+path,{waitUntil:'networkidle'});
    const sizes=await page.evaluate(()=>({width:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
    assert(sizes.content<=sizes.width+2,'Horizontal overflow on 320px '+label+': '+JSON.stringify(sizes));
    await page.screenshot({path:out+'/small-phone-'+label+'.png',fullPage:true});
    await page.close();
  }
  await narrow.close();

  await home.locator('#theme-toggle').click();
  const changedTheme=await home.locator('html').evaluate(el=>el.classList.contains('theme-light'));
  assert.notEqual(changedTheme,previousTheme,'Theme toggle not working');
  await home.screenshot({path:out+'/desktop-home-light.png',fullPage:true});
  console.log('PASS: desktop/mobile screenshots, topic cards, article route, filters, light mode, overflow');
  console.log('Preview screenshots saved to '+out);
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
