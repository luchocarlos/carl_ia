// Configuración global de la API REST de Strapi.
export default {
  rest: {
    defaultLimit: 25, // Registros por página si el cliente no indica límite
    maxLimit: 100, // Máximo de registros que se pueden pedir por página
    withCount: true, // Incluye el total de registros en la paginación
  },
};
