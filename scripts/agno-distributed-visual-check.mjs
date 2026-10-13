import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const host = 'http://127.0.0.1:4358';
const route = '/en/blog/agno-agentos-distributed-systems-data-architecture/';
const out = 'artifacts/agno-distributed';
await mkdir(out, { recursive: true });
const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4358'], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += String(chunk); });
server.stderr.on('data', chunk => { serverLog += String(chunk); });
let browser;

try {
  let ready = false;
  for (let attempt = 0; attempt < 70; attempt++) {
    try { if ((await fetch(host + route)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 220));
  }
  assert(ready, 'Article route failed: ' + serverLog.slice(-900));
  browser = await chromium.launch({ headless: true });

  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { localStorage.setItem('theme', 'terminal'); });
    await ctx.route('**/*', r => r.request().url().startsWith(host) ? r.continue() : r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(host + route, { waitUntil: 'domcontentloaded' });
    const lab = page.locator('#agno-distributed-lab');
    assert.equal(await lab.count(), 1);
    assert.equal(await lab.getAttribute('data-ready'), '1', 'Component hydrates');

    await lab.locator('[data-node="db"]').click();
    assert.match(await lab.locator('#dl-node-title').innerText(), /PostgreSQL/i);
    assert.match(await lab.locator('#dl-node-link').getAttribute('href'), /1f2aac51eb28dc9c0970836d3b7ae046bae81bbb/);

    await lab.locator('[data-tab="database"]').click();
    assert.equal(await lab.locator('[data-page="database"]').isVisible(), true);
    await lab.locator('[data-table="jobs"]').click();
    assert.match(await lab.locator('#dl-data-title').innerText(), /agno_jobs/i);

    await lab.locator('[data-tab="lifecycle"]').click();
    await lab.locator('[data-scenario="crash"]').click();
    assert.match(await lab.locator('#dl-scenario-title').innerText(), /crash/i);
    await lab.locator('#dl-next').click();
    assert.match(await lab.locator('#dl-event-title').innerText(), /Claimed/i);
    await lab.locator('[data-scenario="reconnect"]').click();
    assert.match(await lab.locator('#dl-scenario-title').innerText(), /reconnect/i);

    await lab.locator('[data-tab="capacity"]').click();
    await lab.locator('#dl-rate').evaluate(input => { input.value = '24'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.match(await lab.locator('#dl-growth').innerText(), /runs\/min/i);
    assert.match(await lab.locator('#dl-interpret').innerText(), /exceeds/i);

    await lab.scrollIntoViewIfNeeded();
    await page.screenshot({ path: out + '/agno-distributed-' + width + '-dark.png', fullPage: false });
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html.theme-light').count(), 1);
    await page.screenshot({ path: out + '/agno-distributed-' + width + '-light.png', fullPage: false });
    assert.deepEqual(errors, []);
    await ctx.close();
    console.log('PASS Agno distributed lab ' + width + 'px: tabs, nodes, data, failure, scaling, theme');
  }
} catch (error) {
  console.error('FAIL: Agno distributed lab', error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGKILL');
  process.exit(process.exitCode || 0);
}