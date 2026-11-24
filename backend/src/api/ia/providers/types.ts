// Tipos compartidos por todos los proveedores de IA (catálogo, mensajes, resultados y adaptadores).

// Familia de API que habla el proveedor: compatible con OpenAI o la API nativa de Google (Gemini).
export type ApiFamily = 'openai' | 'google';

// Rol de cada mensaje dentro de una conversación de chat.
export type ChatRole = 'system' | 'user' | 'assistant';

// Mensaje individual de la conversación.
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// Configuración de un proveedor tal como aparece en data/models.json.
export interface ProviderConfig {
  name: string; // Nombre legible del proveedor
  api: ApiFamily; // Qué adaptador usar
  baseURL: string; // URL base de la API del proveedor
  envKey?: string | null; // Variable de entorno con la API key (null = no requiere key)
  free?: boolean; // Indica si el proveedor tiene uso gratuito
  note?: string; // Nota informativa para mostrar al usuario
  headers?: Record<string, string>; // Cabeceras extra que exige el proveedor
  /** Modelo sugerido cuando no se envía uno. */
  defaultModel?: string;
  /** Modelos gratuitos conocidos del proveedor. */
  freeModels?: string[];
  /** No se puede usar fuera de OpenCode. */
  soloEnOpenCode?: boolean;
}

// Opciones de una petición de chat ya normalizada.
export interface ChatOptions {
  provider: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

// Registro de un proveedor que falló durante el fallback automático.
export interface FallbackInfo {
  provider: string;
  status: number; // Estado HTTP (ya mapeado) del fallo
  error: string; // Mensaje de error del fallo
}

// Respuesta normalizada de un chat, independiente del proveedor.
export interface ChatResult {
  provider: string;
  model: string;
  content: string; // Texto generado por el modelo
  usage?: Record<string, unknown> | null; // Consumo de tokens reportado por el proveedor
  /** Proveedores que fallaron antes del exitoso. */
  fallbacks?: FallbackInfo[];
}

// Información básica de un modelo disponible.
export interface ModelInfo {
  id: string;
  name?: string;
  provider?: string;
  free?: boolean;
}

// Contrato que implementa cada adaptador de proveedor (openai-compatible, google).
export interface ProviderAdapter {
  chat(config: ProviderConfig, options: ChatOptions, apiKey?: string): Promise<ChatResult>; // Envía la conversación y devuelve la respuesta
  listModels(config: ProviderConfig, apiKey?: string): Promise<ModelInfo[]>; // Lista los modelos del proveedor
}

// Estructura completa del catálogo de proveedores (models.json).
export interface Catalogo {
  defaultProvider: string; // Proveedor usado cuando el cliente no indica ninguno
  providers: Record<string, ProviderConfig>; // Proveedores indexados por ID
}
