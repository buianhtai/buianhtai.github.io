#!/usr/bin/env node
/**
 * mdx-to-substack — convert house MDX posts into Substack-ready markdown.
 *
 * Usage:   node scripts/mdx-to-substack.mdx <post.mdx> [more.mdx ...]
 * Output:  substack-editions/<slug>.md  (paste into Substack editor)
 *
 * Transforms:
 *   - frontmatter  → title header + subtitle
 *   - imports      → stripped
 *   - <Callout>    → blockquote with bold label
 *   - <DataTable>  → markdown table (parses headers/rows arrays)
 *   - <MetricBar>  → bullet list of metrics
 *   - interactive components (Flowchart, StateMachine, SequenceDiagram,
 *     ArchDiagram, Pipeline) → canonical-post link placeholder
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

const CANONICAL_BASE = 'https://buianhtai.dev/en/blog/';
const OUT_DIR = 'substack-editions';

function fail(msg) { console.error(`❌ ${msg}`); process.exit(1); }

function parseFrontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { fm: {}, body: src };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*"?(.*?)"?\s*$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^"|"$/g, '');
  }
  return { fm, body: src.slice(m[0].length) };
}

function stripImports(body) {
  return body.replace(/^import .*$/gm, '').replace(/\n{3,}/g, '\n\n');
}

function inlineFmt(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '**$1**')
    .replace(/`([^`]+)`/g, '`$1`')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract balanced JSX block for a component starting at index. Returns {block, next}. */
function extractBlock(body, startIdx) {
  let depth = 0, i = startIdx, inStr = null;
  while (i < body.length) {
    const ch = body[i], prev = body[i - 1];
    if (inStr) { if (ch === inStr && prev !== '\\') inStr = null; }
    else if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0 && body.slice(i - 1, i + 1) !== '/>') {
      // self-closing handled below; open tag found
    }
    if (depth === 0 && ch === '>' && body[i - 1] === '/') {
      return { block: body.slice(startIdx, i + 1), next: i + 1 };
    }
    if (depth === 0 && ch === '>') {
      // could be end of opening tag — look ahead for matching close tag
      const tagMatch = body.slice(startIdx).match(/^<(\w+)/);
      if (tagMatch) {
        const close = `</${tagMatch[1]}>`;
        const closeIdx = body.indexOf(close, i);
        if (closeIdx !== -1) {
          return { block: body.slice(startIdx, closeIdx + close.length), next: closeIdx + close.length };
        }
      }
    }
    i++;
  }
  return { block: body.slice(startIdx), next: body.length };
}

function parseArrayProp(block, propName) {
  const key = propName + '={';
  const start = block.indexOf(key);
  if (start === -1) return null;
  const arrStart = block.indexOf('[', start);
  if (arrStart === -1) return null;
  let depth = 0, inStr = null;
  for (let i = arrStart; i < block.length; i++) {
    const ch = block[i], prev = block[i - 1];
    if (inStr) { if (ch === inStr && prev !== '\\') inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        const lit = block.slice(arrStart, i + 1);
        try { return JSON.parse(lit.replace(/,\s*(?=[\]}])/g, "")); } catch (e) { return null; }
      }
    }
  }
  return null;
}
function dataTableToMd(block) {
  const headers = parseArrayProp(block, 'headers');
  const rows = parseArrayProp(block, 'rows');
  if (!headers || !rows) return null;
  const lines = [
    '| ' + headers.join(' | ') + ' |',
    '|' + headers.map(() => ' --- ').join('|') + '|',
  ];
  for (const r of rows) {
    lines.push('| ' + headers.map(h => inlineFmt(String(r[h] ?? '')).replace(/\|/g, '\\|')).join(' | ') + ' |');
  }
  return lines.join('\n');
}

function calloutToMd(block) {
  const color = (block.match(/color="(\w+)"/) || [])[1] || 'note';
  const inner = block.match(/<Callout[^>]*>\s*([\s\S]*?)\s*<\/Callout>/);
  const text = inner ? inlineFmt(inner[1].replace(/<\/?strong>/g, '**')) : '';
  const labels = { teal: 'KEY INSIGHT', amber: 'REALITY CHECK', rose: 'WARNING', green: 'TIP', violet: 'NOTE' };
  return `> **${labels[color] || 'NOTE'}:** ${text}`;
}

function metricBarToMd(block) {
  const metrics = parseArrayProp(block, 'metrics');
  if (!metrics) return null;
  return metrics.map(m => `- **${m.label}:** ${m.displayValue ?? m.value}`).join('\n');
}

function convert(body, slug) {
  const canonical = `${CANONICAL_BASE}${slug}/`;
  let out = '';
  let i = 0;
  const compRe = /<(Callout|DataTable|MetricBar|Flowchart|StateMachine|SequenceDiagram|ArchDiagram|Pipeline|Label|HeroGrid)\b/g;

  while (i < body.length) {
    compRe.lastIndex = i;
    const m = compRe.exec(body);
    if (!m) { out += body.slice(i); break; }

    out += body.slice(i, m.index);
    const { block, next } = extractBlock(body, m.index);
    i = next;
    const comp = m[1];

    if (comp === 'DataTable') {
      const md = dataTableToMd(block);
      out += md ?? `> 📊 Table omitted — see the interactive version at ${canonical}`;
    } else if (comp === 'Callout') {
      out += calloutToMd(block);
    } else if (comp === 'MetricBar') {
      out += metricBarToMd(block) ?? '';
    } else {
      const title = (block.match(/title="([^"]+)"/) || block.match(/title=\{\s*"([^"]+)"/) || [])[1]
        || (parseArrayProp(block, 'nodes') || [])[0]?.label
        || 'Diagram';
      out += `> 📈 **${inlineFmt(title)}** — interactive diagram in the [canonical post](${canonical}).`;
    }
    out += '\n\n';
  }
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---- main ----
const files = process.argv.slice(2);
if (files.length === 0) fail('usage: node scripts/mdx-to-substack.mjs <post.mdx> [...]');

mkdirSync(OUT_DIR, { recursive: true });

for (const f of files) {
  const raw = readFileSync(f, 'utf8');
  const { fm, body } = parseFrontmatter(raw);
  const title = fm.title || basename(f, '.mdx');
  const slug = basename(f).replace(/\.mdx$/, '');

  let md = `# ${title}\n\n`;
  if (fm.description) md += `*${fm.description}*\n\n`;
  md += `---\n\n`;
  md += convert(stripImports(body), slug);
  md += `\n---\n\n*Originally published with interactive diagrams at [buianhtai.dev](${CANONICAL_BASE}${slug}/)*\n`;

  const outPath = join(OUT_DIR, `${slug}.md`);
  writeFileSync(outPath, md);
  console.log(`✅ ${outPath} (${md.split('\n').length} lines)`);
}
