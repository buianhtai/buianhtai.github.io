#!/usr/bin/env node
/**
 * DeerFlow drawings — one semantic scene creates an auto-layout D2 SVG
 * and native, editable diagrams.net XML. The JSON scene is the source of truth.
 *
 * The reusable Astro ArchitectureDrawing component only presents the outputs.
 * No runtime renderer or browser dependency is required.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const input = path.join(root, 'docs/deerflow/diagrams');
const output = path.join(root, 'public/diagrams/deerflow');
fs.mkdirSync(output, { recursive: true });

const names = ['deerflow-containers', 'deerflow-tool-boundary', 'deerflow-platform'];

const iconCatalog = JSON.parse(fs.readFileSync(
  path.join(root, 'node_modules/@iconify-json/lucide/icons.json'), 'utf8'
));
const iconDir = path.join(output, 'icons');
fs.mkdirSync(iconDir, { recursive: true });
const iconNames = new Set();
function iconSvg(name) {
  const icon = iconCatalog.icons[name];
  if (!icon) throw new Error('Unknown Lucide icon in diagram scene: ' + name);
  const w = icon.width ?? iconCatalog.width ?? 24;
  const h = icon.height ?? iconCatalog.height ?? 24;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 '
    + w + ' ' + h + '" fill="none" color="#38667f">'
    + icon.body.replaceAll('currentColor', '#38667f') + '</svg>\n';
}
function embedIcon(name) {
  return 'data:image/svg+xml;base64,' + Buffer.from(iconSvg(name), 'utf8').toString('base64');
}

const palette = {
  slate: ['#8292a6', '#eaf0f7'],
  blue: ['#5683c3', '#eaf3fc'],
  violet: ['#8b74c4', '#f4effe'],
  teal: ['#38988d', '#e6f7f2'],
  amber: ['#c08740', '#fff2e0'],
};
const xmlEscape = (value) => String(value ?? '').replace(/[<>&"']/g, (ch) =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[ch],
);
// Treat intentional backslash-n from authored metadata as a line break too.
const normalizeText = (value) => String(value ?? '').replace(/\\n/g, '\n');
const d2Quote = (s) => JSON.stringify(normalizeText(s));
const style = (accent, isBoundary = false) => {
  const [stroke, fill] = palette[accent];
  return [
    'style: {',
    'fill: ' + d2Quote(isBoundary ? fill : '#ffffff'),
    'stroke: ' + d2Quote(stroke),
    'stroke-width: 2',
    'font-color: "#1e3045"',
    'font-size: 17',
    'border-radius: 10',
    ...(isBoundary ? ['stroke-dash: 3'] : ['shadow: true']),
    '}',
  ];
};

function validate(scene) {
  if (!names.includes(scene.slug)) throw new Error('Unexpected scene name: ' + scene.slug);
  const ids = new Set();
  for (const b of scene.boxes) {
    if (ids.has(b.id)) throw new Error('Duplicate shape id: ' + b.id);
    if (!palette[b.accent]) throw new Error('Unknown palette: ' + b.accent);
    ids.add(b.id);
  }
  for (const b of scene.boxes) {
    if (b.parent && !ids.has(b.parent)) throw new Error('Unknown parent: ' + b.parent);
  }
  for (const e of scene.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) throw new Error('Edge points to unknown node: ' + e.id);
    if (!palette[e.accent]) throw new Error('Unknown edge palette: ' + e.accent);
  }
}

function toD2(scene) {
  const lines = [
    '# Generated from docs/deerflow/diagrams/' + scene.slug + '.json.',
    '# Do not edit this generated copy. Modify the semantic JSON scene instead.',
    'direction: right',
    'style: {',
    '  fill: "#f8fafc"',
    '}',
    '',
  ];
  const qualified = new Map(scene.boxes.map((b) => [b.id, b.parent ? b.parent + '.' + b.id : b.id]));
  const writeNode = (b, indent = '') => {
    const label = normalizeText(b.title) + (b.desc ? '\n' + normalizeText(b.desc) : '');
    const head = indent + b.id + ': ' + d2Quote(label) + ' {';
    lines.push(head);
    if (b.kind === 'data') lines.push(indent + '  shape: cylinder');
    if (b.icon) lines.push(indent + '  icon: ' + d2Quote('./icons/' + b.icon + '.svg'));
    for (const st of style(b.accent, b.kind === 'boundary')) lines.push(indent + '  ' + st);
    if (b.kind === 'boundary') {
      for (const child of scene.boxes.filter((x) => x.parent === b.id)) writeNode(child, indent + '  ');
    }
    lines.push(indent + '}');
  };
  for (const b of scene.boxes.filter((b) => !b.parent)) writeNode(b);
  lines.push('');
  for (const e of scene.edges) {
    const label = e.label ? ': ' + d2Quote(e.label) : '';
    lines.push(qualified.get(e.from) + ' -> ' + qualified.get(e.to) + label + ' {');
    lines.push('  style.stroke: ' + d2Quote(palette[e.accent][0]));
    lines.push('  style.stroke-width: 2');
    if (e.dashed) lines.push('  style.stroke-dash: 3');
    lines.push('}');
  }
  return lines.join('\n') + '\n';
}
function toDrawio(scene) {
  const all = new Map(scene.boxes.map((b) => [b.id, b]));
  const rows = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxfile host="app.diagrams.net" version="24.7.17" type="device" agent="astro-deerflow-diagrams">',
    '<diagram id="' + scene.slug + '" name="' + xmlEscape(scene.title) + '">',
    '<mxGraphModel dx="1500" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="' + scene.width + '" pageHeight="' + scene.height + '" math="0" shadow="0"><root>',
    '<mxCell id="0"/><mxCell id="1" parent="0"/>',
  ];
  const sorted = [
    ...scene.boxes.filter((b) => b.kind === 'boundary'),
    ...scene.boxes.filter((b) => b.kind !== 'boundary'),
  ];
  for (const b of sorted) {
    const [stroke, fill] = palette[b.accent];
    const parent = b.parent || '1';
    const offset = all.get(parent);
    const x = b.x - (offset?.x ?? 0);
    const y = b.y - (offset?.y ?? 0);
    const boundary = b.kind === 'boundary';
    let st = boundary
      ? 'rounded=1;arcSize=10;container=1;collapsible=0;whiteSpace=wrap;html=1;verticalAlign=top;align=left;spacingTop=18;spacingLeft=18;fillColor=' + fill + ';strokeColor=' + stroke + ';strokeWidth=2;dashed=1;dashPattern=8 5;fontColor=#18334e;fontSize=17;fontStyle=1;'
      : 'rounded=1;arcSize=12;whiteSpace=wrap;html=1;shadow=1;align=center;verticalAlign=middle;fillColor=#FFFFFF;strokeColor=' + stroke + ';strokeWidth=2;fontColor=#18334e;fontSize=16;fontStyle=1;';
    if (b.icon) st += 'spacingLeft=46;align=left;';
    // Escaping has two distinct layers: HTML content, then XML attribute.
    // Avoid double-escaping the whole value or diagrams.net shows entities.
    const asHtmlText = (value) => xmlEscape(normalizeText(value)).replaceAll('\n', '<br/>');
    const description = b.desc ? '<br/><font color="#64748b" style="font-size:12px">' + asHtmlText(b.desc) + '</font>' : '';
    const label = asHtmlText(b.title) + description;
    rows.push('<mxCell id="' + xmlEscape(b.id) + '" value="' + xmlEscape(label) + '" style="' + xmlEscape(st) + '" vertex="1" parent="' + xmlEscape(parent) + '"><mxGeometry x="' + x + '" y="' + y + '" width="' + b.w + '" height="' + b.h + '" as="geometry"/></mxCell>');
    if (b.icon) {
      const imageStyle = 'shape=image;aspect=fixed;imageAspect=0;image=' + embedIcon(b.icon) + ';';
      rows.push('<mxCell id="' + xmlEscape(b.id + '-icon') + '" value="" style="' + xmlEscape(imageStyle) + '" vertex="1" parent="' + xmlEscape(b.id) + '"><mxGeometry x="10" y="' + Math.max(7, Math.round((b.h - 26) / 2)) + '" width="26" height="26" as="geometry"/></mxCell>');
    }
  }
  for (const e of scene.edges) {
    const [stroke] = palette[e.accent];
    const st = 'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=' + stroke + ';strokeWidth=2;endArrow=block;endFill=1;fontSize=13;fontColor=#1e3045;labelBackgroundColor=#FFFFFF;' + (e.dashed ? 'dashed=1;dashPattern=6 6;' : '');
    rows.push('<mxCell id="' + xmlEscape(e.id) + '" value="' + xmlEscape(e.label) + '" style="' + xmlEscape(st) + '" edge="1" parent="1" source="' + xmlEscape(e.from) + '" target="' + xmlEscape(e.to) + '"><mxGeometry relative="1" as="geometry"/></mxCell>');
  }
  rows.push('</root></mxGraphModel></diagram></mxfile>');
  return rows.join('\n') + '\n';
}

for (const name of names) {
  const scene = JSON.parse(fs.readFileSync(path.join(input, name + '.json'), 'utf8'));
  for (const b of scene.boxes) {
    if (b.icon && !iconNames.has(b.icon)) {
      fs.writeFileSync(path.join(iconDir, b.icon + '.svg'), iconSvg(b.icon), 'utf8');
      iconNames.add(b.icon);
    }
  }
  validate(scene);
  const d2 = path.join(output, name + '.d2');
  const svg = path.join(output, name + '.svg');
  const drawio = path.join(output, name + '.drawio');
  const d2Source = toD2(scene);
  const drawioSource = toDrawio(scene);
  if (d2Source.includes('\\\\n')) throw new Error('Double-escaped newline in D2: ' + name);
  fs.writeFileSync(d2, d2Source, 'utf8');
  fs.writeFileSync(drawio, drawioSource, 'utf8');
  const result = spawnSync('d2', [d2, svg], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error('D2 build failed for ' + name + ':\n' + (result.stderr || result.error?.message || 'unknown error'));
  }
  if (!fs.existsSync(svg) || fs.statSync(svg).size < 1000) throw new Error('No SVG generated for ' + name);
  // Ensure labels are rendered cleanly, not as visible backslash-n escapes.
  const svgText = fs.readFileSync(svg, 'utf8');
  if (svgText.includes('\\n')) {
    throw new Error('Literal backslash-n found in rendered SVG for ' + name);
  }
  if (drawioSource.includes('&amp;lt;br')) {
    throw new Error('HTML line breaks are double-escaped in diagrams.net XML for ' + name);
  }

  console.log('Built D2 SVG + editable diagrams.net drawing: ' + name);
}
