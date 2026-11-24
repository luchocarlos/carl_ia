// Modo de trabajo: chat sobre código ('text') o generación de documentación ('document').
export type Mode = 'text' | 'document';

// Autor de un mensaje.
export type Role = 'user' | 'assistant';

// Ciclo de vida de un mensaje: recibiendo, completo, fallido o detenido por el usuario.
export type MessageStatus = 'streaming' | 'done' | 'error' | 'stopped';

// Estado del cupo global compartido entre todos los usuarios.
export type GlobalStatus = 'ok' | 'ocupado' | 'lleno';

// Mensaje individual de una conversación.
export interface ChatMessage {
  id: string;
  role: Role;
  mode: Mode; // modo con el que se envió/generó
  content: string; // texto en Markdown
  createdAt: number; // timestamp en ms
  status: MessageStatus;
  error?: string; // texto del error si status === 'error'
}

// Conversación completa guardada en el historial.
export interface Chat {
  id: string;
  title: string; // se genera a partir del primer mensaje del usuario
  mode: Mode; // modo del último mensaje
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number; // última actividad
}

// Ocupación del cupo global.
export interface GlobalUsage {
  pct: number; // porcentaje 0-100
  status: GlobalStatus;
}

// Respuesta de GET /api/usage.
export interface UsageResponse {
  used: number; // puntos consumidos hoy por el usuario
  limit: number; // límite diario del usuario
  resetAt: string; // fecha ISO del próximo reinicio
  global: GlobalUsage;
}

// Mensaje tal como se envía al backend (sin metadatos locales).
export interface ChatRequestMessage {
  role: Role;
  content: string;
}

// Opciones de una solicitud de chat en streaming.
export interface ChatStreamOptions {
  signal?: AbortSignal; // para cancelar la petición
  onDelta: (delta: string) => void; // se llama con cada fragmento de texto recibido
}

// Contrato común de los clientes de IA (HttpClient real y MockClient de demostración).
export interface AiClient {
  chat(mode: Mode, messages: ChatRequestMessage[], options: ChatStreamOptions): Promise<void>;
  usage(): Promise<UsageResponse>;
}

// Cuerpo de error que devuelve el backend cuando se agota una cuota (HTTP 429).
export interface ApiErrorBody {
  error: 'quota_user' | 'quota_global';
  resetAt?: string;
}
