// Configuración del servidor HTTP de Strapi.
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'), // Escucha en todas las interfaces por defecto
  port: env.int('PORT', 1337), // Puerto (el hosting puede inyectarlo vía PORT)
  url: env('PUBLIC_URL', ''),  // URL pública del backend (necesaria detrás de proxy)
  proxy: env.bool('PROXY', true), // Confía en cabeceras X-Forwarded-* del proxy inverso
  app: {
    keys: env.array('APP_KEYS'), // Claves para firmar cookies de sesión
  },
});