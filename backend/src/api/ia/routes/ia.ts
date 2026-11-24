// Rutas personalizadas de la API de IA (Strapi les antepone el prefijo /api).
// Todas son públicas a nivel de Strapi (auth: false); la protección opcional con
// X-API-Key se hace dentro del controlador "ia".
export default {
  routes: [
    // Diagnóstico público: versión desplegada y estado de configuración.
    {
      method: 'GET',
      path: '/ia/estado',
      handler: 'ia.estado',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Lista de proveedores del catálogo y si tienen credenciales.
    {
      method: 'GET',
      path: '/ia/proveedores',
      handler: 'ia.proveedores',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Modelos disponibles de un proveedor (?provider=...&free=...).
    {
      method: 'GET',
      path: '/ia/models',
      handler: 'ia.modelos',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Chat genérico (respuesta JSON completa).
    {
      method: 'POST',
      path: '/ia/chat',
      handler: 'ia.chat',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Chat del frontend de Carl: respuesta en streaming (SSE) con control de cupo.
    {
      method: 'POST',
      path: '/chat',
      handler: 'contrato.chat',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Consumo diario del usuario y estado del cupo global.
    {
      method: 'GET',
      path: '/usage',
      handler: 'contrato.uso',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
