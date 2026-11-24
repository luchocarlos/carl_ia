import { STORAGE_KEYS } from '../config';
import { nuevoId } from './id';

const PATRON = /^[A-Za-z0-9-]{8,64}$/; // formato válido del id guardado (descarta valores manipulados)

/**
 * Identificador anónimo por navegador. Permite que el cupo diario
 * sea por persona y no por IP compartida. No contiene datos personales.
 */
export function usuarioAnonimo(): string {
  try {
    const guardado = localStorage.getItem(STORAGE_KEYS.user);
    if (guardado && PATRON.test(guardado)) return guardado; // reutiliza el id existente

    const id = nuevoId(); // primera visita (o id inválido): se genera uno nuevo
    localStorage.setItem(STORAGE_KEYS.user, id);
    return id;
  } catch {
    return 'anonimo-local'; // sin localStorage (modo privado): id compartido de respaldo
  }
}
