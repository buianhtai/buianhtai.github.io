import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const host = 'http://127.0.0.1:4391';
const route = '/en/labs/diagram-system/';
const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4391'], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(host + route)).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert(ready, 'Gallery must be available');
  browser = await chromium.launch();
  await mkdir('artifacts/diagram-system', { recursive: true });
  for (const width of [390, 768, 1440]) {
    for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(value => localStorage.setItem('theme', value), theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(host + route);
      await page.waitForFunction(() => document.querySelectorAll('diagram-frame[data-ready]').length === 8);
      const frames = page.locator('diagram-frame');
      assert.equal(await frames.count(), 8);
      for (let i = 0; i < 8; i++) {
        const frame = frames.nth(i);
        const content = frame.locator('.diagram-content');
        const before = await content.boundingBox();
        await frame.locator('[data-action="in"]').click();
        assert.equal(await frame.locator('output').textContent(), '125%');
        const after = await content.boundingBox();
        assert(after.width > before.width * 1.2, 'Zoom must enlarge rendered content');
        assert.equal(await frames.nth((i + 1) % 8).locator('output').textContent(), '100%', 'Other diagrams retain their zoom');
        await frame.locator('[data-action="focus"]').click();
        assert.equal(await frame.locator('dialog').evaluate(el => el.open), true);
        assert.equal(await frame.locator('dialog .diagram-panel').count(), 1);
        await page.keyboard.press('Escape');
        assert.equal(await frame.locator('dialog').evaluate(el => el.open), false);
        assert.equal(await frame.locator('[data-action="focus"]').evaluate(el => el === document.activeElement), true, 'Restore keyboard focus');
        await frame.locator('[data-action="reset"]').click();
        assert.equal(await frame.locator('output').textContent(), '100%');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow');
      }
      await page.screenshot({ path: `artifacts/diagram-system/${theme}-${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(host + route);
  assert.equal(await page.locator('diagram-frame .diagram-panel').count(), 8);
  assert.equal(await page.locator('.diagram-toolbar:visible').count(), 0, 'Do not show inactive controls without JavaScript');
  await context.close();
  console.log('Diagram gallery: eight renderers, mobile/tablet/desktop, both themes, zoom isolation, modal focus, and no-JS fallback passed.');
} finally {
  await browser?.close();
  server.kill();
}
