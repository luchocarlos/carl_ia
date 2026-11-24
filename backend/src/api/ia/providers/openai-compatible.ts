// Adaptador para proveedores con API compatible con OpenAI (/chat/completions, /models).
import { ProveedorError } from './errors';
import { pedirJson, unirUrl } from './http';
import type {
  ChatOptions,
  ChatResult,
  ModelInfo,
  ProviderAdapter,
  ProviderConfig,
} from './types';

// Sustituye marcadores "{env:NOMBRE}" por el valor de la variable de entorno correspondiente.
function resolverValor(valor: string): string {
  return valor.replace(/\{env:([A-Z0-9_]+)\}/g, (_, nombre) => process.env[nombre] ?? '');
}

// Construye las cabeceras: JSON, autenticación Bearer y cabeceras extra definidas en el catálogo.
function cabeceras(config: ProviderConfig, apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), // Solo si el proveedor usa key
  };

  // Cabeceras propias del proveedor; se omiten las que quedan vacías tras resolver variables.
  for (const [clave, valor] of Object.entries(config.headers ?? {})) {
    const resuelto = resolverValor(valor).trim();
    if (resuelto) headers[clave] = resuelto;
  }

  return headers;
}

// Extrae el texto de la respuesta: puede venir como string o como arreglo de partes.
function extraerTexto(contenido: unknown): string {
  if (typeof contenido === 'string') return contenido;

  // Formato por partes: se concatenan los textos.
  if (Array.isArray(contenido)) {
    return contenido
      .map((parte) => {
        if (typeof parte === 'string') return parte;
        if (parte && typeof parte === 'object' && typeof (parte as any).text === 'string') {
          return (parte as any).text;
        }
        return '';
      })
      .join('');
  }

  return '';
}

// Implementación de ProviderAdapter para APIs estilo OpenAI (OpenRouter, Groq, etc.).
export const openaiCompatible: ProviderAdapter = {
  // Chat compatible con OpenAI: envía la conversación a /chat/completions.
  async chat(config, options: ChatOptions, apiKey): Promise<ChatResult> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages,
      stream: false, // Respuesta completa, sin streaming
    };

    // Parámetros opcionales (solo si se indicaron).
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

    // Llamada externa al proveedor.
    const data = await pedirJson(
      unirUrl(config.baseURL, '/chat/completions'),
      {
        method: 'POST',
        headers: cabeceras(config, apiKey),
        body: JSON.stringify(body),
      },
      options.provider,
    );

    // Texto de la primera opción; vacío se considera error.
    const content = extraerTexto(data?.choices?.[0]?.message?.content);
    if (!content) {
      throw new ProveedorError('El proveedor no devolvió contenido', 502, options.provider, data);
    }

    // Resultado normalizado.
    return {
      provider: options.provider,
      model: typeof data?.model === 'string' ? data.model : options.model, // Modelo real usado (si el proveedor lo informa)
      content,
      usage: (data?.usage as Record<string, unknown>) ?? null,
    };
  },

  // Lista los modelos del proveedor y marca como gratis los de precio 0.
  async listModels(config, apiKey): Promise<ModelInfo[]> {
    // Llamada externa al listado de modelos.
    const data = await pedirJson(
      unirUrl(config.baseURL, '/models'),
      { method: 'GET', headers: cabeceras(config, apiKey) },
      config.name,
    );

    const lista = Array.isArray(data?.data) ? data.data : [];
    return lista
      .map((modelo: any) => {
        // Precios por token (formato OpenRouter); gratis si prompt y completion valen 0.
        const prompt = Number(modelo?.pricing?.prompt);
        const completion = Number(modelo?.pricing?.completion);
        const gratis =
          Number.isFinite(prompt) && Number.isFinite(completion) && prompt === 0 && completion === 0;

        return {
          id: String(modelo?.id ?? ''),
          name: typeof modelo?.name === 'string' ? modelo.name : undefined,
          free: gratis ? true : undefined,
        };
      })
      .filter((modelo) => modelo.id); // Descarta entradas sin ID
  },
};
