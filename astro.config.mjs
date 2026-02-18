import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cdding.github.io',
  base: '/',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('googlea35dd1e81f26a54a'),
    }),
    starlight({
      title: 'CDDing',
      defaultLocale: 'root',
      locales: {
        root: { label: '한국어', lang: 'ko' },
      },
      social: {
        github: 'https://github.com/CDDing',
      },
      components: {
        Header: './src/components/Header.astro',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [],
    }),
  ],
});
