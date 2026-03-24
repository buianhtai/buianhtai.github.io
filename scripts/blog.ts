import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { register } from 'node:module';
import { join } from 'path';
import { parseArgs, slugify } from './lib';
import { z } from 'zod';

async function loadBlogSchema() {
  (globalThis as { __blogCliZod?: typeof z }).__blogCliZod = z;

  const astroContentStubUrl = `data:text/javascript,${encodeURIComponent(`
    export const z = globalThis.__blogCliZod;
    export function defineCollection(config) {
      return config;
    }
  `)}`;

  const astroLoadersStubUrl = `data:text/javascript,${encodeURIComponent(`
    export function glob(config) {
      return config;
    }
  `)}`;

  const loader = `
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'astro:content') {
        return {
          shortCircuit: true,
          url: ${JSON.stringify(astroContentStubUrl)}
        };
      }

      if (specifier === 'astro/loaders') {
        return {
          shortCircuit: true,
          url: ${JSON.stringify(astroLoadersStubUrl)}
        };
      }

      return nextResolve(specifier, context);
    }
  `;

  register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url);
  const contentConfig = await import('../src/content.config.ts');
  return contentConfig.blogSchema;
}

function requireStringArg(value: string | boolean | undefined, flag: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required argument: --${flag}`);
  }

  return value.trim();
}

function optionalStringArg(value: string | boolean | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseStringArray(value: string | boolean | undefined): string[] {
  if (typeof value !== 'string') return [];

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBooleanFlag(value: string | boolean | undefined, flag: string): boolean {
  if (value === undefined) return false;
  if (value === true) return true;
  if (value === false) return false;

  const normalized = value.toLowerCase().trim();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;

  throw new Error(`Invalid boolean for --${flag}: "${value}"`);
}

function parseOptionalNumber(value: string | boolean | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined;
  if (value === true) {
    throw new Error(`Flag --${flag} requires a numeric value`);
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number for --${flag}: "${value}"`);
  }

  return parsed;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildFrontmatterBlock(data: {
  title: string;
  description: string;
  pubDate: Date;
  tags: string[];
  lang: 'en' | 'vi';
  category: 'architecture' | 'golang' | 'devops' | 'ai' | 'tutorial';
  series?: string;
  seriesOrder?: number;
  draft: boolean;
}): string {
  const lines = [
    '---',
    `title: ${JSON.stringify(data.title)}`,
    `description: ${JSON.stringify(data.description)}`,
    `pubDate: ${formatDate(data.pubDate)}`,
    `tags: [${data.tags.map((tag) => JSON.stringify(tag)).join(', ')}]`,
    `lang: ${JSON.stringify(data.lang)}`,
    `category: ${JSON.stringify(data.category)}`,
  ];

  if (data.series !== undefined) {
    lines.push(`series: ${JSON.stringify(data.series)}`);
  }

  if (data.seriesOrder !== undefined) {
    lines.push(`seriesOrder: ${data.seriesOrder}`);
  }

  lines.push(`draft: ${data.draft}`);
  lines.push('---', '');

  return lines.join('\n');
}

function extractTemplateBody(template: string): string {
  const match = template.match(/^---\s*\n[\s\S]*?\n---\s*\n?/);
  if (!match) {
    throw new Error('Template frontmatter block not found');
  }

  return template.slice(match[0].length);
}

async function main() {
  const blogSchema = await loadBlogSchema();
  const args = parseArgs(process.argv.slice(2));

  const title = requireStringArg(args.title, 'title');
  const lang = typeof args.lang === 'string' && args.lang.trim() ? args.lang.trim() : 'en';
  const category =
    typeof args.category === 'string' && args.category.trim() ? args.category.trim() : 'architecture';
  const tags = parseStringArray(args.tags);
  const series = optionalStringArg(args.series);
  const seriesOrder = parseOptionalNumber(args.seriesOrder, 'seriesOrder');
  const draft = parseBooleanFlag(args.draft, 'draft');

  const slug = slugify(title);
  if (!slug) {
    throw new Error('Unable to generate slug from title');
  }

  const today = new Date().toISOString().slice(0, 10);
  const candidate = {
    title,
    description: '',
    pubDate: today,
    tags,
    lang,
    category,
    ...(series !== undefined ? { series } : {}),
    ...(seriesOrder !== undefined ? { seriesOrder } : {}),
    draft,
  };

  const parsed = blogSchema.safeParse(candidate);
  if (!parsed.success) {
    console.error('❌ Frontmatter validation failed:');
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      console.error(`- ${path}: ${issue.message}`);
    }
    process.exit(1);
  }

  const outputPath = join(process.cwd(), 'src/content/blog', parsed.data.lang, `${slug}.mdx`);
  if (existsSync(outputPath)) {
    throw new Error(`File already exists: ${outputPath}`);
  }

  const templatePath = join(process.cwd(), '.claude/skills/blog-writer/templates/post-template.mdx');
  const template = await readFile(templatePath, 'utf-8');
  const body = extractTemplateBody(template);
  const frontmatter = buildFrontmatterBlock(parsed.data);
  const content = `${frontmatter}${body}`;

  await mkdir(join(process.cwd(), 'src/content/blog', parsed.data.lang), { recursive: true });
  await writeFile(outputPath, content, 'utf-8');

  console.log(`✅ Created blog post: ${outputPath}`);
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
