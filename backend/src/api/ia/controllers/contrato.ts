// Controlador del "contrato" con el frontend de Carl: chat en streaming (SSE) y consumo diario.
import { PassThrough } from 'node:stream';
import type { Context } from 'koa';
import { IaError } from '../services/ia';
import {
  COSTOS,
  asegurarProveedor,
  claveUsuario,
  devolver,
  esperar,
  obtenerUso,
  prepararMensajes,
  reservar,
  responderChat,
  trocear,
} from '../services/contrato';

// Traduce errores a respuestas HTTP del contrato: { error: código, message, resetAt? }.
function responderError(ctx: Context, error: unknown) {
  const status = error instanceof IaError ? error.status : 500;
  const details = (error instanceof IaError ? error.details : undefined) as
    | { code?: string; resetAt?: string }
    | undefined; // code: p. ej. 'quota_user' / 'quota_global'; resetAt: cuándo se reinicia el cupo

  console.error('CARL ERROR:', (error as Error)?.message || error); // Log en servidor

  ctx.status = status;
  ctx.body = {
    error: details?.code ?? 'error',
    message: (error as Error)?.message || 'Error procesando la solicitud',
    ...(details?.resetAt ? { resetAt: details.resetAt } : {}),
  };
}

// Estado que se envía al cliente cuando falla la generación ya iniciada (dentro del stream).
// Un 429 del proveedor no es cupo del usuario: se trata como servicio ocupado.
function estadoDeError(error: unknown): number {
  if (!(error instanceof IaError)) return 502; // Error inesperado: fallo del upstream
  return error.status === 429 ? 503 : error.status;
}

// Valida el modo de chat recibido: 'text', 'document' o null si es inválido.
function modoDeChat(crudo: unknown): 'text' | 'document' | null {
  if (crudo === 'document') return 'document';
  if (crudo === 'text') return 'text';
  return null;
}

export default {
  // POST /api/chat — SSE con el contrato del frontend.
  // Valida, reserva puntos, genera la respuesta y la envía troceada como eventos SSE.
  chat: async (ctx: Context) => {                                    // método principal
    try {
      // --- Validación de la petición ---
      const body = ((ctx.request as any).body ?? {}) as Record<string, unknown>;
      const modo = modoDeChat(body.mode);
      if (!modo) throw new IaError('mode debe ser "text" o "document"', 400); // Modo inválido

      const mensajes = prepararMensajes(modo, body.messages); // Lanza 400 si los mensajes no son válidos
      asegurarProveedor(); // Lanza 503 si no hay proveedor configurado (antes de cobrar)

      // --- Control de cupo: se cobran los puntos antes de llamar al proveedor ---
      const usuario = claveUsuario(ctx); // ID anónimo (cabecera X-Carl-User) o IP
      const costo = COSTOS[modo]; // text = 1, document = 3
      reservar(usuario, costo); // Lanza 429 si se supera el límite diario o global

      // --- Apertura del stream SSE ---
      const stream = new PassThrough();
      ctx.status = 200;
      ctx.set('Content-Type', 'text/event-stream; charset=utf-8');
      ctx.set('Cache-Control', 'no-cache, no-transform');
      ctx.set('Connection', 'keep-alive');
      ctx.set('X-Accel-Buffering', 'no'); // Evita que nginx/proxies acumulen el stream
      ctx.body = stream;

      // Estados del stream.
      let abierto = true; // El cliente sigue conectado
      let terminado = false; // La generación finalizó (con éxito o error)
      let devuelto = false; // Ya se reembolsaron los puntos (evita reembolso doble)

      // Devuelve los puntos al usuario una sola vez.
      const reembolsar = () => {
        if (devuelto) return;
        devuelto = true;
        devolver(usuario, costo);
      };

      // Si el cliente cierra la conexión antes de terminar, se reembolsa.
      ctx.res.on('close', () => {
        if (ctx.res.writableEnded) return; // Cierre normal tras terminar la respuesta
        abierto = false;
        if (!terminado) reembolsar();
      });
      stream.on('error', () => {
        abierto = false;
      });

      // Envía un evento SSE con datos JSON (solo si la conexión sigue abierta).
      const enviar = (dato: unknown) => {
        if (abierto && !stream.destroyed) stream.write(`data: ${JSON.stringify(dato)}\n\n`);
      };

      // Latido cada 15 s (comentario SSE) para que proxies no corten la conexión por inactividad.
      const latido = setInterval(() => {
        if (abierto && !stream.destroyed) stream.write(': latido\n\n');
      }, 15_000);

      // --- Generación en segundo plano: la respuesta HTTP ya quedó abierta con el stream ---
      void (async () => {
        try {
          const respuesta = await responderChat(modo, mensajes); // Llamada al proveedor de IA
          const contenido = respuesta.content.trim();
          if (!contenido) throw new IaError('El proveedor devolvió una respuesta vacía', 502);

          // Envío troceado para simular escritura progresiva en el frontend.
          for (const trozo of trocear(contenido)) {
            if (!abierto) return; // El cliente se fue: se deja de enviar
            enviar({ delta: trozo });
            await esperar(12); // Pequeña pausa entre trozos
          }

          // Evento final con proveedor/modelo usados y marcador de fin.
          if (abierto) {
            enviar({ done: true, provider: respuesta.provider, model: respuesta.model });
            stream.write('data: [DONE]\n\n');
          }
          terminado = true;
        } catch (error) {
          // Error durante la generación: se informa por el stream y se reembolsan los puntos.
          console.error('CARL STREAM ERROR:', (error as Error)?.message || error); // Detalle técnico solo en el log
          const status = estadoDeError(error);
          const original = error instanceof IaError ? error.status : 502; // Estado real de Groq
          // 429 / 5xx de Groq: mensaje claro en español en lugar del texto técnico del proveedor.
          const mensaje =
            original === 429
              ? 'El servicio de IA está recibiendo demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.'
              : status >= 500
                ? 'El servicio de IA no está disponible en este momento. Inténtalo de nuevo en unos minutos.'
                : (error as Error)?.message || 'No se pudo generar la respuesta.';
          enviar({ error: mensaje, status });
          if (abierto) stream.write('data: [DONE]\n\n');
          terminado = true;
          reembolsar();
        } finally {
          // Limpieza: detiene el latido y cierra el stream.
          clearInterval(latido);
          if (!stream.destroyed) stream.end();
        }
      })();
    } catch (error) {
      // Errores previos al stream (validación, cupo, configuración) se responden como JSON.
      responderError(ctx, error);
    }
  },

  // GET /api/usage — consumo del usuario y cupo global.
  uso: async (ctx: Context) => {
    try {
      ctx.status = 200;
      ctx.body = obtenerUso(claveUsuario(ctx));
    } catch (error) {
      responderError(ctx, error);
    }
  },
};
