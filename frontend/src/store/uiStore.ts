import { create } from 'zustand';
import type { Mode } from '../types';

// Estado de la conexión con el backend, mostrado en el indicador de la interfaz.
export type Conexion = 'desconocido' | 'conectado' | 'sin-conexion';

// Estado de la interfaz (no persistido): modo, borrador, sidebar, modales y conexión.
interface UiState {
  modo: Mode; // modo seleccionado en el compositor (texto / documento)
  borrador: string; // texto que el usuario está escribiendo
  focoToken: number; // contador: cada incremento indica al input que debe tomar el foco
  sidebarMovil: boolean; // sidebar abierto en pantallas pequeñas
  sidebarColapsado: boolean; // sidebar contraído en escritorio
  confirmarBorrado: boolean; // modal de confirmación de borrado de historial visible
  conexion: Conexion; // último estado conocido de la conexión
  setModo: (modo: Mode) => void;
  setBorrador: (borrador: string) => void;
  setConexion: (conexion: Conexion) => void;
  pedirFoco: () => void; // solicita foco en el compositor
  abrirSidebar: () => void;
  cerrarSidebar: () => void;
  alternarSidebar: () => void; // abre/cierra el sidebar móvil
  alternarColapso: () => void; // colapsa/expande el sidebar de escritorio
  abrirConfirmacion: () => void;
  cerrarConfirmacion: () => void;
}

// Store global de UI.
export const useUiStore = create<UiState>((set) => ({
  modo: 'text', // por defecto se inicia en modo texto
  borrador: '',
  focoToken: 0,
  sidebarMovil: false,
  sidebarColapsado: false,
  confirmarBorrado: false,
  conexion: 'desconocido', // aún no se ha consultado al backend
  setModo: (modo) => set({ modo }),
  setBorrador: (borrador) => set({ borrador }),
  setConexion: (conexion) => set({ conexion }),
  pedirFoco: () => set((estado) => ({ focoToken: estado.focoToken + 1 })), // cambiar el número dispara el efecto de foco
  abrirSidebar: () => set({ sidebarMovil: true }),
  cerrarSidebar: () => set({ sidebarMovil: false }),
  alternarSidebar: () => set((estado) => ({ sidebarMovil: !estado.sidebarMovil })),
  alternarColapso: () => set((estado) => ({ sidebarColapsado: !estado.sidebarColapsado })),
  abrirConfirmacion: () => set({ confirmarBorrado: true }),
  cerrarConfirmacion: () => set({ confirmarBorrado: false }),
}));
