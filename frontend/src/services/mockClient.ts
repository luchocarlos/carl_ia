import { useUsageStore } from '../store/usageStore';
import type {
  AiClient,
  ChatRequestMessage,
  ChatStreamOptions,
  Mode,
  UsageResponse,
} from '../types';

// Crea el mismo error que lanza fetch al cancelarse, para que el hook lo trate igual.
function abortado(): DOMException {
  return new DOMException('Solicitud cancelada', 'AbortError');
}

// Pausa de `ms` milisegundos que se interrumpe (rechaza) si se aborta la señal.
function esperar(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { // ya cancelado antes de empezar
      reject(abortado());
      return;
    }

    // Al abortar: cancela el temporizador y rechaza la promesa
    const alAbortar = () => {
      window.clearTimeout(temporizador);
      reject(abortado());
    };

    const temporizador = window.setTimeout(() => {
      signal?.removeEventListener('abort', alAbortar); // limpia el listener al terminar normalmente
      resolve();
    }, ms);

    signal?.addEventListener('abort', alAbortar, { once: true });
  });
}

// Extrae el último mensaje del usuario (máx. 120 caracteres) para citarlo en la respuesta simulada.
function temaDe(messages: ChatRequestMessage[]): string {
  const ultimo = [...messages].reverse().find((mensaje) => mensaje.role === 'user');
  const tema = ultimo?.content.trim().replace(/\s+/g, ' ') ?? 'tu idea';
  return tema.length > 120 ? `${tema.slice(0, 120)}…` : tema;
}

// Respuesta simulada en Markdown para el modo texto (revisión de código).
function respuestaTexto(messages: ChatRequestMessage[]): string {
  const tema = temaDe(messages);

  return [
    '### Revisión rápida (demostración)',
    '',
    `Estoy en **modo demostración**, así que esta respuesta es simulada. Parto de: «${tema}».`,
    '',
    'Con el backend conectado, aquí verías un análisis real de tu código.',
    '',
    '```ts',
    'type Resultado<T> =',
    '  | { ok: true; valor: T }',
    "  | { ok: false; error: string };",
    '',
    'function parsear<T>(json: string): Resultado<T> {',
    '  try {',
    '    return { ok: true, valor: JSON.parse(json) as T };',
    '  } catch {',
    "    return { ok: false, error: 'JSON inválido' };",
    '  }',
    '}',
    '```',
    '',
    'Siguiente paso: pega el error completo y la versión de tu runtime.',
    '',
    '> Carl solo responde sobre programación.',
  ].join('\n');
}

// Respuesta simulada en Markdown para el modo documento (documentación técnica).
function respuestaDocumento(messages: ChatRequestMessage[]): string {
  const tema = temaDe(messages);

  return [
    '# Documentación técnica',
    '',
    `**Tema:** ${tema}`,
    '',
    '## Resumen',
    '',
    'Esta es una simulación generada por el cliente de demostración. Con el backend conectado recibirás documentación real de tu código.',
    '',
    '## Requisitos',
    '',
    '- Node.js 20 o superior.',
    '- Variables de entorno documentadas en `.env.example`.',
    '- Un endpoint de salud para verificar el despliegue.',
    '',
    '## Ejemplo de uso',
    '',
    '```ts',
    "const respuesta = await fetch('/api/usage');",
    'if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);',
    '',
    'const uso = await respuesta.json();',
    'console.log(uso.used, uso.limit);',
    '```',
    '',
    '## Referencia rápida',
    '',
    '| Elemento | Tipo | Descripción |',
    '| --- | --- | --- |',
    '| `GET /api/usage` | JSON | Consumo diario y cupo global |',
    '| `POST /api/chat` | SSE | Respuesta en streaming |',
    '',
    '## Próximos pasos',
    '',
    '1. Completar los ejemplos con datos reales.',
    '2. Añadir pruebas para cada endpoint.',
    '3. Revisar la documentación en cada cambio de contrato.',
  ].join('\n');
}

/**
 * Cliente simulado: sin red, con streaming falso.
 * Se usa cuando no hay VITE_API_BASE_URL (modo demostración y tests e2e).
 */
export class MockClient implements AiClient {
  // Genera la respuesta según el modo y la emite en trozos con pausas, imitando el streaming real.
  async chat(
    mode: Mode,
    messages: ChatRequestMessage[],
    { signal, onDelta }: ChatStreamOptions,
  ): Promise<void> {
    const texto = mode === 'document' ? respuestaDocumento(messages) : respuestaTexto(messages);
    const trozos = texto.match(/[\s\S]{1,22}/g) ?? [texto]; // trozos de hasta 22 caracteres

    for (const trozo of trozos) {
      if (signal?.aborted) throw abortado(); // respeta el botón detener
      await esperar(18, signal); // 18 ms entre trozos
      onDelta(trozo);
    }
  }

  // Devuelve el consumo guardado localmente y un cupo global fijo (42 %).
  async usage(): Promise<UsageResponse> {
    const { usado, limite, resetAt } = useUsageStore.getState();

    return {
      used: usado,
      limit: limite,
      resetAt,
      global: { pct: 42, status: 'ok' },
    };
  }
}
