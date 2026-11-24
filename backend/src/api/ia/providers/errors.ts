// Error tipado para fallos de proveedores de IA.
// Lleva el estado HTTP que se devolverá al cliente y el proveedor que falló.
export class ProveedorError extends Error {
  status: number; // Estado HTTP a devolver al cliente
  provider: string; // ID del proveedor que originó el error
  details?: unknown; // Cuerpo original de la respuesta del proveedor (para depurar)

  constructor(message: string, status: number, provider: string, details?: unknown) {
    super(message);
    this.name = 'ProveedorError';
    this.status = status;
    this.provider = provider;
    this.details = details;
  }
}

// Extrae el mensaje de error del cuerpo de respuesta de un proveedor.
// Cada proveedor usa un formato distinto, así que se prueban los campos más comunes.
export function mensajeDeError(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined; // Sin cuerpo JSON utilizable
  const cuerpo = data as any;

  if (typeof cuerpo.error?.message === 'string') return cuerpo.error.message; // Formato OpenAI / Google
  if (typeof cuerpo.message === 'string') return cuerpo.message;
  if (typeof cuerpo.error === 'string') return cuerpo.error;
  if (typeof cuerpo.detail === 'string') return cuerpo.detail; // Formato estilo FastAPI

  return undefined;
}

// Traduce el estado HTTP del proveedor externo al estado que verá nuestro cliente.
export function mapearStatus(status: number): number {
  if (status === 400 || status === 404 || status === 422) return 400; // Petición inválida (modelo inexistente, parámetros)
  if (status === 401 || status === 403) return 503; // Key inválida: problema de configuración del servidor, no del cliente
  if (status === 429) return 429; // Límite de uso / cuota agotada
  return 502; // Cualquier otro fallo del proveedor
}
