import type { APIRoute } from 'astro';
import { socialImagePng } from '../../lib/social-image';

export const GET: APIRoute = async () => new Response(
  await socialImagePng({
    title: 'Building systems. Sharing what I learn.',
    label: 'TAI BUI · ENGINEERING NOTES',
    description: 'AI agents, distributed systems, databases and software architecture.',
  }),
  {headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'}}
);
