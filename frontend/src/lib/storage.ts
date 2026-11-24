import type { StateStorage } from 'zustand/middleware';
import { useToastStore } from '../store/toastStore';

let avisoMostrado = false; // evita repetir el aviso de almacenamiento lleno en cada guardado

/** localStorage con try/catch para cuotas y modo privado. Nunca lanza errores hacia los stores. */
const almacenamientoSeguro: StateStorage = {
  // Lee un valor; si localStorage no está disponible devuelve null (estado vacío).
  getItem: (nombre) => {
    try {
      return localStorage.getItem(nombre);
    } catch {
      return null;
    }
  },
  // Guarda un valor; si falla (cuota excedida) avisa al usuario una sola vez.
  setItem: (nombre, valor) => {
    try {
      localStorage.setItem(nombre, valor);
    } catch {
      if (!avisoMostrado) {
        avisoMostrado = true;
        useToastStore.getState().agregar({
          tono: 'error',
          mensaje: 'No se pudo guardar el historial: el almacenamiento está lleno.',
        });
      }
    }
  },
  // Elimina un valor ignorando errores.
  removeItem: (nombre) => {
    try {
      localStorage.removeItem(nombre);
    } catch {
      /* sin almacenamiento disponible */
    }
  },
};

// Fábrica que espera createJSONStorage de zustand para obtener el almacenamiento.
export function crearAlmacenamiento() {
  return almacenamientoSeguro;
}
