import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/*
 * Stamps the service worker with this build. The worker is copied from
 * public/ verbatim, so on its own it would never change between builds and a
 * tablet would never pick up a new version. Here it gets the build's file
 * list to keep offline from the first open, and a cache name that changes
 * with every build so the previous build's copies are cleared.
 */
function serviceWorkerBuild() {
  let outDir = 'dist';
  return {
    name: 'lloyds-service-worker-build',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const manifestPath = path.join(outDir, '.vite', 'manifest.json');
      const workerPath = path.join(outDir, 'service-worker.js');
      if (!existsSync(manifestPath) || !existsSync(workerPath)) return;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const files = new Set();
      Object.values(manifest).forEach((entry) => {
        if (entry.file) files.add(`/${entry.file}`);
        (entry.css || []).forEach((f) => files.add(`/${f}`));
        (entry.assets || []).forEach((f) => files.add(`/${f}`));
      });
      const list = Array.from(files).sort();
      const build = createHash('sha256').update(JSON.stringify(list)).digest('hex').slice(0, 12);
      const worker = readFileSync(workerPath, 'utf8')
        .replace("'__BUILD_ID__'", `'${build}'`)
        .replace('/* PRECACHE */[]', JSON.stringify(list));
      writeFileSync(workerPath, worker);
    }
  };
}

export default defineConfig({
  plugins: [react(), serviceWorkerBuild()],
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        // React in one file, the icon set in another, each screen in its own.
        // Fewer, better-shaped files for the service worker to keep.
        manualChunks: {
          react: ['react', 'react-dom'],
          icons: ['lucide-react']
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
});
