// Controlador de la API genérica de IA (/api/ia/*).
import type { Context } from 'koa';
import {
  chat,
  estado,
  IaError,
  listarModelos,
  proveedores,
} from '../services/ia';

// Verifica la API key opcional: si IA_API_KEY está definida, exige la cabecera X-API-Key igual.
function autorizado(ctx: Context): boolean {
  const esperado = process.env.IA_API_KEY?.trim();
  if (!esperado) return true; // Sin key configurada la API queda abierta
  return ctx.get('x-api-key') === esperado;
}

// Responde 401 cuando la API key no coincide.
function responderNoAutorizado(ctx: Context) {
  ctx.status = 401;
  ctx.body = { error: 'No autorizado' };
}

// Traduce errores a respuestas HTTP: IaError conserva su estado; cualquier otro es 500.
function responderError(ctx: Context, error: any) {
  const status = error instanceof IaError ? error.status : 500;

  console.error('IA ERROR:', error?.message || error); // Log en servidor para depurar

  ctx.status = status;
  ctx.body = {
    error: error?.message || 'Error procesando la solicitud',
    ...(error instanceof IaError && error.details ? { detalle: error.details } : {}), // Detalle extra si existe
  };
}

export default {
  // GET /api/ia/estado — diagnóstico público del servicio (no requiere API key).
  estado: async (ctx: Context) => {
    ctx.status = 200;
    ctx.body = estado();
  },

  // GET /api/ia/proveedores — lista proveedores y si tienen credenciales configuradas.
  proveedores: async (ctx: Context) => {
    if (!autorizado(ctx)) return responderNoAutorizado(ctx);

    ctx.status = 200;
    ctx.body = proveedores();
  },

  // GET /api/ia/models — lista modelos de un proveedor (filtrables por gratuitos).
  modelos: async (ctx: Context) => {
    if (!autorizado(ctx)) return responderNoAutorizado(ctx);

    try {
      // Parámetros de query opcionales (solo se aceptan si son string).
      const provider = typeof ctx.query.provider === 'string' ? ctx.query.provider : undefined;
      const gratis = typeof ctx.query.free === 'string' ? ctx.query.free : undefined;
      ctx.status = 200;
      ctx.body = await listarModelos(provider, gratis); // Consulta al proveedor
    } catch (error: any) {
      responderError(ctx, error);
    }
  },

  // POST /api/ia/chat — envía los mensajes al proveedor y devuelve la respuesta completa.
  chat: async (ctx: Context) => {                                    // método principal
    if (!autorizado(ctx)) return responderNoAutorizado(ctx);

    try {
      const body = (ctx.request as any).body ?? {}; // Cuerpo JSON (la validación la hace el servicio)
      const resultado = await chat(body); // Llamada al proveedor (con fallback automático)
      ctx.status = 200;
      ctx.body = resultado;
    } catch (error: any) {
      responderError(ctx, error);
    }
  },
};
