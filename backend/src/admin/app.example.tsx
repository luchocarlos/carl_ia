import type { StrapiApp } from '@strapi/strapi/admin';

// Ejemplo de personalización del panel admin (renombrar a app.tsx para activarlo).
export default {
  config: {
    // Idiomas adicionales disponibles en el panel (descomentar los necesarios).
    locales: [
      // 'ar',
      // 'fr',
      // 'cs',
      // 'de',
      // 'dk',
      // 'es',
      // 'he',
      // 'id',
      // 'it',
      // 'ja',
      // 'ko',
      // 'ms',
      // 'nl',
      // 'no',
      // 'pl',
      // 'pt-BR',
      // 'pt',
      // 'ru',
      // 'sk',
      // 'sv',
      // 'th',
      // 'tr',
      // 'uk',
      // 'vi',
      // 'zh-Hans',
      // 'zh',
    ],
  },
  // Se ejecuta al arrancar el panel admin; aquí solo muestra la instancia en consola.
  bootstrap(app: StrapiApp) {
    console.log(app);
  },
};
