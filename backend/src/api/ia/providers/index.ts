// Punto de acceso al catálogo de proveedores y a sus adaptadores.
import catalogoJson from '../data/models.json';
import { ProveedorError } from './errors';
import { google } from './google';
import { openaiCompatible } from './openai-compatible';
import type { Catalogo, ProviderAdapter, ProviderConfig } from './types';

// Catálogo de proveedores cargado desde data/models.json.
const catalogo = catalogoJson as unknown as Catalogo;

// Devuelve el catálogo completo.
export function obtenerCatalogo(): Catalogo {
  return catalogo;
}

// Busca un proveedor por su ID (undefined si no existe).
export function obtenerProveedor(id: string): ProviderConfig | undefined {
  return catalogo.providers[id];
}

// Lista los proveedores del catálogo con su estado (configurado / disponible) para el frontend.
export function listarProveedoresCatalogo() {
  return Object.entries(catalogo.providers).map(([id, config]) => {
    const configurado = !config.envKey || Boolean(process.env[config.envKey]?.trim()); // No requiere key o la key está definida
    return {
      id,
      name: config.name,
      api: config.api,
      free: Boolean(config.free),
      configurado,
      disponible: configurado && !config.soloEnOpenCode, // Usable desde esta API
      modeloPorDefecto: config.defaultModel ?? null,
      modelosGratis: config.freeModels?.length ?? 0,
      ...(config.note ? { nota: config.note } : {}), // Solo incluye la nota si existe
    };
  });
}

// Lee la API key del proveedor desde el entorno (undefined si no hay o está vacía).
export function obtenerApiKey(config: ProviderConfig): string | undefined {
  if (!config.envKey) return undefined;
  const valor = process.env[config.envKey];
  return valor && valor.trim() ? valor.trim() : undefined;
}

// Devuelve el adaptador correspondiente a la familia de API del proveedor.
export function obtenerAdaptador(api: ProviderConfig['api']): ProviderAdapter {
  if (api === 'openai') return openaiCompatible;
  if (api === 'google') return google;
  throw new ProveedorError(`Familia de API no soportada: ${api}`, 500, 'config'); // Error de configuración del catálogo
}
