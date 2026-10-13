import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Self-contained UX acceptance checks for the unpublished editorial prototype. */
const host = 'http://127.0.0.1:4329';
const path = '/en/labs/deerflow-request-story/';
const out = 'artifacts/deerflow-story';
await mkdir(out, { recursive: true });
const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4329'], {
  env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk.toString(); });
server.stderr.on('data', (chunk) => { logs += chunk.toString(); });
let browser;
const watchdog = setTimeout(() => { console.error('Story QA timed out'); server.kill('SIGKILL'); process.exit(1); }, 110_000);
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(host + path)).ok) { ready = true; break; } } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(ready, 'Astro preview must serve the prototype: ' + logs.slice(-1200));
  browser = await chromium.launch({ headless: true });
  for (const theme of ['dark','light']) {
    for (const width of [320,390,768,1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion:'reduce' });
      await context.addInitScript((mode) => localStorage.setItem('theme', mode), theme);
      await context.route('**/*', (route) => route.request().url().startsWith(host) ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(host + path, {waitUntil:'domcontentloaded'});
      const root = page.locator('[data-story-root]');
      assert.equal(await root.count(),1,'One and only one storytelling UI');
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow','Prototype must not be indexed');
      assert.equal(await root.locator('[data-scene-tab]').count(),8,'Eight progressive chapters');
      const trace=root.locator('[data-trace-lab]');
      assert.equal(await trace.count(),1,'One source-backed execution timeline');
      assert.equal(await trace.locator('[data-trace-event]').count(),9,'Nine representative trace events');
      assert.equal(await trace.locator('[data-trace-panel]:visible').count(),1,'Single active trace inspector');
      await trace.locator('[data-trace-forward]').click();
      assert.equal(await trace.locator('[data-trace-panel="1"]').isVisible(),true,'Next trace event navigates inspector');
      assert.equal(await trace.locator('[data-lane-pill="RUNTIME"]').getAttribute('class'),'active','Correct runtime lane is highlighted');
      await trace.locator('[data-trace-event="8"]').click();
      assert.equal(await trace.locator('[data-trace-forward]').isDisabled(),true,'Final trace event stops navigation');
      await trace.locator('[data-trace-event="0"]').click();
      assert.equal(await trace.locator('[data-trace-back]').isDisabled(),true,'First trace event disables back');
      // The timeline and the stable architecture map must share one focus.
      await trace.locator('[data-trace-event="5"]').click();
      assert.equal(await root.locator('[data-scene-tab="3"]').getAttribute('aria-pressed'),'true','Tool event focuses the agent chapter');
      assert.equal(await root.locator('[data-node="tools"]').getAttribute('class')?.includes('on'),true,'Tool adapter highlighted');
      assert.equal(await root.locator('[data-wire="toolcall"]').getAttribute('class')?.includes('on'),true,'Authorized tool edge highlighted');
      assert.equal(new URL(page.url()).searchParams.get('event'),'6','Shareable URL preserves selected event');
      await root.locator('[data-depth-button="overview"]').click();
      assert.equal(await root.getAttribute('data-depth'),'overview','Overview emphasizes boundaries');
      await root.locator('[data-depth-button="code"]').click();
      assert.equal(await root.locator('[data-code-focus]').isVisible(),true,'Code depth reveals method and source');
      assert.equal(new URL(page.url()).searchParams.get('depth'),'code','Depth persists into shared URL');
      await root.locator('[data-depth-button="components"]').click();
      assert.equal(await root.locator('[data-code-focus]').isVisible(),false,'Components depth hides code stripe');
      await root.locator('[data-failure-button="denied"]').click();
      assert.equal(await root.locator('[data-failure-explanation]').isVisible(),true,'Denied tool scenario teaches recovery boundary');
      assert.equal(new URL(page.url()).searchParams.get('failure'),'denied','Scenario persists in URL');
      await root.locator('[data-failure-button="crash"]').click();
      assert.equal(await root.locator('[data-scene-tab="6"]').getAttribute('aria-pressed'),'true','Worker failure maps to recovery chapter');
      await root.locator('[data-failure-button="disconnect"]').click();
      assert.equal(await root.locator('[data-scene-tab="5"]').getAttribute('aria-pressed'),'true','Disconnect maps to reconnect chapter');
      await root.locator('[data-failure-button="normal"]').click();
      assert.equal(await root.locator('[data-failure-explanation]').isVisible(),false,'Normal scenario hides failure explanation');
      await root.locator('[data-scene-tab="0"]').click();
      assert.equal(await root.locator('[data-node="tools"]').getAttribute('class')?.includes('on'),false,'Chapter selection restores broad chapter focus');


      assert.equal(await root.locator('[data-story-example]:visible').count(),1,'Intro has one readable request/response example');
      assert.equal(await root.locator('[data-story-panel]:visible').count(),1,'Only one scene narration is visible');
      assert.equal(await root.locator('[data-scene-tab="0"]').getAttribute('aria-pressed'),'true');
      assert.equal(await root.locator('[data-prev]').isDisabled(),true);
      assert.equal(await root.locator('[data-progress]').getAttribute('aria-valuenow'),'1');
      assert.equal(await root.locator('[data-inspector]:visible').count(),1,'Visible scene has its optional inspector');
      assert.equal(await root.locator('[data-inspector]:visible').getAttribute('open'),null,'Code inspector defaults closed');
      await root.locator('[data-inspector]:visible summary').click();
      assert.equal(await root.locator('[data-inspector]:visible').getAttribute('open'),'','Reader can reveal technical details');
      assert.equal(await root.locator('[data-story-panel="0"] .source').count(),3,'Source links are available');
      await root.locator('[data-next]').click();
      assert.equal(await root.locator('[data-story-panel="1"]').isVisible(),true,'Next shows admission');
      // "Next" lives below the diagram; the scene change must restore the
      // actual diagram/chapter to the viewport, not update it off-screen.
      const chapterTop = await root.locator('.chapters').evaluate(el=>el.getBoundingClientRect().top);
      assert(chapterTop >= -8 && chapterTop <= 160,
        'Next must reveal scene visualization above fold: '+JSON.stringify({theme,width,chapterTop}));
      assert.equal(await root.locator('[data-scene-tab="1"]').getAttribute('aria-pressed'),'true');
      assert.equal(await root.locator('[data-progress]').getAttribute('aria-valuenow'),'2');
      if (width === 390 || width === 1440) await root.screenshot({path:out+'/story-admission-'+theme+'-'+width+'.png', animations:'disabled'});
      assert.equal(await root.locator('[data-story-panel="1"] [data-inspector]').getAttribute('open'),null,'Next scene code stays tucked away');
      await root.locator('[data-scene-tab="2"]').click();
      assert.equal(await root.locator('[data-story-panel="2"]').isVisible(),true,'Third scene explains the stream');
      if (width <= 640) {
        const mobileSse = await root.locator('[data-mobile="2"]').innerText();
        assert(mobileSse.includes('FastAPI Gateway'), 'Mobile SSE path must include the event-subscribing Gateway');
        assert(mobileSse.includes('SSE via Nginx'), 'Mobile SSE path must make the proxy/HTTP response explicit');
      }
      assert.equal(await root.locator('[data-next]').isDisabled(),false,'SSE is no longer the last chapter');
      assert.equal(await root.locator('[data-progress]').getAttribute('aria-valuenow'),'3');
      assert.equal(await root.locator('.node.on').count(),5,'SSE scene highlights relevant components');
      assert.equal(await root.locator('.wire.on').count(),4,'SSE scene displays model/publish/subscribe/HTTP links');
      if (width === 390 || width === 1440) await root.screenshot({path:out+'/story-stream-'+theme+'-'+width+'.png', animations:'disabled'});
      for (const i of [3,4,5,6,7]) {
        await root.locator('[data-scene-tab="'+i+'"]').click();
        assert.equal(await root.locator('[data-story-panel="'+i+'"]').isVisible(),true,'Additional chapter '+(i+1)+' renders');
        assert.equal(await root.locator('[data-progress]').getAttribute('aria-valuenow'),String(i+1),'Progress tracks extra chapters');
        assert.equal(await root.locator('[data-inspector]:visible').getAttribute('open'),null,'New chapter inspector remains optional');
        const exampleVisible=[0,1,2,5].includes(i);
        assert.equal(await root.locator('[data-story-example]:visible').count(),exampleVisible?1:0,'Only matching request/response example is shown');
        const illustrated = [3,4,6].includes(i);
        assert.equal(await root.locator('[data-vignette]:visible').count(),illustrated?1:0,'Scene-specific illustration visibility for '+i);
        if(illustrated) assert.equal(await root.locator('[data-vignette="'+i+'"]').isVisible(),true,'Correct illustration appears');
        if (width === 390 || width === 1440) await root.screenshot({path:out+'/story-chapter-'+(i+1)+'-'+theme+'-'+width+'.png',animations:'disabled'});
      }
      assert.equal(await root.locator('[data-next]').isDisabled(),true,'Chapter 8 ends the story');
      if (width === 1440) {
        await root.locator('[data-play]').click();
        assert.equal(await root.locator('[data-play]').getAttribute('aria-pressed'),'true','Autoplay is opt-in');
        await root.locator('[data-play]').click();
        assert.equal(await root.locator('[data-play]').getAttribute('aria-pressed'),'false','Autoplay can be paused');
      }
      await root.locator('[data-scene-tab="0"]').click();
      assert.equal(await root.locator('.node.on').count(),3,'Scene 1 highlights only relevant nodes');
      assert.equal(await root.locator('.wire.on').count(),2,'Scene 1 has only 2 HTTP paths');
      if (width <= 640) {
        assert.equal(await root.locator('.map').isVisible(),false,'Mobile must not shrink a 7-component canvas');
        assert.equal(await root.locator('[data-mobile="0"]').isVisible(),true,'Mobile story uses a vertical path');
        assert.equal(await root.locator('[data-mobile="1"]').isVisible(),false,'Inactive mobile path is hidden');
      } else {
        assert.equal(await root.locator('.map').isVisible(),true,'Wide screens get the persistent topology');
      }
      const dims = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
        bg: getComputedStyle(document.querySelector('[data-story-root]')).backgroundColor
      }));
      assert(dims.document <= dims.viewport + 2,
        'Page must not overflow horizontally: '+JSON.stringify({width,theme,...dims}));
      assert.equal(dims.bg, theme==='light'?'rgb(247, 249, 247)':'rgb(14, 24, 33)','Prototype respects website theme');
      assert.deepEqual(errors, [], 'No browser errors');
      const expandedInspector = root.locator('[data-story-panel="0"] [data-inspector]');
      if (width === 390 || width === 1440) {
        // Separate optional deep-dive artifact; the regular screenshot must show the default closed state.
        await root.screenshot({path:out+'/story-code-inspector-'+theme+'-'+width+'.png', animations:'disabled'});
      }
      if (await expandedInspector.getAttribute('open') !== null) {
        await root.locator('[data-story-panel="0"] [data-inspector] summary').click();
      }
      assert.equal(await expandedInspector.getAttribute('open'),null,'Default review image should present the closed inspector');
      await page.evaluate(() => window.scrollTo(0,0));
      await root.screenshot({path:out+'/story-'+theme+'-'+width+'.png', animations:'disabled'});

      if (width === 390 || width === 1440) {
        await page.goto(host+path+'?chapter=7&event=4&depth=code&view=event&failure=crash',{waitUntil:'domcontentloaded'});
        assert.equal(await root.getAttribute('data-depth'),'code','Deep link restores implementation depth');
        assert.equal(await root.locator('[data-scene-tab="6"]').getAttribute('aria-pressed'),'true','Deep link restores recovery chapter');
        assert.equal(await root.locator('[data-failure-explanation]').isVisible(),true,'Deep link restores failure scenario');
        assert.equal(await root.locator('[data-trace-event="3"]').getAttribute('aria-pressed'),'true','Deep link restores synchronized timeline event');
        const deeplinkDims=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
        assert(deeplinkDims[0]<=deeplinkDims[1]+2,'Deep-linked view must not overflow');
      }
      await context.close();
    }
  }
  console.log('Guided story UX passed: 8 scenes, keyboard-safe controls, code details, 320–1440px, dark/light.');
} catch (error) {
  console.error('FAIL: DeerFlow guided story UX', error);
  process.exitCode = 1;
} finally {
  if (browser) await Promise.race([browser.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 2000))]);
  clearTimeout(watchdog);
  server.kill('SIGKILL');
  // npm's preview child can retain stdout pipes after its wrapper is killed.
  // An explicit exit follows the pattern used by the existing visual tests.
  process.exit(process.exitCode || 0);
}
