#!/usr/bin/env node
/**
 * ship-substack — push a converted edition (markdown) to Substack as a DRAFT.
 *
 * Usage:  node scripts/ship-substack.mjs <edition.md> [--publish] [--email]
 *   --publish  also publish (default: draft only)
 *   --email    email subscribers on publish
 *
 * Reads SUBSTACK_PUBLICATION_URL / SUBSTACK_SESSION_TOKEN from opencode.json.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const PUBLISH = args.includes('--publish');
const EMAIL = args.includes('--email');
if (!file) { console.error('usage: ship-substack.mjs <edition.md> [--publish] [--email]'); process.exit(1); }

const cfg = JSON.parse(readFileSync(process.env.HOME + '/.config/opencode/opencode.json', 'utf8'));
const env = cfg.mcp.substack.environment;
const PUB = env.SUBSTACK_PUBLICATION_URL.replace(/\/$/, '');
const COOKIE = `substack.sid=${env.SUBSTACK_SESSION_TOKEN}; connect.sid=${env.SUBSTACK_SESSION_TOKEN}`;
const H = { Cookie: COOKIE, 'Content-Type': 'application/json', 'User-Agent': 'nodes-n-edges-ship/0.1' };

// ---------- markdown → ProseMirror ----------
function inline(text) {
  // returns PM text nodes with marks; handles **bold**, *em*, `code`, [t](url)
  const nodes = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m;
  const pushText = t => { if (t) nodes.push({ type: 'text', text: t }); };
  while ((m = re.exec(text))) {
    pushText(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) nodes.push({ type: 'text', text: tok.slice(2, -2), marks: [{ type: 'strong' }] });
    else if (tok.startsWith('*')) nodes.push({ type: 'text', text: tok.slice(1, -1), marks: [{ type: 'em' }] });
    else if (tok.startsWith('`')) nodes.push({ type: 'text', text: tok.slice(1, -1), marks: [{ type: 'code' }] });
    else {
      const lm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      nodes.push({ type: 'text', text: lm[1], marks: [{ type: 'link', attrs: { href: lm[2] } }] });
    }
    last = m.index + tok.length;
  }
  pushText(text.slice(last));
  return nodes.length ? nodes : [{ type: 'text', text: '' }];
}
const para = t => ({ type: 'paragraph', content: inline(t) });

function mdToProseMirror(md) {
  const lines = md.split('\n');
  const content = [];
  let i = 0;
  while (i < lines.length) {
    const L = lines[i];
    if (L.startsWith('```')) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++;
      content.push({ type: 'code_block', content: [{ type: 'text', text: buf.join('\n') }] });
      continue;
    }
    const h = L.match(/^(#{1,4})\s+(.*)/);
    if (h) { content.push({ type: 'heading', attrs: { level: h[1].length }, content: inline(h[2]) }); i++; continue; }
    if (/^[-*]\s+/.test(L)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, '')); i++; }
      content.push({ type: 'bullet_list', content: items.map(it => ({ type: 'list_item', content: [para(it)] })) });
      continue;
    }
    if (/^\d+\.\s+/.test(L)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, '')); i++; }
      content.push({ type: 'ordered_list', attrs: { start: 1 }, content: items.map(it => ({ type: 'list_item', content: [para(it)] })) });
      continue;
    }
    if (/^>\s?/.test(L)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      content.push({ type: 'blockquote', content: [para(buf.join(' '))] });
      continue;
    }
    if (/^---+\s*$/.test(L)) { content.push({ type: 'horizontal_rule' }); i++; continue; }
    // markdown table → bullet digest (Substack editor has no native tables)
    if (/^\|/.test(L)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const headers = cells(rows[0]);
      for (let r = 2; r < rows.length; r++) {
        const vals = cells(rows[r]);
        const line = vals.map((v, ci) => v ? `${headers[ci]}: ${v}` : null).filter(Boolean).join(' · ');
        content.push(para(`• ${line}`));
      }
      continue;
    }
    if (L.trim() === '') { i++; continue; }
    // merge soft-wrapped paragraph lines
    const buf = [L];
    while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !/^(#|[-*]\s|\d+\.\s|>|```|\||---)/.test(lines[i + 1])) {
      buf.push(lines[i + 1]); i++;
    }
    content.push(para(buf.join(' ')));
    i++;
  }
  return { type: 'doc', content };
}

// ---------- main ----------
const md = readFileSync(file, 'utf8');
const titleMatch = md.match(/^# (.+)$/m);
const subMatch = md.match(/^\*([^*]+)\*$/m);
const title = titleMatch ? titleMatch[1].trim() : file;
const subtitle = subMatch ? subMatch[1].trim() : undefined;

// strip the H1 + italic subtitle (they become title/subtitle fields)
const bodyMd = md.replace(/^# .+\n/m, '').replace(/^\*[^*]+\*\n/m, '');

(async () => {
  // userId
  const prof = await fetch('https://substack.com/api/v1/user/profile/self', { headers: { Cookie: COOKIE } });
  if (!prof.ok) { console.error(`❌ auth failed: ${prof.status}`); process.exit(1); }
  const userId = (await prof.json()).id;

  const payload = {
    draft_title: title,
    draft_subtitle: subtitle,
    draft_body: JSON.stringify(mdToProseMirror(bodyMd)),
    draft_bylines: [{ id: userId }],
    audience: 'everyone',
    type: 'newsletter',
  };

  const res = await fetch(`${PUB}/api/v1/drafts`, { method: 'POST', headers: { ...H }, body: JSON.stringify(payload) });
  console.log('CREATE:', res.status);
  if (!res.ok) { console.error((await res.text()).slice(0, 300)); process.exit(1); }
  const d = await res.json();
  console.log('✅ DRAFT CREATED');
  console.log('   draft id :', d.id);
  console.log('   title    :', d.draft_title || title);

  if (PUBLISH) {
    // publish lives on main host per writer.ts convention
    const pub = await fetch('https://substack.com/api/v1/drafts/' + d.id + '/publish', {
      method: 'POST', headers: H,
      body: JSON.stringify({ should_send_email: EMAIL }),
    });
    console.log('PUBLISH:', pub.status);
    if (pub.ok) { const p = await pub.json(); console.log('   live at :', p.canonical_url || `${PUB}/p/${p.id}`); }
    else console.error((await pub.text()).slice(0, 200));
  } else {
    console.log('   review  : Substack dashboard → Posts → Drafts');
    console.log('   publish : node scripts/ship-substack.mjs', file, '--publish');
  }

  // persist draft id next to edition for traceability
  writeFileSync(file.replace(/\.md$/, '.draft.json'), JSON.stringify({ draftId: d.id, shippedAt: new Date().toISOString(), published: false }));
})();
