import { readFile, writeFile } from 'fs/promises';
import { parseArgs, resolvePostPath } from './lib';

const args = parseArgs(process.argv.slice(2));

const slug = args.slug as string;
const lang = args.lang as string | undefined;

if (!slug) {
  console.error('Error: --slug is required');
  console.error('Usage: npm run blog:update -- --slug <slug> [--lang en|vi]');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

try {
  const filePath = await resolvePostPath(slug, lang);
  console.log(`Updating: ${filePath}`);

  let content = await readFile(filePath, 'utf-8');

  if (content.includes('updatedDate:')) {
    content = content.replace(/updatedDate:.*/, `updatedDate: ${today}`);
  } else {
    content = content.replace(/(pubDate:.*\n)/, `$1updatedDate: ${today}\n`);
  }

  await writeFile(filePath, content, 'utf-8');
  console.log(`✅ Updated updatedDate to ${today}`);
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
