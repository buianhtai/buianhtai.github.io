import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Source-based diagrams are expected to render as SVG, not literal Mermaid text. */
const host = 'http://127.0.0.1:4328';
const path = '/en/blog/deerflow-2-agent-harness-architecture/';
const output = 'artifacts/deerflow';
await mkdir(output, { recursive: true });

const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4328'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});
let serverLogs = '';
server.stdout.on('data', (buf) => { serverLogs += buf.toString(); });
server.stderr.on('data', (buf) => { serverLogs += buf.toString(); });
let browser;
let phase = 'starting preview';
const deadline = setTimeout(() => {
  console.error('Timed out during ' + phase);
  server.kill('SIGKILL');
  process.exit(1);
}, 105_000);

async function waitForPreview() {
  for (let i = 0; i < 45; i++) {
    try { if ((await fetch(host + path)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Astro preview did not start: ' + serverLogs.slice(-2000));
}
async function inspect(width, theme) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  await context.addInitScript((mode) => localStorage.setItem('theme', mode), theme);
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(host) || url.startsWith('https://cdn.jsdelivr.net/')) {
      return route.continue();
    }
    return route.abort();
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto(host + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    document.querySelectorAll('figure.mermaid-figure--editorial pre.mermaid svg').length === 8,
    { timeout: 50_000 },
  );
  const measurements = await page.evaluate(() => {
    const charts = [...document.querySelectorAll('figure.mermaid-figure--editorial')];
    return {
      figures: charts.length,
      svgs: charts.filter((f) => f.querySelector('pre.mermaid svg')).length,
      headings: charts.filter((f) => f.querySelector('.mermaid-heading')).length,
      bodyWidth: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      longCharts: charts.filter((f) => {
        const frame = f.querySelector('.mermaid-scroll');
        return frame && frame.scrollWidth > frame.clientWidth;
      }).length,
      broken: charts.filter((f) => f.textContent?.includes('Diagram unavailable')).length,
    };
  });
  assert.equal(measurements.figures, 8, 'Expected eight architecture diagrams');
  assert.equal(measurements.svgs, 8, 'All diagrams must render into SVG');
  assert.equal(measurements.headings, 8, 'Diagrams need descriptive headings');
  assert.equal(measurements.broken, 0, 'No Mermaid render errors');
  assert(measurements.bodyWidth <= measurements.viewport + 2, 'Document overflow: ' + JSON.stringify(measurements));
  if (width <= 390) assert(measurements.longCharts >= 1, 'Wide diagrams should scroll inside their own frame');
  assert.deepEqual(runtimeErrors, [], 'Browser encountered script errors');
  const label = theme + '-' + width;
  await page.locator('figure.mermaid-figure--editorial').first().screenshot({ path: output + '/topology-' + label + '.png' });
  await page.locator('figure.mermaid-figure--editorial').nth(3).screenshot({ path: output + '/delegation-' + label + '.png' });
  console.log('PASS: ' + label + ' ' + JSON.stringify(measurements));
  await context.close();
}
let passed = false;
try {
  await waitForPreview();
  phase = 'opening Chromium';
  browser = await chromium.launch({ headless: true });
  for (const theme of ['terminal', 'light']) {
    for (const width of [1440, 390]) {
      phase = 'rendering DeerFlow at ' + theme + ' ' + width;
      await inspect(width, theme);
    }
  }
  passed = true;
} catch (error) {
  console.error('FAIL: DeerFlow diagram visual QA during ' + phase, error);
} finally {
  if (browser) await Promise.race([
    browser.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  server.kill('SIGKILL');
  clearTimeout(deadline);
  process.exit(passed ? 0 : 1);
}
