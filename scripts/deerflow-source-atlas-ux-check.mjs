import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const host = 'http://127.0.0.1:4337';
const path = '/en/labs/deerflow-source-atlas/';
const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4337'], {
  env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', d => output += d);
server.stderr.on('data', d => output += d);
let browser;
const timeout = setTimeout(() => { console.error('Code Atlas QA timed out'); server.kill('SIGKILL'); process.exitCode = 1; }, 115000);
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(host + path)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert(ready, 'Astro preview must serve the source atlas: ' + output.slice(-700));
  const data = await (await fetch(host + '/data/deerflow-codegraph.generated.json')).json();
  assert(data.stats.symbols > 150, 'Source analyzer extracted substantial real symbols');
  assert(data.stats.calls > 200, 'Source analyzer extracted substantial actual call expressions');
  assert(data.stats.branches > 200, 'Source analyzer identified real source decision points');
  assert(data.relations.some(r => r.expression === 'run_agent' && r.to), 'Cross-file run_agent import resolves');
  assert(data.symbols.some(s => s.name === 'start_run' && s.line === 1845), 'start_run source location agrees with pinned revision');
  browser = await chromium.launch({ headless: true });
  const colors = [];
  for (const theme of ['dark', 'light']) {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await context.addInitScript(value => localStorage.setItem('theme', value), theme);
      await context.route('**/*', route => route.request().url().startsWith(host) ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(host+path,{waitUntil:'domcontentloaded'});
      await page.locator('[data-title]').getByText('stream_run', { exact:false }).waitFor({timeout:12000});
      assert.equal(await page.locator('[data-nodes] .graph-card').count() > 1, true, 'Graph nodes rendered');
      await page.locator('[data-seed="start_run"]').click();
      assert.match(await page.locator('[data-title]').innerText(),/start_run/,'Seed button focuses function');
      await page.locator('[data-view="branches"]').click();
      assert.equal(await page.locator('[data-stack] .stack-item').count() > 0,true,'AST branch map rendered');
      await page.locator('[data-view="imports"]').click();
      assert.equal(await page.locator('[data-stack] .stack-item').count() > 0,true,'Module import map rendered');
      await page.locator('[data-seed="RunManager"]').click();
      await page.locator('[data-view="classes"]').click();
      assert.equal(await page.locator('[data-nodes] .graph-card').count() > 1,true,'Class methods graph rendered');
      await page.locator('[data-view="calls"]').click();
      await page.locator('[data-plus]').click();
      assert.notEqual(await page.locator('[data-reset]').innerText(),'100%','Zoom control moves canvas');
      await page.locator('[data-reset]').click();
      assert.equal(await page.locator('[data-reset]').innerText(),'100%','Canvas zoom can be reset');
      await page.locator('[data-search]').fill('stream_run');
      assert.equal(await page.locator('.symbol-row').count() > 0,true,'Search filters real symbols');
      assert.equal(errors.length,0,'No client errors: '+errors.join('; '));
      const color = await page.locator('.sa').evaluate(node => getComputedStyle(node).backgroundColor);
      if(width === 1440)colors.push(color);
      await context.close();
    }
  }
  assert.notEqual(colors[0],colors[1],'Saved light/dark theme changes the actual explorer palette');
  console.log('Code Atlas acceptance passed: source-generated data, graph navigation, AST views, theme, mobile, zoom.');
} finally {
  clearTimeout(timeout);
  await browser?.close();
  server.kill('SIGTERM');
}