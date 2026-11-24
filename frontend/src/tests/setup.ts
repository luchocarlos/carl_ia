// Configuración global de Vitest (se carga antes de cada archivo de test, ver vite.config.ts).
import { afterEach } from 'vitest';
import { useToastStore } from '../store/toastStore';

// Tras cada test se limpia el almacenamiento y los toasts para que los tests no se afecten entre sí.
afterEach(() => {
  localStorage.clear();
  useToastStore.getState().limpiar();
});
