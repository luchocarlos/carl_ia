import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DAILY_LIMIT, STORAGE_KEYS } from '../config';
import { crearAlmacenamiento } from '../lib/storage';
import { claveDiaBogota, proximoReinicio } from '../lib/time';
import type { GlobalStatus, UsageResponse } from '../types';

// Estado y acciones del contador de consumo diario (cuota del usuario + cupo global).
interface UsageState {
  dia: string; // día al que corresponde el contador (YYYY-MM-DD en hora de Bogotá)
  usado: number; // puntos consumidos hoy
  limite: number; // puntos disponibles por día
  resetAt: string; // fecha ISO del próximo reinicio de la cuota
  globalPct: number; // porcentaje (0-100) del cupo global ocupado
  globalStatus: GlobalStatus; // estado del cupo global ('ok' | 'ocupado' | 'lleno')
  lastSync: number | null; // timestamp de la última actualización (local o desde el servidor)
  puedeGastar: (costo: number) => boolean; // indica si el costo cabe en lo que queda de cuota
  registrarConsumo: (costo: number) => void; // suma un consumo local (optimista)
  reiniciarSiCambioDia: (ahora?: Date) => void; // resetea el contador si ya es otro día
  reconciliar: (data: UsageResponse) => void; // sustituye los valores locales por los del servidor
  reiniciarTodo: () => void; // vuelve al estado inicial
}

// Valores iniciales del contador para el día actual.
function estadoInicial() {
  return {
    dia: claveDiaBogota(),
    usado: 0,
    limite: DAILY_LIMIT,
    resetAt: proximoReinicio().toISOString(), // próxima medianoche de Bogotá
    globalPct: 0,
    globalStatus: 'ok' as GlobalStatus,
    lastSync: null,
  };
}

// Store global de consumo, persistido en localStorage.
export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      ...estadoInicial(),

      // true si al sumar el costo no se supera el límite (los costos negativos cuentan como 0).
      puedeGastar: (costo) => {
        const { usado, limite } = get();
        return usado + Math.max(0, costo) <= limite;
      },

      // Registra un consumo, sin pasar nunca del límite.
      registrarConsumo: (costo) => {
        get().reiniciarSiCambioDia(); // primero asegura que el contador es del día actual
        const { usado, limite } = get();
        set({
          usado: Math.min(limite, usado + Math.max(0, costo)), // tope en el límite
          lastSync: Date.now(),
        });
      },

      // Si cambió el día (en Bogotá) reinicia todo; si no, solo garantiza que exista resetAt.
      reiniciarSiCambioDia: (ahora = new Date()) => {
        const dia = claveDiaBogota(ahora);
        if (get().dia !== dia) {
          set({
            ...estadoInicial(),
            dia,
            resetAt: proximoReinicio(ahora).toISOString(),
          });
          return;
        }

        if (!get().resetAt) {
          set({ resetAt: proximoReinicio(ahora).toISOString() }); // datos antiguos sin fecha de reinicio
        }
      },

      // El servidor es la fuente de verdad: se toman sus valores, saneados y acotados.
      reconciliar: (data) => {
        const ahora = new Date();
        set({
          dia: claveDiaBogota(ahora),
          usado: Math.max(0, Math.round(data.used)), // nunca negativo
          limite: data.limit > 0 ? Math.round(data.limit) : DAILY_LIMIT, // límite inválido => valor por defecto
          resetAt: data.resetAt || proximoReinicio(ahora).toISOString(),
          globalPct: Math.min(100, Math.max(0, Math.round(data.global?.pct ?? 0))), // acotado a 0-100
          globalStatus: data.global?.status ?? 'ok',
          lastSync: Date.now(),
        });
      },

      reiniciarTodo: () => set({ ...estadoInicial() }),
    }),
    {
      name: STORAGE_KEYS.usage, // clave en localStorage
      version: 1, // versión del esquema persistido
      storage: createJSONStorage(crearAlmacenamiento), // almacenamiento seguro con fallback
    },
  ),
);
