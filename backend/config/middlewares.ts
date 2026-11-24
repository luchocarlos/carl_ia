// Orígenes extra permitidos por CORS, tomados de FRONTEND_URL (lista separada por comas).
// Ej.: FRONTEND_URL="https://app.ejemplo.com,https://otro.ejemplo.com"
const origenes = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origen) => origen.trim()) // Quita espacios alrededor de cada URL
  .filter(Boolean); // Descarta entradas vacías

// Pila de middlewares de Strapi (el orden importa: se ejecutan de arriba hacia abajo).
export default [
  'strapi::errors',
  // Cabeceras de seguridad (helmet); CSP y COEP desactivados para no bloquear al frontend.
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    },
  },
  // CORS: orígenes locales de desarrollo (Vite dev/preview, puerto 3000) + los de FRONTEND_URL.
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4173',
        'http://127.0.0.1:4173',
        'http://localhost:3000',
        ...origenes,
      ],
      headers: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Carl-User'], // Cabeceras permitidas (incluye las propias de la app)
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      keepHeaderOnError: true, // Mantiene cabeceras CORS también en respuestas de error
    },
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body', // Parseo del cuerpo de las peticiones (JSON, formularios)
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
