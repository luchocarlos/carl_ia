/** Une clases ignorando valores falsos. Útil para clases condicionales: cn('a', activo && 'b'). */
export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(' ');
}
