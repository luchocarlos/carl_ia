import { usuarioAnonimo } from '../lib/user';
import type {
  AiClient,
  ChatRequestMessage,
  ChatStreamOptions,
  Mode,
  UsageResponse,
} from '../types';

// Error de la API con el código HTTP y, si aplica, el tipo de cuota agotada y su hora de reinicio.
export class ApiError extends Error {
  status: number; // código HTTP (o 502 si el error llegó dentro del stream)
  code?: 'quota_user' | 'quota_global'; // tipo de cuota excedida (solo en errores 429)
  resetAt?: string; // fecha ISO en que se libera la cuota

  constructor(
    mensaje: string,
    status: number,
    code?: 'quota_user' | 'quota_global',
    resetAt?: string,
  ) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.resetAt = resetAt;
  }
}

// Resultado de interpretar un evento SSE: texto recibido y/o error remoto.
interface Evento {
  delta: string;
  error?: ApiError;
}

/**
 * Cliente HTTP. Ninguna clave vive en el frontend.
 * Habla con el backend propio, que es quien llama al proveedor de IA.
 * El usuario se identifica con un id anónimo enviado en la cabecera X-Carl-User.
 */
export class HttpClient implements AiClient {
  private readonly base: string; // URL base del backend, sin barra final

  constructor(base: string) {
    this.base = base.replace(/\/+$/, ''); // quita barras finales para concatenar rutas sin duplicarlas
  }

  // Construye la URL absoluta de un endpoint.
  private url(ruta: string): string {
    return `${this.base}${ruta}`;
  }

  // Cabeceras comunes (id anónimo del usuario) más las específicas de cada petición.
  private cabeceras(extra: Record<string, string> = {}): Record<string, string> {
    return { 'X-Carl-User': usuarioAnonimo(), ...extra };
  }

  // Envía la conversación y procesa la respuesta en streaming (Server-Sent Events), llamando onDelta por cada fragmento.
  async chat(
    mode: Mode,
    messages: ChatRequestMessage[],
    { signal, onDelta }: ChatStreamOptions,
  ): Promise<void> {
    // --- 1. Petición POST /api/chat esperando un stream SSE ---
    const respuesta = await fetch(this.url('/api/chat'), {
      method: 'POST',
      headers: this.cabeceras({
        'Content-Type': 'application/json',
        Accept: 'text/event-stream', // pide respuesta en streaming
      }),
      body: JSON.stringify({
        mode,
        messages: messages.map(({ role, content }) => ({ role, content })), // solo los campos que necesita el backend
      }),
      signal, // permite cancelar (botón detener o timeout)
    });

    if (!respuesta.ok) throw await this.errorDe(respuesta); // errores HTTP (429, 500…)
    if (!respuesta.body) throw new ApiError('El servidor no devolvió streaming', 502);

    // --- 2. Lectura incremental del cuerpo ---
    const lector = respuesta.body.getReader();
    const decodificador = new TextDecoder();
    let buffer = ''; // texto pendiente de un evento aún incompleto
    let errorRemoto: ApiError | null = null; // error enviado por el servidor dentro del stream

    // Procesa un evento SSE completo: emite el texto o guarda el error.
    const consumir = (evento: string) => {
      const { delta, error } = this.eventoDe(evento);
      if (error) {
        errorRemoto = error;
        return;
      }
      if (delta) onDelta(delta);
    };

    // Los eventos SSE se separan con una línea en blanco ("\n\n"); el último trozo puede estar incompleto.
    while (!errorRemoto) {
      const { value, done } = await lector.read();
      if (done) break; // el servidor cerró el stream

      buffer += decodificador.decode(value, { stream: true }).replace(/\r\n/g, '\n'); // normaliza saltos de línea
      const eventos = buffer.split('\n\n');
      buffer = eventos.pop() ?? ''; // el último fragmento se guarda hasta que llegue el resto

      for (const evento of eventos) {
        consumir(evento);
        if (errorRemoto) break;
      }
    }

    // --- 3. Vaciar lo que quede en el buffer al terminar ---
    if (!errorRemoto) {
      buffer += decodificador.decode().replace(/\r\n/g, '\n');
      if (buffer.trim()) consumir(buffer);
    }

    // --- 4. Si hubo error remoto, se cierra el lector y se propaga ---
    if (errorRemoto) {
      await lector.cancel().catch(() => undefined);
      throw errorRemoto;
    }
  }

  // Interpreta las líneas "data:" de un evento SSE. Acepta JSON (delta/content/text o error) o texto plano.
  private eventoDe(evento: string): Evento {
    let delta = '';
    let error: ApiError | undefined;

    for (const linea of evento.split('\n')) {
      if (!linea.startsWith('data:')) continue; // ignora líneas "event:", "id:", comentarios…

      const dato = linea.slice(5).trim(); // contenido tras "data:"
      if (!dato || dato === '[DONE]') continue; // marcador de fin estilo OpenAI

      try {
        const parseado = JSON.parse(dato) as {
          delta?: string;
          content?: string;
          text?: string;
          error?: string;
          message?: string;
          status?: number;
          code?: 'quota_user' | 'quota_global';
          resetAt?: string;
        };

        if (parseado.error) {
          error = new ApiError(
            parseado.message || parseado.error,
            parseado.status ?? 502,
            parseado.code,
            parseado.resetAt,
          );
          continue;
        }

        delta += parseado.delta ?? parseado.content ?? parseado.text ?? ''; // admite varios nombres de campo
      } catch {
        delta += dato; // no era JSON: se toma como texto plano
      }
    }

    return { delta, error };
  }

  // Consulta el consumo diario y el estado del cupo global (GET /api/usage).
  async usage(): Promise<UsageResponse> {
    const respuesta = await fetch(this.url('/api/usage'), {
      headers: this.cabeceras({ Accept: 'application/json' }),
    });

    if (!respuesta.ok) throw await this.errorDe(respuesta);
    return (await respuesta.json()) as UsageResponse;
  }

  // Convierte una respuesta HTTP fallida en ApiError, leyendo el cuerpo JSON si existe.
  private async errorDe(respuesta: Response): Promise<ApiError> {
    let code: 'quota_user' | 'quota_global' | undefined;
    let resetAt: string | undefined;
    let mensaje = `Error ${respuesta.status}`; // mensaje genérico por defecto

    try {
      const data = (await respuesta.json()) as {
        error?: string;
        resetAt?: string;
        message?: string;
      };

      if (data.error === 'quota_user' || data.error === 'quota_global') {
        code = data.error; // error de cuota reconocido
      }
      resetAt = data.resetAt;
      // Prioridad: mensaje del servidor > mensaje según el tipo de cuota > genérico
      mensaje =
        data.message ||
        (code === 'quota_global'
          ? 'El cupo global está lleno.'
          : code === 'quota_user'
            ? 'Alcanzaste tu límite diario.'
            : mensaje);
    } catch {
      /* el cuerpo no era JSON */
    }

    return new ApiError(mensaje, respuesta.status, code, resetAt);
  }
}
