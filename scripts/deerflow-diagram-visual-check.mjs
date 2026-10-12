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
    document.querySelectorAll('figure.mermaid-figure--editorial pre.mermaid svg').length === 5,
    null, { timeout: 50_000 },
  );
  // D2 SVG previews use native image lazy loading. Scroll to each drawing
  // before checking naturalWidth so the test measures rendered assets.
  const d2Images = page.locator('figure.de-drawing img');
  for (let i = 0; i < await d2Images.count(); i++) {
    await d2Images.nth(i).scrollIntoViewIfNeeded();
    await page.waitForFunction((index) => {
      const image = document.querySelectorAll('figure.de-drawing img')[index];
      return image && image.complete && image.naturalWidth > 0;
    }, i, { timeout: 15_000 });
  }
  // The E2E walkthrough must be interactive, not just numbered static boxes.
  const trace = page.locator('[data-deerflow-e2e]');
  assert.equal(await trace.count(), 1, 'A technical E2E walkthrough should be present');
  assert.equal(await trace.locator('[data-e2e-trigger]').count(), 8, 'Eight accountable stages required');
  assert.equal(await trace.locator('[data-e2e-panel]:visible').count(), 1, 'Only selected stage shown');
  await trace.locator('[data-e2e-trigger="05"]').click();
  assert.equal(await trace.locator('[data-e2e-panel="05"]').isVisible(), true, 'Model decision stage opens');
  await trace.locator('[data-e2e-next]').click();
  assert.equal(await trace.locator('[data-e2e-panel="06"]').isVisible(), true, 'Next enters conditional tool path');
  await trace.locator('[data-e2e-trigger="08"]').click();
  assert.equal(await trace.locator('[data-e2e-panel="08"]').isVisible(), true, 'Terminal/SSE stage opens');
  assert.equal(await trace.locator('[data-e2e-next]').isDisabled(), true, 'At last stage Next disabled');
  await trace.locator('[data-e2e-trigger="01"]').click();
  await trace.screenshot({ path: output + '/e2e-trace-' + theme + '-' + width + '.png' });

  const infographic = page.locator('figure.dfi');
  assert.equal(await infographic.count(), 1, 'One architecture infographic should precede the technical diagrams');
  assert.equal(await infographic.locator('.dfi-stage').count(), 5, 'The infographic should show five boundary stages');
  assert((await infographic.locator('svg').count()) >= 18, 'Expect semantic icons and flow signals');
  await infographic.screenshot({ path: output + '/system-map-' + theme + '-' + width + '.png' });
  const infographicBg = await infographic.evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.equal(infographicBg, theme === 'light' ? 'rgb(247, 251, 255)' : 'rgb(11, 20, 34)',
    'Infographic must follow the active site theme');
  const themeImages = await page.locator('figure.de-drawing img').evaluateAll((imgs) => imgs.map((img) =>
    ({ src: img.getAttribute('src'), dark: img.dataset.darkSrc, light: img.dataset.lightSrc })
  ));
  assert(themeImages.length === 3 && themeImages.every((asset) =>
    asset.src === (theme === 'light' ? asset.light : asset.dark)),
    'D2 drawings must swap to the matching SVG theme: ' + JSON.stringify(themeImages));


  const mermaidFigure = page.locator('figure.mermaid-figure--editorial').first();
  const mermaidScroll = mermaidFigure.locator('.mermaid-scroll');
  await mermaidFigure.scrollIntoViewIfNeeded();
  await mermaidFigure.locator('[data-mermaid-zoom="in"]').click();
  assert.equal(await mermaidFigure.locator('[data-mermaid-scale]').innerText(), '160%');
  await page.waitForFunction(() => {
    const el = document.querySelector('figure.mermaid-figure--editorial .mermaid-scroll');
    return el && el.scrollWidth > el.clientWidth + 2;
  }, null, { timeout: 5_000 });
  const mermaidExpanded = await mermaidScroll.evaluate((el) => ({
    client: el.clientWidth, scroll: el.scrollWidth,
  }));
  assert(mermaidExpanded.scroll > mermaidExpanded.client,
    'Mermaid diagram must pan inside its scroll viewport when zoomed: ' + JSON.stringify(mermaidExpanded));
  await mermaidFigure.locator('[data-mermaid-zoom="fit"]').click();
  assert.equal(await mermaidFigure.locator('[data-mermaid-scale]').innerText(), 'Fit');
  await page.waitForFunction(() => {
    const el = document.querySelector('figure.mermaid-figure--editorial .mermaid-scroll');
    return el && el.scrollWidth <= el.clientWidth + 2;
  }, null, { timeout: 5_000 });
  const overflowReport = await page.evaluate(() => {
    const html = document.documentElement;
    const viewportWidth = html.clientWidth;
    const elements = [...document.querySelectorAll('body *')].map((el) => {
      const rect = el.getBoundingClientRect();
      const cls = typeof el.className === 'string' ? el.className : '';
      return { tag: el.tagName, cls: cls.slice(0, 95), right: Math.round(rect.right),
        left: Math.round(rect.left), width: Math.round(rect.width), scroll: el.scrollWidth };
    });
    return { overflow: html.scrollWidth - viewportWidth, viewportWidth,
      offenders: elements.filter((el) => el.right > viewportWidth + 2 || el.left < -2)
        .sort((a, b) => b.right - a.right).slice(0, 14) };
  });
  assert(overflowReport.overflow <= 2,
    'Neither Mermaid nor the infographic may overflow the page: ' + JSON.stringify(overflowReport));

  const measurements = await page.evaluate(() => {
    const charts = [...document.querySelectorAll('figure.mermaid-figure--editorial')];
    const drawings = [...document.querySelectorAll('figure.de-drawing')];
    return {
      figures: charts.length,
      drawings: drawings.length,
      drawingImages: drawings.filter((f) => f.querySelector('img')).length,
      editLinks: drawings.filter((f) => f.querySelector('a[download][href$=".drawio"]')).length,
      svgs: charts.filter((f) => f.querySelector('pre.mermaid svg')).length,
      headings: charts.filter((f) => f.querySelector('.mermaid-heading')).length,
      bodyWidth: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      longCharts: charts.filter((f) => {
        const frame = f.querySelector('.mermaid-scroll');
        return frame && frame.scrollWidth > frame.clientWidth + 2;
      }).length,
      diagramOverflowPx: charts.map((f) => {
        const frame = f.querySelector('.mermaid-scroll');
        const canvas = f.querySelector('.mermaid-canvas');
        const svg = f.querySelector('svg');
        return {
          overflow: frame.scrollWidth - frame.clientWidth,
          viewport: frame.clientWidth,
          canvas: Math.round(canvas.getBoundingClientRect().width),
          svg: Math.round(svg.getBoundingClientRect().width),
          zoom: f.querySelector('[data-mermaid-scale]')?.textContent,
        };
      }),
      broken: charts.filter((f) => f.textContent?.includes('Diagram unavailable')).length,
    };
  });
  assert.equal(measurements.figures, 5, 'Expected five procedural Mermaid diagrams');
  assert.equal(measurements.drawings, 3, 'Expected three D2 architecture drawings');
  assert.equal(measurements.drawingImages, 3, 'Every D2 drawing must have an image');
  assert.equal(measurements.editLinks, 3, 'Every D2 drawing must have an editable diagrams.net link');
  assert.equal(measurements.svgs, 5, 'All Mermaid diagrams must render into SVG');
  assert.equal(measurements.headings, 5, 'Mermaid diagrams need descriptive headings');
  assert.equal(measurements.broken, 0, 'No Mermaid render errors');
  assert(measurements.bodyWidth <= measurements.viewport + 2, 'Document overflow: ' + JSON.stringify(measurements));
  if (width <= 390) assert.equal(measurements.longCharts, 0,
    'Mermaid diagrams should fit on phones (allow 2px rounding): ' + JSON.stringify(measurements.diagramOverflowPx));
  assert.deepEqual(runtimeErrors, [], 'Browser encountered script errors');
  // Regression coverage: preview must fit its panel, and zoom must be usable on phones.
  const firstDrawing = page.locator('figure.de-drawing').first();
  const viewer = firstDrawing.locator('.de-drawing-viewport');
  await firstDrawing.scrollIntoViewIfNeeded();
  const initial = await viewer.evaluate((el) => ({
    visible: el.clientWidth, content: el.scrollWidth,
    image: el.querySelector('img')?.getBoundingClientRect().width,
  }));
  assert(initial.image <= initial.visible + 2, 'Diagram should fit the available panel by default: ' + JSON.stringify(initial));
  await firstDrawing.locator('[data-diagram-zoom="in"]').click();
  assert.equal(await firstDrawing.locator('.de-drawing-zoom-level').innerText(), '160%');
  const expanded = await viewer.evaluate((el) => ({ visible: el.clientWidth, content: el.scrollWidth }));
  assert(expanded.content > expanded.visible, 'Zoomed diagram must be pannable within its own panel');
  assert((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 2, 'Zoom must not overflow the page');
  await firstDrawing.locator('[data-diagram-zoom="fit"]').click();
  assert.equal(await firstDrawing.locator('.de-drawing-zoom-level').innerText(), '100%');
  await firstDrawing.locator('[data-diagram-zoom="out"]').isDisabled().then((disabled) => assert(disabled, 'Fit should disable zoom out'));
  
  const label = theme + '-' + width;
  await page.locator('figure.de-drawing').first().screenshot({ path: output + '/topology-' + label + '.png' });
  await page.locator('figure.mermaid-figure--editorial').nth(2).screenshot({ path: output + '/delegation-' + label + '.png' });
  const infographicBox = await infographic.boundingBox();
  assert(infographicBox && infographicBox.width <= width + 2,
    'Infographic should be contained at ' + width + 'px');
  const assetChecks = await page.locator('figure.de-drawing img').evaluateAll((imgs) => imgs.map((img) => ({ ok: img.complete && img.naturalWidth > 0, src: img.getAttribute('src') })));
  assert(assetChecks.every((asset) => asset.ok), 'All D2 SVG assets must load: ' + JSON.stringify(assetChecks));
  console.log('PASS: ' + label + ' ' + JSON.stringify(measurements));
  await context.close();
}
let passed = false;
try {
  await waitForPreview();
  phase = 'opening Chromium';
  browser = await chromium.launch({ headless: true });
  for (const theme of ['terminal', 'light']) {
    for (const width of [1440, 768, 390, 320]) {
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
