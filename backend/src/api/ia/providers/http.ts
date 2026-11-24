// Utilidades HTTP comunes para hablar con los proveedores de IA.
import { ProveedorError, mapearStatus, mensajeDeError } from './errors';

// Tiempo máximo de espera por respuesta del proveedor (60 s).
const TIMEOUT_MS = 60_000;

// Subconjunto de opciones de fetch que usan los adaptadores.
export interface HttpInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

// Une baseURL y ruta evitando barras duplicadas o faltantes.
export function unirUrl(baseURL: string, path: string): string {
  return `${baseURL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

// Hace una petición y devuelve el JSON de respuesta, con timeout.
// Cualquier fallo (HTTP, red o timeout) se convierte en ProveedorError.
export async function pedirJson(url: string, init: HttpInit, provider: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS); // Cancela la petición si excede el timeout

  try {
    const res = await fetch(url, { ...init, signal: controller.signal }); // Llamada externa al proveedor
    const texto = await res.text();

    // Intenta parsear JSON; si no lo es, guarda el texto crudo.
    let data: any = null;
    if (texto) {
      try {
        data = JSON.parse(texto);
      } catch {
        data = { raw: texto };
      }
    }

    // Respuesta HTTP de error: se extrae el mensaje y se mapea el estado.
    if (!res.ok) {
      const mensaje = mensajeDeError(data) || `El proveedor respondió ${res.status}`;
      throw new ProveedorError(mensaje, mapearStatus(res.status), provider, data);
    }

    return data;
  } catch (error: any) {
    if (error instanceof ProveedorError) throw error; // Ya viene tipado: se propaga tal cual

    if (error?.name === 'AbortError') {
      throw new ProveedorError('El proveedor tardó demasiado en responder', 504, provider); // Timeout
    }

    throw new ProveedorError('No se pudo conectar con el proveedor', 502, provider); // Error de red / DNS
  } finally {
    clearTimeout(timer); // Siempre limpia el temporizador
  }
}
