import { defineCollection, z } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { glob } from 'astro/loaders';

const notesSchema = z.object({
  title: z.string(),
  lastUpdated: z.coerce.date(),
  tags: z.array(z.string()),
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  notes: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
    schema: notesSchema,
  }),
};
