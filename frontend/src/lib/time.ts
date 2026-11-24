import { TIMEZONE } from '../config';

/** Bogotá es UTC-5 todo el año (sin horario de verano). */
const OFFSET_BOGOTA_HORAS = 5;

/** Devuelve el día calendario en Bogotá: YYYY-MM-DD. */
export function claveDiaBogota(fecha: Date = new Date()): string {
  // El locale 'en-CA' da las partes en orden año-mes-día con dos dígitos
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);

  // Obtiene el valor de una parte concreta (year, month, day)
  const valor = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';

  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

/** Próxima medianoche en Bogotá, como instante UTC. */
export function proximoReinicio(fecha: Date = new Date()): Date {
  const [anio, mes, dia] = claveDiaBogota(fecha).split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + 1, OFFSET_BOGOTA_HORAS, 0, 0)); // día siguiente a las 00:00 Bogotá = 05:00 UTC
}

/** Hora local de Bogotá en formato HH:mm. */
export function formatearHoraReinicio(fecha: Date = proximoReinicio()): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // formato 24 h
  }).format(fecha);
}

/** Texto legible del reinicio, p. ej. "Se reinicia a las 00:00 (Bogotá)". */
export function textoReinicio(fecha: Date = proximoReinicio()): string {
  return `Se reinicia a las ${formatearHoraReinicio(fecha)} (Bogotá)`;
}
