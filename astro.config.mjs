import { defineConfig, passthroughImageService } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

import svelte from '@astrojs/svelte';

export default defineConfig({
  output: 'server',

  image: {
    service: passthroughImageService(),
  },

  adapter: node({
    mode: 'standalone',
  }),

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['better-sqlite3'],
    },
  },

  integrations: [svelte()],
});
