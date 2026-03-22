import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { getPostUrl } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog', (p) => !p.data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: 'tai.bui blog',
    description: 'Learn in public — a full-stack developer blog by Tai Bui',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: getPostUrl(post),
    })),
  });
}
