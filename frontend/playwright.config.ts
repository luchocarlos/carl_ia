import { defineConfig, devices } from '@playwright/test';

// Configuración de las pruebas end-to-end con Playwright.
export default defineConfig({
  testDir: './e2e', // carpeta de los tests e2e
  timeout: 30_000, // tiempo máximo por test
  expect: { timeout: 10_000 }, // espera máxima por defecto de cada expect
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173', // permite usar page.goto('/')
    trace: 'on-first-retry', // guarda traza solo al reintentar un test fallido
  },
  // Levanta el servidor de desarrollo antes de ejecutar los tests
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI, // en local reutiliza un servidor ya abierto; en CI siempre arranca uno
    timeout: 120_000,
    // Las pruebas usan MockClient aunque el .env local apunte al backend.
    env: { VITE_API_BASE_URL: '' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }, // solo se prueba en Chrome de escritorio
    },
  ],
});
