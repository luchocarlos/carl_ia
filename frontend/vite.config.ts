import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * La CSP estricta vive en index.html para producción.
 * En desarrollo se retira: React Refresh inyecta scripts inline
 * y el HMR necesita un WebSocket.
 */
function cspSoloProduccion() {
  return {
    name: 'csp-solo-produccion',
    apply: 'serve' as const, // solo se aplica con el servidor de desarrollo, no en el build
    transformIndexHtml(html: string) {
      // Elimina la etiqueta <meta http-equiv="Content-Security-Policy" ... /> del HTML servido
      return html.replace(
        /\s*<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
        '',
      );
    },
  };
}

// Configuración de Vite (build/dev) y Vitest (tests unitarios).
export default defineConfig({
  plugins: [react(), cspSoloProduccion()],
  base: '/', // ruta pública base de la app
  build: {
    outDir: 'dist',
    sourcemap: false, // no publica mapas de código fuente
    rollupOptions: {
      output: {
        // Divide las dependencias en chunks separados para mejorar la caché del navegador
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined; // el código propio queda en el chunk principal
          // Renderizado de Markdown y resaltado de código
          if (
            id.includes('react-markdown') ||
            id.includes('remark-') ||
            id.includes('rehype-') ||
            id.includes('highlight.js') ||
            id.includes('lowlight') ||
            id.includes('micromark') ||
            id.includes('hast') ||
            id.includes('mdast') ||
            id.includes('unist')
          ) {
            return 'markdown';
          }
          // Animaciones
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
            return 'motion';
          }
          // Núcleo de React
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom', // simula el DOM y localStorage del navegador
    globals: true, // describe/it/expect disponibles sin importar
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'], // limpieza común tras cada test
    restoreMocks: true, // restaura los mocks entre tests
  },
});
