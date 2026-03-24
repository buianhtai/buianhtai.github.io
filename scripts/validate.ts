import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { register } from 'node:module';
import yaml from 'js-yaml';
import { parseArgs, parseFrontmatter } from './lib';
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

interface ValidationError {
  filePath: string;
  errors: { path: string; message: string }[];
}

function findAllBlogFiles(): string[] {
  const blogRoot = join(process.cwd(), 'src/content/blog');
  const files: string[] = [];

  const langFolders = readdirSync(blogRoot, { withFileTypes: true });
  for (const folder of langFolders) {
    if (!folder.isDirectory()) continue;

    const langDir = join(blogRoot, folder.name);
    const langFiles = readdirSync(langDir);

    for (const file of langFiles) {
      if (file.endsWith('.md') || file.endsWith('.mdx')) {
        files.push(join(langDir, file));
      }
    }
  }

  return files;
}

function findSingleFile(slug: string): string | null {
  const normalizedSlug = slug.replace(/\.(md|mdx)$/i, '');
  const blogRoot = join(process.cwd(), 'src/content/blog');

  // Try both en and vi directories
  for (const lang of ['en', 'vi']) {
    const candidate = join(blogRoot, lang, `${normalizedSlug}.mdx`);
    if (existsSync(candidate)) {
      return candidate;
    }
    const mdCandidate = join(blogRoot, lang, `${normalizedSlug}.md`);
    if (existsSync(mdCandidate)) {
      return mdCandidate;
    }
  }

  // Also try with the original extension
  const enCandidate = join(blogRoot, 'en', slug);
  if (existsSync(enCandidate)) {
    return enCandidate;
  }
  const viCandidate = join(blogRoot, 'vi', slug);
  if (existsSync(viCandidate)) {
    return viCandidate;
  }

  return null;
}

function validateFile(filePath: string, schema: z.ZodSchema): ValidationError | null {
  const content = readFileSync(filePath, 'utf-8');
  const frontmatterYaml = parseFrontmatter(content);

  if (!frontmatterYaml) {
    return {
      filePath,
      errors: [{ path: '(frontmatter)', message: 'No frontmatter found' }],
    };
  }

  let parsedData: unknown;
  try {
    parsedData = yaml.load(frontmatterYaml);
  } catch (e) {
    return {
      filePath,
      errors: [{ path: '(yaml)', message: `YAML parse error: ${e instanceof Error ? e.message : String(e)}` }],
    };
  }

  const result = schema.safeParse(parsedData);

  if (result.success) {
    return null;
  }

  const errors = result.error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));

  return { filePath, errors };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const blogSchema = await loadBlogSchema();

  let filesToValidate: string[];

  if (args.file) {
    const fileArg = typeof args.file === 'string' ? args.file : String(args.file);
    const filePath = findSingleFile(fileArg);

    if (!filePath) {
      console.error(`❌ File not found: ${fileArg}`);
      console.error('Searched in: src/content/blog/en/, src/content/blog/vi/');
      process.exit(1);
    }

    filesToValidate = [filePath];
  } else {
    filesToValidate = findAllBlogFiles();
  }

  const validationErrors: ValidationError[] = [];

  for (const filePath of filesToValidate) {
    const error = validateFile(filePath, blogSchema);
    if (error) {
      validationErrors.push(error);
    }
  }

  // Print errors
  for (const error of validationErrors) {
    const relativePath = error.filePath.replace(process.cwd() + '/', '');
    console.error(`\nINVALID: ${relativePath}`);
    for (const err of error.errors) {
      console.error(`  - ${err.path}: ${err.message}`);
    }
  }

  // Print summary
  const totalFiles = filesToValidate.length;
  const invalidCount = validationErrors.length;

  if (invalidCount === 0) {
    console.log(`\n✅ Validated ${totalFiles} posts — all valid.`);
    process.exit(0);
  } else {
    console.log(`\n❌ Validated ${totalFiles} posts — ${invalidCount} invalid.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
