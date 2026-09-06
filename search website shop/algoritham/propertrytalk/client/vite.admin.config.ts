import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function adminHtmlFallbackPlugin() {
  return {
    name: 'admin-html-fallback',
    configureServer(server: any) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        const url = req.url || '';
        // Pass through assets, modules, APIs, and websockets
        if (
          url.startsWith('/api') ||
          url.startsWith('/socket.io') ||
          url.startsWith('/@') ||
          url.startsWith('/src') ||
          url.startsWith('/node_modules') ||
          url.includes('.')
        ) {
          return next();
        }
        // Rewrite navigation requests to admin.html
        req.url = '/admin.html';
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), adminHtmlFallbackPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
});
