// Configuración de la base de datos.
// Usa SQLite; si no se define DATABASE_FILENAME la BD vive solo en memoria
// (los datos se pierden al reiniciar).
export default () => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: process.env.DATABASE_FILENAME || ':memory:', // Archivo SQLite o BD en memoria
    },
    useNullAsDefault: true, // Requerido por knex con SQLite para valores por defecto
  },
});