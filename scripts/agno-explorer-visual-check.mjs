import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const host = 'http://127.0.0.1:4352';
const pathname = '/en/blog/agno-agentos-platform-runtime-deep-dive/';
const out = 'artifacts/agno-explorer';
await mkdir(out, { recursive: true });

const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4352'], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stdout.on('data', chunk => { logs += String(chunk); });
server.stderr.on('data', chunk => { logs += String(chunk); });
let browser;

function luminance(color) {
  const numbers = (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  assert.equal(numbers.length, 3, 'Expected RGB: ' + color);
  return .2126 * numbers[0] + .7152 * numbers[1] + .0722 * numbers[2];
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 70; attempt++) {
    try { if ((await fetch(host + pathname)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 220));
  }
  assert(ready, 'Blog route failed to become available: ' + logs.slice(-1100));
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { localStorage.setItem('theme', 'terminal'); });
    await ctx.route('**/*', route => route.request().url().startsWith(host) ? route.continue() : route.abort());
    const page = await ctx.newPage();
    const exceptions = [];
    page.on('pageerror', error => exceptions.push(error.message));
    await page.goto(host + pathname, { waitUntil: 'domcontentloaded' });
    const lab = page.locator('#agno-lab');
    assert.equal(await lab.count(), 1, 'New article embeds the explorer');
    assert.equal(await lab.getAttribute('data-hydrated'), '1', 'Explorer JS initialized');
    assert.equal(await lab.locator('[data-scenario]').count(), 4, 'Four execution scenarios');

    await lab.locator('[data-scenario="tools"]').click();
    assert.equal(await lab.locator('[data-view="execution"]').getAttribute('aria-selected'), 'true');
    assert.match(await lab.locator('#al-scenario-heading').innerText(), /Tool loop/);
    await lab.locator('#al-next').click();
    assert.match(await lab.locator('#al-step-title').innerText(), /Start agent/);
    await lab.locator('#al-range').evaluate(el => { el.value = '4'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.match(await lab.locator('#al-step-title').innerText(), /Result returned/);
    assert.equal(await lab.locator('#al-step-list button[aria-pressed="true"]').count(), 1);

    await lab.locator('[data-scenario="failure"]').click();
    assert.match(await lab.locator('#al-scenario-heading').innerText(), /Failure & recovery/);
    await lab.locator('[data-view="code"]').click();
    assert.equal(await lab.locator('#al-files button').count(), 7);
    await lab.locator('#al-files button').nth(2).click();
    assert.match(await lab.locator('#al-file-title').innerText(), /Run event/);
    assert.match(await lab.locator('#al-file-link').getAttribute('href'), /1f2aac51eb28dc9c0970836d3b7ae046bae81bbb/);

    await lab.locator('[data-view="architecture"]').click();
    const node = lab.locator('#al-nodes .al-node');
    assert.equal(await node.count(), 10);
    await node.nth(8).click();
    assert.match(await lab.locator('#al-selected-title').innerText(), /Tool/);

    const dark = await lab.evaluate(el => getComputedStyle(el).backgroundColor);
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html.theme-light').count(), 1, 'Global light mode toggles');
    const light = await lab.evaluate(el => getComputedStyle(el).backgroundColor);
    assert(luminance(light) > luminance(dark) + 70, 'Explorer responds to light mode: ' + dark + ' → ' + light);
    await lab.scrollIntoViewIfNeeded();
    await page.screenshot({ path: out + '/agno-' + width + '-light.png', fullPage: false });
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html.theme-light').count(), 0, 'Dark mode restored');
    await page.screenshot({ path: out + '/agno-' + width + '-dark.png', fullPage: false });
    assert.deepEqual(exceptions, [], 'No browser exceptions');
    await ctx.close();
    console.log('Agno article ' + width + 'px: scenarios, code, node selection, scrubber and light/dark passed');
  }
  console.log('PASS: Agno interactive blog smoke checks');
} catch (error) {
  console.error('FAIL: Agno interactive blog smoke check', error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGKILL');
  process.exit(process.exitCode || 0);
}
