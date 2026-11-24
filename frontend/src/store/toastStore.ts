import { create } from 'zustand';
import { nuevoId } from '../lib/id';

// Variante visual del aviso (define color/icono).
export type TonoToast = 'error' | 'info' | 'exito';

// Botón de acción opcional dentro del toast (p. ej. "Reintentar").
export interface AccionToast {
  etiqueta: string; // texto del botón
  onClick: () => void; // acción al pulsarlo
}

// Notificación emergente que se muestra al usuario.
export interface Toast {
  id: string; // identificador único (para quitarlo)
  tono: TonoToast;
  mensaje: string; // texto visible
  accion?: AccionToast;
}

// Estado y acciones del store de notificaciones.
interface ToastState {
  toasts: Toast[]; // toasts visibles actualmente
  agregar: (toast: Omit<Toast, 'id'>) => string; // muestra un toast y devuelve su id
  quitar: (id: string) => void; // cierra un toast concreto
  limpiar: () => void; // cierra todos
}

// Store global de toasts (no persistido).
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  // Añade un toast; solo se conservan los 3 más recientes.
  agregar: (toast) => {
    const id = nuevoId();
    set((estado) => ({ toasts: [...estado.toasts, { ...toast, id }].slice(-3) })); // máximo 3 en pantalla
    return id;
  },
  quitar: (id) => set((estado) => ({ toasts: estado.toasts.filter((t) => t.id !== id) })),
  limpiar: () => set({ toasts: [] }),
}));
