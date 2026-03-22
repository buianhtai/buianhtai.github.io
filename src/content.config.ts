import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    lang: z.enum(['en', 'vi']),
    category: z.enum(['architecture', 'golang', 'devops', 'ai', 'tutorial']),
    series: z.enum(['goclaw', 'ai-agent-tools']).optional(),
    seriesOrder: z.number().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
