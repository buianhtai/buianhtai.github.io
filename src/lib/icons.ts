/**
 * icons.ts — build-time SVG icon resolver for MDX diagram components.
 *
 * Pulls icon path data from Iconify JSON collections at Astro build time.
 * Zero runtime cost: all resolution happens server-side during SSG.
 *
 * Supported prefixes:
 *   lucide:       Lucide icons  (line icons, tech-neutral)
 *   simple-icons: Simple Icons  (brand logos, monochrome)
 *   logos:        Logos         (brand logos, colored)
 *
 * Usage in .astro frontmatter:
 *   import { resolveIcon } from '../../lib/icons';
 *   const icon = resolveIcon('lucide:database', 16);
 *   // icon.body  — SVG inner HTML (paths, circles, etc.)
 *   // icon.viewBox — e.g. "0 0 24 24"
 *   // icon.width / icon.height — rendered dimensions
 *
 * Then inside your SVG:
 *   <g transform={`translate(${cx - icon.width/2}, ${cy - icon.height/2})`}>
 *     <Fragment set:html={icon.body} />
 *   </g>
 *
 * Icon names follow the Iconify convention: "collection:name"
 * Browse at: https://icon-sets.iconify.design/
 *
 * Lucide examples:
 *   lucide:database       lucide:server        lucide:cpu
 *   lucide:cloud          lucide:network        lucide:layers
 *   lucide:shield         lucide:lock           lucide:key
 *   lucide:terminal       lucide:git-branch     lucide:brain
 *   lucide:search         lucide:zap            lucide:box
 *   lucide:hard-drive     lucide:disc           lucide:workflow
 *   lucide:users          lucide:user           lucide:bot
 *   lucide:message-square lucide:code           lucide:settings
 *   lucide:arrow-right    lucide:check-circle   lucide:alert-triangle
 *
 * Simple Icons / Logos examples:
 *   simple-icons:postgresql  simple-icons:redis     simple-icons:kubernetes
 *   simple-icons:docker      simple-icons:mongodb   simple-icons:graphql
 *   simple-icons:openai      simple-icons:github    simple-icons:typescript
 *   logos:postgresql         logos:redis            logos:kubernetes
 *   logos:docker             logos:mongodb          logos:react
 */

import { getIconData, iconToSVG, type IconifyJSON } from '@iconify/utils';

// Lazy-loaded collection caches (avoid loading all at startup)
const _cache: Record<string, IconifyJSON> = {};

function loadCollection(prefix: string): IconifyJSON | null {
  if (_cache[prefix]) return _cache[prefix];
  try {
    // Dynamic require — Vite/Rollup resolves these at build time
    const data: IconifyJSON = require(`@iconify-json/${prefix}/icons.json`);
    _cache[prefix] = data;
    return data;
  } catch {
    return null;
  }
}

export interface ResolvedIcon {
  body: string;       // Inner SVG HTML (paths, circles, polylines, etc.)
  viewBox: string;    // e.g. "0 0 24 24"
  width: number;      // Rendered width in px
  height: number;     // Rendered height in px
}

/**
 * Resolve an Iconify icon name to its SVG body and metadata.
 *
 * @param name   Icon name in "collection:icon" format, e.g. "lucide:database"
 * @param size   Render size in pixels (width and height). Default: 16
 * @param color  Override stroke/fill color. Default: "currentColor"
 * @returns      ResolvedIcon with body+viewBox, or null if not found
 */
export function resolveIcon(
  name: string,
  size: number = 16,
  color: string = 'currentColor'
): ResolvedIcon | null {
  const colonIdx = name.indexOf(':');
  if (colonIdx < 0) return null;

  const prefix = name.slice(0, colonIdx);
  const iconName = name.slice(colonIdx + 1);

  const collection = loadCollection(prefix);
  if (!collection) return null;

  const iconData = getIconData(collection, iconName);
  if (!iconData) return null;

  const rendered = iconToSVG(iconData, { height: size });

  // The body uses currentColor by default for lucide; for logos/simple-icons
  // the fill might be inline. Apply color override by replacing currentColor.
  let body = rendered.body;
  if (color !== 'currentColor') {
    body = body.replace(/currentColor/g, color);
  }

  const w = Number(rendered.attributes.width)  || size;
  const h = Number(rendered.attributes.height) || size;
  const vb = rendered.attributes.viewBox || `0 0 ${w} ${h}`;

  return { body, viewBox: vb, width: w, height: h };
}

/**
 * Resolve multiple icons at once. Returns a map of name → ResolvedIcon|null.
 * Useful when a component needs many icons.
 */
export function resolveIcons(
  names: string[],
  size: number = 16,
  color: string = 'currentColor'
): Record<string, ResolvedIcon | null> {
  const result: Record<string, ResolvedIcon | null> = {};
  for (const name of names) {
    result[name] = resolveIcon(name, size, color);
  }
  return result;
}

/**
 * Helper: build a complete <svg> element string for embedding inside
 * another SVG via a <foreignObject> or as a standalone icon.
 * For embedding INSIDE an SVG canvas, use resolveIcon() and set:html instead.
 */
export function iconToInlineSVG(
  name: string,
  size: number = 16,
  color: string = 'currentColor'
): string {
  const icon = resolveIcon(name, size, color);
  if (!icon) return '';
  return `<svg width="${icon.width}" height="${icon.height}" viewBox="${icon.viewBox}" fill="none">${icon.body}</svg>`;
}
