#!/usr/bin/env node
/**
 * gen-cover — generate Nodes & Edges cover art via OpenAI Images API.
 *
 * Usage:  node scripts/gen-cover.mjs <slug> "<subject description>" [--draft <id>]
 *
 * Generates with gpt-image-1 (falls back to dall-e-3), saves PNG to
 * public/og/ai/<slug>-cover.png, optionally uploads to Substack CDN
 * and sets it as cover on a draft.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const slug = args[0];
const subjectIdx = args.indexOf(args[1]) === 1 ? 1 : 1;
const subject = args[1];
const draftIdx = args.indexOf('--draft');
const draftId = draftIdx !== -1 ? args[draftIdx + 1] : null;

if (!slug || !subject) { console.error('usage: gen-cover.mjs <slug> "<subject>" [--draft <id>]'); process.exit(1); }

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('❌ OPENAI_API_KEY not set'); process.exit(1); }

const cfg = JSON.parse(readFileSync(process.env.HOME + '/.config/opencode/opencode.json', 'utf8'));
const env = cfg.mcp.substack.environment;
const PUB = env.SUBSTACK_PUBLICATION_URL.replace(/\/$/, '');
const COOKIE = `substack.sid=${env.SUBSTACK_SESSION_TOKEN}; connect.sid=${env.SUBSTACK_SESSION_TOKEN}`;

const STYLE = `Flat vector editorial illustration, generous negative space, muted palette of deep navy (#1e3a5f), warm cream (#faf7f5), gold (#d4a73a) and terracotta (#c2410c) accents on a paper-textured background. Minimal geometric shapes suggesting connected nodes and edges. No text, no letters, no words anywhere in the image. Wide composition with the focal subject slightly right of center, leaving calm space on the left.`;

const prompt = `${STYLE}\n\nSubject: ${subject}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function callImages(body) {
  return fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const MODELS = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1-mini', 'gpt-image-1'];
async function generate() {
  let lastErr = '';
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const r = await callImages({ model, prompt, size: '1536x1024' });
      if (r.ok) {
        const j = await r.json();
        console.log('✓ generated with', model);
        return { b64: j.data[0].b64_json, model };
      }
      const t = await r.text();
      lastErr = `${model} → ${r.status}: ${t.slice(0, 100)}`;
      if (r.status !== 429) break;
      console.log(`${model} 429 — retry ${attempt}/2 in 20s…`);
      await sleep(20000);
    }
  }
  throw new Error('all image models failed. Last: ' + lastErr);
}
(async () => {
  const { b64, model } = await generate();
  const outDir = join(process.cwd(), 'public/og/ai');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${slug}-cover.png`);
  writeFileSync(outPath, Buffer.from(b64, 'base64'));
  console.log(`✅ saved ${outPath} (${model})`);

  if (draftId) {
    const dataUri = `data:image/png;base64,${b64}`;
    const form = new FormData();
    form.append('image', dataUri);
    const up = await fetch(`${PUB}/api/v1/image`, { method: 'POST', headers: { Cookie: COOKIE }, body: form });
    if (!up.ok) { console.error('upload failed:', up.status, (await up.text()).slice(0, 150)); process.exit(1); }
    const { url } = await up.json();
    console.log('CDN:', url);
    const upd = await fetch(`${PUB}/api/v1/drafts/${draftId}`, {
      method: 'PUT',
      headers: { Cookie: COOKIE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cover_image: url }),
    });
    console.log('COVER SET:', upd.status);
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
