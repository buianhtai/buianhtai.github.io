import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const host = 'http://127.0.0.1:4321';
const output = 'artifacts/editorial';
await mkdir(output, { recursive: true });

const server = spawn('npm', ['run','preview','--','--host','127.0.0.1','--port','4321'], {
  stdio: ['ignore','pipe','pipe'],
  env: process.env,
});
let logs = '';
server.stdout.on('data', chunk => logs += chunk.toString());
server.stderr.on('data', chunk => logs += chunk.toString());

let browser;
let step = 'starting preview';
const timeout = setTimeout(() => {
  console.error('FAIL: visual smoke timeout at ' + step);
  server.kill('SIGTERM');
  process.exit(1);
}, 75_000);

async function ready() {
  for (let n = 0; n < 50; n++) {
    if (server.exitCode !== null) throw new Error('Preview exited: ' + logs);
    try { if ((await fetch(host + '/en/')).ok) return; } catch {}
    await new Promise(done => setTimeout(done, 300));
  }
  throw new Error('Preview did not become ready: ' + logs);
}

async function context(width, height) {
  const c = await browser.newContext({
    viewport: {width, height},
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  c.setDefaultTimeout(6_000);
  // External fonts, embeds and analytics must not hold up local visual QA.
  await c.route('**/*', route => {
    if (route.request().url().startsWith(host)) return route.continue();
    return route.abort();
  });
  await c.addInitScript(() => localStorage.setItem('theme','terminal'));
  return c;
}

async function noOverflow(page, where) {
  const box = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    width: document.documentElement.scrollWidth,
  }));
  assert(box.width <= box.viewport + 2, 'Horizontal overflow on ' + where + ': ' + JSON.stringify(box));
}

try {
  await ready();
  step = 'launching Chromium';
  browser = await chromium.launch({headless: true});

  step = 'desktop homepage';
  console.log('QA: desktop homepage');
  const desktop = await context(1440, 900);
  const home = await desktop.newPage();
  await home.goto(host + '/en/', {waitUntil: 'domcontentloaded'});
  assert.match(await home.locator('h1').first().innerText(), /Building systems/);
  assert.equal(await home.locator('.ed-topic-card').count(), 4);
  assert.equal(await home.locator('.ed-feature-card').count(), 3);
  await noOverflow(home, 'desktop homepage');
  await home.screenshot({path: output + '/home-desktop.png', timeout: 8_000});

  step = 'full-text search';
  console.log('QA: archive filters and Pagefind index');
  const archive = await desktop.newPage();
  await archive.goto(host + '/en/blog/', {waitUntil: 'domcontentloaded'});
  assert(Number(await archive.locator('#ed-result-count').innerText()) > 0);
  await archive.locator('button[data-category="architecture"]').click();
  assert.equal(new URL(archive.url()).searchParams.get('category'), 'architecture');
  await archive.locator('#ed-article-search').fill('Neo4j');
  await archive.waitForFunction(() =>
    document.getElementById('ed-fulltext-status')?.textContent?.includes('Results from full article text'), {timeout: 12_000});
  assert(Number(await archive.locator('#ed-result-count').innerText()) > 0, 'Pagefind returned zero architecture results');
  assert(await archive.locator('.ed-search-hit').count() > 0, 'Pagefind results are not visible');
  await archive.screenshot({path: output + '/search-desktop.png', timeout: 8_000});
  await archive.locator('#ed-article-search').fill('');
  await archive.locator('button[data-category="all"]').click();
  await archive.screenshot({path: output + '/archive-desktop.png', timeout: 8_000});

  step = 'article index scope';
  console.log('QA: both article layouts are indexed');
  for (const url of [
    '/en/blog/neo4j-deep-dive-storage-indexes-query-optimization',
    '/en/blog/deepagents-kb-mcp-troubleshooting',
  ]) {
    const html = await (await fetch(host + url)).text();
    assert(html.includes('data-pagefind-body'), 'Missing index scope in ' + url);
    assert(html.includes('data-pagefind-filter'), 'Missing index filters in ' + url);
  }
  const index = await fetch(host + '/pagefind/pagefind.js');
  assert.equal(index.status, 200, 'Pagefind static index was not produced');

  step = 'mobile layouts';
  console.log('QA: mobile 390px and 320px layouts');
  for (const width of [390, 320]) {
    const mobile = await context(width, 800);
    for (const [label,url] of [['home','/en/'],['archive','/en/blog/']]) {
      const page = await mobile.newPage();
      await page.goto(host + url, {waitUntil: 'domcontentloaded'});
      await noOverflow(page, width + 'px ' + label);
      await page.screenshot({path: output + '/' + label + '-' + width + '.png', timeout: 8_000});
      await page.close();
    }
    await mobile.close();
  }

  console.log('PASS: Astro routes, full-text results, article indexing and responsive layout');
} finally {
  clearTimeout(timeout);
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGTERM');
}
