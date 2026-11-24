// Configuración del panel de administración de Strapi.
// Todos los secretos se leen de variables de entorno (nunca se hardcodean).
export default ({ env }) => ({
  // Sirve el panel admin. En producción con poca RAM (512 MB) se desactiva con
  // SERVE_ADMIN=false: así no hay que compilarlo (el build del admin consume >1 GB).
  serveAdminPanel: env.bool('SERVE_ADMIN', true),
  // Autenticación de usuarios del panel admin (firma de los JWT).
  auth: {
    secret: env('ADMIN_JWT_SECRET'), // Secreto para firmar los JWT del admin
  },
  // Tokens de API generados desde el panel.
  apiToken: {
    salt: env('API_TOKEN_SALT'), // Salt para hashear los API tokens
  },
  // Tokens de transferencia de datos entre instancias (strapi transfer).
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  // Clave para cifrar secretos almacenados por Strapi.
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY'),
  },
  // Flags de funcionalidades del panel (encuestas NPS y promoción de la edición Enterprise).
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
