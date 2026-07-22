import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cdding.github.io',
  base: '/',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('googlea35dd1e81f26a54a'),
    }),
  ],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
