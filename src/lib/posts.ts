import type { CollectionEntry } from 'astro:content';

export function getPostSlug(post: CollectionEntry<'blog'>): string {
  const [, ...slugParts] = post.id.split('/');
  return slugParts.join('/').replace(/\.(md|mdx)$/, '');
}

export function getPostLang(post: CollectionEntry<'blog'>): string {
  return post.id.split('/')[0];
}

export function getPostUrl(post: CollectionEntry<'blog'>): string {
  return `/${getPostLang(post)}/blog/${getPostSlug(post)}`;
}

export const seriesMeta: Record<string, { title: string; description: string }> = {
  goclaw: {
    title: 'GoClaw — Multi-Agent AI Gateway',
    description: 'Deep dives into GoClaw\'s architecture: agent loops, providers, tools, security, memory, and orchestration.',
  },
  'ai-agent-tools': {
    title: 'AI Agent Tools — Open Source Deep Dives',
    description: 'Architecture studies of open-source tools that make AI coding agents practical.',
  },
};

export function groupPostsBySeries(posts: CollectionEntry<'blog'>[]) {
  const groups: { series: string | null; posts: CollectionEntry<'blog'>[] }[] = [];
  const seriesMap = new Map<string, CollectionEntry<'blog'>[]>();
  const standalone: CollectionEntry<'blog'>[] = [];

  for (const post of posts) {
    const s = post.data.series;
    if (s) {
      if (!seriesMap.has(s)) seriesMap.set(s, []);
      seriesMap.get(s)!.push(post);
    } else {
      standalone.push(post);
    }
  }

  const seriesOrder = ['goclaw', 'ai-agent-tools'];
  for (const key of seriesOrder) {
    const seriesPosts = seriesMap.get(key);
    if (seriesPosts) {
      seriesPosts.sort((a, b) => (a.data.seriesOrder ?? 99) - (b.data.seriesOrder ?? 99));
      groups.push({ series: key, posts: seriesPosts });
    }
  }

  if (standalone.length > 0) {
    groups.push({ series: null, posts: standalone });
  }

  return groups;
}

export function getSeriesPosts(allPosts: CollectionEntry<'blog'>[], series: string): CollectionEntry<'blog'>[] {
  return allPosts
    .filter((p) => p.data.series === series)
    .sort((a, b) => (a.data.seriesOrder ?? 99) - (b.data.seriesOrder ?? 99));
}
