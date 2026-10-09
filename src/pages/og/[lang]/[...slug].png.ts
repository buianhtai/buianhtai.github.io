import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getPostLang, getPostSlug } from '../../../lib/posts';
import { socialImagePng } from '../../../lib/social-image';

export async function getStaticPaths() {
  const posts = await getCollection('blog', post => !post.data.draft);
  return posts.map(post => ({
    params: {lang: getPostLang(post), slug: getPostSlug(post)},
    props: {
      title: post.data.title,
      category: post.data.category,
      description: post.data.description,
      lang: post.data.lang,
    },
  }));
}

export const GET: APIRoute = async ({props}) => new Response(
  await socialImagePng({
    title: String(props.title),
    label: String(props.category || 'ENGINEERING'),
    description: String(props.description || ''),
    lang: String(props.lang),
  }),
  {headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'}}
);
