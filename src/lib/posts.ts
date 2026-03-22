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
