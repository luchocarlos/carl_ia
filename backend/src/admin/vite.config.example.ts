import { mergeConfig, type UserConfig } from 'vite';

// Ejemplo de personalización de Vite para el panel admin (renombrar a vite.config.ts para activarlo).
export default (config: UserConfig) => {
  // Importante: siempre devolver la configuración modificada
  return mergeConfig(config, {
    resolve: {
      alias: {
        '@': '/src', // Alias para importar desde la carpeta src del admin
      },
    },
  });
};
