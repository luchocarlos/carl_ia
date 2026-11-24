// import type { Core } from '@strapi/strapi';

// Punto de entrada de la aplicación Strapi: ganchos del ciclo de vida.
export default {
  /**
   * Función de registro (asíncrona) que se ejecuta antes de que
   * la aplicación se inicialice.
   *
   * Permite extender el código (registrar plugins, campos, etc.). Actualmente vacía.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * Función de arranque (asíncrona) que se ejecuta antes de que
   * la aplicación empiece a atender peticiones.
   *
   * Permite preparar el modelo de datos, lanzar tareas
   * o ejecutar lógica especial al iniciar. Actualmente vacía.
   */
  bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {},
};
