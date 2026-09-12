import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function adminHtmlFallbackPlugin() {
  return {
    name: 'admin-html-fallback',
    configureServer(server: any) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        const parsedUrl = new URL(req.url || '/', 'http://localhost');
        const pathname = parsedUrl.pathname;

        // Never serve index.html (Customer app) on admin portal (5175)
        if (pathname === '/index.html' || pathname === '/') {
          req.url = '/admin.html' + (parsedUrl.search || '');
          return next();
        }

        // Pass through assets, modules, APIs, and websockets
        if (
          pathname.startsWith('/api') ||
          pathname.startsWith('/socket.io') ||
          pathname.startsWith('/@') ||
          pathname.startsWith('/src') ||
          pathname.startsWith('/node_modules') ||
          pathname.startsWith('/assets') ||
          pathname.endsWith('.ts') ||
          pathname.endsWith('.tsx') ||
          pathname.endsWith('.js') ||
          pathname.endsWith('.jsx') ||
          pathname.endsWith('.css') ||
          pathname.endsWith('.svg') ||
          pathname.endsWith('.png') ||
          pathname.endsWith('.jpg') ||
          pathname.endsWith('.jpeg') ||
          pathname.endsWith('.ico') ||
          pathname.endsWith('.woff') ||
          pathname.endsWith('.woff2') ||
          pathname.endsWith('.ttf') ||
          pathname.endsWith('.json')
        ) {
          return next();
        }

        // Rewrite all navigation requests to admin.html
        req.url = '/admin.html' + (parsedUrl.search || '');
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
    allowedHosts: true,
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
