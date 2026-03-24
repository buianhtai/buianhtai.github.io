import type { CollectionEntry } from 'astro:content';
import seriesData from '../content/series.json';

type SeriesEntry = {
  id: string;
  title: string;
  description: string;
  lang: string;
  link: string | null;
};

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

export const seriesMeta: Record<string, SeriesEntry> = Object.fromEntries(
  (seriesData as SeriesEntry[]).map((series) => [series.id, series])
);

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

  const seriesOrder = (seriesData as SeriesEntry[]).map((series) => series.id);
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
