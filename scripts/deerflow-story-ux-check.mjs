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
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(host + path, {waitUntil:'domcontentloaded'});
      const root = page.locator('[data-story-root]');
      assert.equal(await root.count(),1,'One and only one storytelling UI');
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow','Prototype must not be indexed');
      assert.equal(await root.locator('[data-scene-tab]').count(),3,'Only three reader-first scenes');
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
      assert.equal(await root.locator('[data-scene-tab="1"]').getAttribute('aria-pressed'),'true');
      assert.equal(await root.locator('[data-progress]').getAttribute('aria-valuenow'),'2');
      assert.equal(await root.locator('[data-story-panel="1"] [data-inspector]').getAttribute('open'),null,'Next scene code stays tucked away');
      await root.locator('[data-scene-tab="2"]').click();
      assert.equal(await root.locator('[data-story-panel="2"]').isVisible(),true,'Third scene explains the stream');
      assert.equal(await root.locator('[data-next]').isDisabled(),true,'Last scene has disabled Next');
      assert.equal(await root.locator('[data-progress]').getAttribute('aria-valuenow'),'3');
      assert.equal(await root.locator('.node.on').count(),5,'SSE scene highlights relevant components');
      assert.equal(await root.locator('.wire.on').count(),4,'SSE scene displays model/publish/subscribe/HTTP links');
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
      await root.screenshot({path:out+'/story-'+theme+'-'+width+'.png', animations:'disabled'});
      await context.close();
    }
  }
  console.log('Guided story UX passed: 3 scenes, keyboard-safe controls, code details, 320–1440px, dark/light.');
} finally {
  if (browser) await browser.close();
  clearTimeout(watchdog);
  server.kill('SIGTERM');
}
