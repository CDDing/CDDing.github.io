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
        Sidebar: './src/components/Sidebar.astro',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Vulkan',
          items: [
            {
              label: '명세 요약',
              autogenerate: { directory: 'vulkan/spec' },
            },
          ],
        },
        {
          label: 'CUDA',
          items: [
            {
              label: 'Programming Guide',
              autogenerate: { directory: 'cuda/programming' },
            },
          ],
        },
        {
          label: 'Articles',
          items: [
            {
              label: 'GPU Hardware & Software',
              autogenerate: { directory: 'articles/gpu-hw-sw' },
            },
          ],
        },
        {
          label: 'Notes',
          items: [
            { label: '전체 노트', link: '/notes/' },
          ],
        },
      ],
    }),
  ],
});
