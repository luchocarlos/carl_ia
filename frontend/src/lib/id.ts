/** Genera un identificador local. Usa crypto.randomUUID si existe; si no, un id basado en fecha + aleatorio. */
export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; // fallback para navegadores/contextos sin randomUUID
}
