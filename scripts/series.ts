import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { parseArgs } from './lib';

type SeriesEntry = {
  id: string;
  title: string;
  description: string;
  lang: string;
  link: string | null;
};

function getRequiredString(value: string | boolean | undefined, flag: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required argument: --${flag}`);
  }
  return value.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const id = getRequiredString(args.id, 'id');
  const title = getRequiredString(args.title, 'title');
  const description = getRequiredString(args.description, 'description');
  const lang = typeof args.lang === 'string' && args.lang.trim() ? args.lang.trim() : 'Unknown';

  const seriesPath = join(process.cwd(), 'src/content/series.json');
  const raw = await readFile(seriesPath, 'utf-8');
  const series = JSON.parse(raw) as SeriesEntry[];

  if (series.some((entry) => entry.id === id)) {
    throw new Error(`Series with id "${id}" already exists`);
  }

  const nextEntry: SeriesEntry = {
    id,
    title,
    description,
    lang,
    link: null,
  };

  series.push(nextEntry);
  await writeFile(seriesPath, `${JSON.stringify(series, null, 2)}\n`, 'utf-8');

  console.log(`✅ Added series "${id}" to src/content/series.json`);
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
