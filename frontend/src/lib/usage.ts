// Estado visual del consumo diario: disponible, casi al límite o agotado.
export type EstadoConsumo = 'ok' | 'busy' | 'full';

/** Calcula el estado visual del consumo: 'busy' desde el 80 %, 'full' al 100 %. */
export function estadoDeConsumo(usado: number, limite: number): EstadoConsumo {
  if (limite <= 0) return 'full'; // sin límite válido se considera agotado
  const porcentaje = usado / limite;
  if (porcentaje >= 1) return 'full';
  if (porcentaje >= 0.8) return 'busy';
  return 'ok';
}

/** Porcentaje acotado entre 0 y 100. */
export function porcentajeConsumo(usado: number, limite: number): number {
  if (limite <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((usado / limite) * 100)));
}

/** Color de la barra de consumo (clase de Tailwind). */
export function colorDeConsumo(estado: EstadoConsumo): string {
  if (estado === 'full') return 'bg-red-400';
  if (estado === 'busy') return 'bg-amber-400';
  return 'bg-emerald-400';
}

/** Etiqueta del estado de consumo. */
export function etiquetaDeConsumo(estado: EstadoConsumo): string {
  if (estado === 'full') return 'Límite alcanzado';
  if (estado === 'busy') return 'Casi al límite';
  return 'Disponible';
}
