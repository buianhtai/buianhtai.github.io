import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { readFileSync } from 'fs';
import { join } from 'path';

type SeriesConfig = {
  id: string;
};

const seriesData = JSON.parse(
  readFileSync(join(process.cwd(), 'src/content/series.json'), 'utf-8')
) as SeriesConfig[];
const seriesIds = seriesData.map((series) => series.id);

const seriesSchema =
  seriesIds.length > 0
    ? z.enum(seriesIds as [string, ...string[]]).optional()
    : z.string().optional();

export const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  heroImage: z.string().optional(),
  tags: z.array(z.string()).default([]),
  lang: z.enum(['en', 'vi']),
  category: z.enum(['architecture', 'golang', 'devops', 'ai', 'tutorial']),
  series: seriesSchema,
  seriesOrder: z.number().optional(),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: blogSchema,
});

export const collections = { blog };
