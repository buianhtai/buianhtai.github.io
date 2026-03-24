import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';

export type CliArgs = Record<string, string | boolean>;

export function parseArgs(args: string[]): CliArgs {
  const parsed: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = args[i + 1];

    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    i += 1;
  }

  return parsed;
}

export function parseFrontmatter(content: string): string {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  return match?.[1] ?? '';
}

export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function resolvePostPath(slug: string, lang?: string): Promise<string> {
  const blogRoot = join(process.cwd(), 'src/content/blog');
  const normalizedSlug = slug.replace(/\.(md|mdx)$/i, '');

  if (lang) {
    const candidate = join(blogRoot, lang, `${normalizedSlug}.mdx`);
    if (!existsSync(candidate)) {
      throw new Error(`Post not found: ${candidate}`);
    }
    return candidate;
  }

  const languageFolders = await readdir(blogRoot, { withFileTypes: true });
  for (const entry of languageFolders) {
    if (!entry.isDirectory()) continue;

    const candidate = join(blogRoot, entry.name, `${normalizedSlug}.mdx`);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Post not found for slug: ${slug}`);
}
