import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves a project site under /<repo-name>/. The deploy workflow passes
// that path in BASE_PATH (derived from the repository name), so nothing here is tied
// to the current name. Local dev and preview use the root.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    // MapLibre GL alone is ~1.1 MB minified (~295 KB gzipped). It already loads lazily in its
    // own chunk (see App.tsx), so only warn if a chunk grows beyond that.
    chunkSizeWarningLimit: 1150,
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
