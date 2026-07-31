// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import d2 from 'astro-d2';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://buianhtai.github.io',

  integrations: [
    d2({
      sketch: false,
      pad: 20,
    }),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en-US',
          vi: 'vi-VN',
        },
       },
    }),
    icon({
      include: {
        'lucide': ['*'],
        'logos': ['kafka'],
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'vi'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },

  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});
