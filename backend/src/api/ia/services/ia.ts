// Servicio principal de IA: validación de entradas, resolución de proveedor/modelo,
// cadena de respaldo (fallback) entre proveedores y listado de modelos con caché.
import {
  listarProveedoresCatalogo,
  obtenerAdaptador,
  obtenerApiKey,
  obtenerCatalogo,
  obtenerProveedor,
} from '../providers';
import { ProveedorError } from '../providers/errors';
import type {
  ChatMessage,
  FallbackInfo,
  ModelInfo,
  ProviderConfig,
} from '../providers/types';

const MAX_MENSAJES = 50; // Máximo de mensajes por solicitud
const MAX_CARACTERES = 20_000; // Máximo de caracteres sumando todos los mensajes
const MAX_CADENA = 5; // Máximo de proveedores a intentar en la cadena de respaldo
const CACHE_MODELOS_MS = 5 * 60 * 1000; // Vigencia de la caché de modelos (5 min)
const ESTADOS_REINTENTABLES = new Set([429, 502, 503, 504]); // Errores que justifican probar el siguiente proveedor

// Caché en memoria de modelos por proveedor.
const cacheModelos = new Map<string, { expira: number; modelos: ModelInfo[] }>();

// Error de la API de IA con estado HTTP y detalles opcionales para el cliente.
export class IaError extends Error {
  status: number; // Estado HTTP a responder
  details?: unknown; // Información adicional (código de cupo, fallbacks, proveedor...)

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = 'IaError';
    this.status = status;
    this.details = details;
  }
}

// Devuelve el valor recortado si es string; cualquier otra cosa se convierte en ''.
function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

// Valida que temperature sea un número entre 0 y 2 (opcional).
function validarTemperatura(valor: unknown): number | undefined {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor !== 'number' || Number.isNaN(valor) || valor < 0 || valor > 2) {
    throw new IaError('temperature debe ser un número entre 0 y 2', 400);
  }
  return valor;
}

// Valida que maxTokens sea un entero positivo (opcional).
function validarMaxTokens(valor: unknown): number | undefined {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
    throw new IaError('maxTokens debe ser un entero mayor que 0', 400);
  }
  return valor;
}

// Normaliza y valida mensajes: acepta un string (un solo mensaje de usuario) o un arreglo
// de { role, content }; antepone la instrucción de sistema si se envía.
export function normalizarMensajes(messages: unknown, system?: unknown): ChatMessage[] {
  const resultado: ChatMessage[] = [];

  // Instrucción de sistema opcional al inicio.
  const instruccion = texto(system);
  if (instruccion) {
    resultado.push({ role: 'system', content: instruccion });
  }

  if (typeof messages === 'string') {
    // Forma corta: un texto plano equivale a un mensaje de usuario.
    const contenido = messages.trim();
    if (contenido) resultado.push({ role: 'user', content: contenido });
  } else if (Array.isArray(messages)) {
    // Forma completa: se descartan elementos inválidos, vacíos o con rol desconocido.
    for (const item of messages) {
      if (!item || typeof item !== 'object') continue;

      const rol = (item as any).role;
      const contenido = texto((item as any).content);
      if (!contenido) continue;
      if (rol !== 'system' && rol !== 'user' && rol !== 'assistant') continue;

      resultado.push({ role: rol, content: contenido });
    }
  }

  // Límites de cantidad y tamaño.
  if (resultado.length > MAX_MENSAJES) {
    throw new IaError(`Máximo ${MAX_MENSAJES} mensajes por solicitud`, 400);
  }

  const total = resultado.reduce((suma, mensaje) => suma + mensaje.content.length, 0);
  if (total > MAX_CARACTERES) {
    throw new IaError(`El contenido supera el límite de ${MAX_CARACTERES} caracteres`, 400);
  }

  return resultado;
}

// Resuelve el proveedor (pedido > IA_DEFAULT_PROVIDER > catálogo) y su API key.
// Lanza 400 si no existe y 503 si falta su key.
export function resolverProveedor(providerId?: unknown) {
  if (providerId !== undefined && providerId !== null && typeof providerId !== 'string') {
    throw new IaError('provider debe ser texto', 400);
  }

  // Prioridad: el pedido por el cliente, luego el del entorno, luego el del catálogo.
  const id =
    texto(providerId) ||
    texto(process.env.IA_DEFAULT_PROVIDER) ||
    obtenerCatalogo().defaultProvider;

  // "auto" no es un proveedor real: solo lo entienden chat (cadena) y el listado de modelos.
  if (id === 'auto') {
    throw new IaError('auto solo se usa en chat y modelos', 400);
  }

  const config = obtenerProveedor(id);
  if (!config) {
    throw new IaError(`Proveedor desconocido: ${id || '(vacío)'}`, 400, {
      proveedores: Object.keys(obtenerCatalogo().providers), // Sugiere los IDs válidos
    });
  }

  const apiKey = obtenerApiKey(config);
  if (config.envKey && !apiKey) {
    throw new IaError(`Falta configurar ${config.envKey} para usar ${config.name}`, 503); // Error de configuración del servidor
  }

  return { id, config, apiKey };
}

// Un paso de la cadena de respaldo: proveedor y modelo opcional.
export interface IntentoChat {
  provider: string;
  model?: string;
}

// Parsea una cadena "proveedor:modelo,proveedor2,..." (formato de IA_FALLBACK_CHAIN).
function parsearCadena(crudo: string): IntentoChat[] {
  return crudo
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      // Solo se corta en el primer ":" (los IDs de modelo pueden contener ":" como "x:free").
      const corte = item.indexOf(':');
      if (corte === -1) return { provider: item, model: undefined };
      return {
        provider: item.slice(0, corte).trim(),
        model: item.slice(corte + 1).trim() || undefined,
      };
    })
    .filter((item) => item.provider);
}

// Lee el modelo configurado para un proveedor en IA_MODEL_<PROVEEDOR> (p. ej. IA_MODEL_OPENROUTER).
function modeloEntorno(providerId: string): string {
  const variable = `IA_MODEL_${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return texto(process.env[variable]);
}

// Elige el modelo del intento: pedido > IA_MODEL_<PROVEEDOR> > IA_DEFAULT_MODEL (solo si usarGlobal) > catálogo.
function modeloDe(
  providerId: string,
  config: ProviderConfig,
  pedido?: string,
  usarGlobal = false,
): string {
  return (
    texto(pedido) ||
    modeloEntorno(providerId) ||
    (usarGlobal ? texto(process.env.IA_DEFAULT_MODEL) : '') ||
    texto(config.defaultModel)
  );
}

// Construye la cadena de respaldo (lista ordenada de proveedores a intentar).
export function construirCadena(providerId?: unknown, model?: unknown): IntentoChat[] {
  const solicitado = texto(providerId);
  const modelo = texto(model);

  // Si el cliente pide un proveedor concreto, no hay fallback: solo ese.
  if (solicitado && solicitado !== 'auto') {
    return [{ provider: solicitado, model: modelo || undefined }];
  }

  const porDefecto =
    texto(process.env.IA_DEFAULT_PROVIDER) || obtenerCatalogo().defaultProvider;
  const configurada = parsearCadena(texto(process.env.IA_FALLBACK_CHAIN));

  // 1) Primero el proveedor por defecto.
  const cadena: IntentoChat[] = [];
  if (porDefecto && porDefecto !== 'auto') {
    cadena.push({
      provider: porDefecto,
      model:
        modelo ||
        modeloEntorno(porDefecto) ||
        texto(process.env.IA_DEFAULT_MODEL) ||
        obtenerProveedor(porDefecto)?.defaultModel,
    });
  }
  // 2) Luego la cadena configurada en IA_FALLBACK_CHAIN.
  cadena.push(...configurada);

  // 3) Sin cadena configurada: se agregan los proveedores gratuitos del catálogo que tengan modelo.
  if (!configurada.length) {
    for (const [id, config] of Object.entries(obtenerCatalogo().providers)) {
      if (!config.free || config.soloEnOpenCode) continue;
      const model = modeloEntorno(id) || config.defaultModel;
      if (!model) continue;
      cadena.push({ provider: id, model });
    }
  }

  // Elimina proveedores repetidos conservando el primero.
  const unicos: IntentoChat[] = [];
  for (const intento of cadena) {
    if (!unicos.some((otro) => otro.provider === intento.provider)) {
      unicos.push(intento);
    }
  }

  return unicos.slice(0, MAX_CADENA); // Limita el número de intentos
}

// Indica si un modelo es gratis: dato del proveedor > lista del catálogo > sufijo ":free".
export function esGratis(modelo: ModelInfo, config: ProviderConfig): boolean {
  if (modelo.free !== undefined) return modelo.free;
  if ((config.freeModels ?? []).includes(modelo.id)) return true;
  return modelo.id.endsWith(':free');
}

// Agrupa los modelos gratis de todos los proveedores gratuitos del catálogo (para provider=auto).
function modelosAuto(): ModelInfo[] {
  const modelos: ModelInfo[] = [];

  for (const [id, config] of Object.entries(obtenerCatalogo().providers)) {
    if (!config.free || config.soloEnOpenCode) continue;
    for (const modelId of config.freeModels ?? []) {
      modelos.push({
        id: modelId,
        name: `${config.name}: ${modelId}`,
        provider: id,
        free: true,
      });
    }
  }

  return modelos;
}

// Cuerpo esperado de una petición de chat (sin validar, por eso todo es unknown).
export interface ChatInput {
  provider?: unknown;
  model?: unknown;
  messages?: unknown;
  system?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
}

// Envía el chat recorriendo la cadena de respaldo hasta que un proveedor responda.
// Devuelve la respuesta del primero exitoso, con la lista de los que fallaron en "fallbacks".
export async function chat(input: ChatInput) {
  // --- Validación de la entrada ---
  const messages = normalizarMensajes(input.messages, input.system);
  if (!messages.length) {
    throw new IaError('messages es obligatorio', 400);
  }

  if (input.model !== undefined && typeof input.model !== 'string') {
    throw new IaError('model debe ser texto', 400);
  }

  const temperature = validarTemperatura(input.temperature);
  const maxTokens = validarMaxTokens(input.maxTokens);

  // --- Construcción de la cadena de proveedores ---
  const cadena = construirCadena(input.provider, input.model);
  if (!cadena.length) {
    throw new IaError('No hay proveedores configurados para IA', 503);
  }

  const fallos: FallbackInfo[] = []; // Proveedores que fallaron (se informan al cliente)
  let ultimo: IaError | undefined; // Último error, por si ninguno responde

  // --- Recorrido de la cadena ---
  for (let i = 0; i < cadena.length; i += 1) {
    const intento = cadena[i];
    const esUltimo = i === cadena.length - 1;

    // Resolver proveedor y key; si falla se pasa al siguiente (salvo que sea el único).
    let resuelto: ReturnType<typeof resolverProveedor>;
    try {
      resuelto = resolverProveedor(intento.provider);
    } catch (error) {
      const iaError =
        error instanceof IaError ? error : new IaError('Error resolviendo proveedor', 500);
      if (cadena.length === 1) throw iaError; // Proveedor pedido explícitamente: error directo
      fallos.push({ provider: intento.provider, status: iaError.status, error: iaError.message });
      ultimo = iaError;
      continue;
    }

    // Elegir modelo (IA_DEFAULT_MODEL solo aplica al primer intento).
    const model = modeloDe(resuelto.id, resuelto.config, intento.model, i === 0);
    if (!model) {
      const iaError = new IaError(`No hay modelo para ${resuelto.config.name}`, 400);
      if (cadena.length === 1) throw iaError;
      fallos.push({ provider: resuelto.id, status: iaError.status, error: iaError.message });
      ultimo = iaError;
      continue;
    }

    // Llamada al proveedor mediante su adaptador.
    try {
      const resultado = await obtenerAdaptador(resuelto.config.api).chat(
        resuelto.config,
        { provider: resuelto.id, model, messages, temperature, maxTokens },
        resuelto.apiKey,
      );

      return fallos.length ? { ...resultado, fallbacks: fallos } : resultado; // Éxito
    } catch (error) {
      // Convierte el error del proveedor en IaError conservando su estado.
      const iaError =
        error instanceof ProveedorError
          ? new IaError(error.message, error.status, { provider: error.provider })
          : new IaError('Error inesperado consultando el proveedor', 502);

      ultimo = iaError;

      // Si es el último intento o el error no es reintentable (p. ej. 400), se corta aquí.
      if (esUltimo || !ESTADOS_REINTENTABLES.has(iaError.status)) {
        if (fallos.length) {
          iaError.details = { ...(iaError.details as object), fallbacks: fallos };
        }
        throw iaError;
      }

      fallos.push({ provider: resuelto.id, status: iaError.status, error: iaError.message }); // Se intenta el siguiente
    }
  }

  // Ningún proveedor respondió: se lanza el último error con el historial de fallos.
  if (ultimo) {
    ultimo.details = { ...(ultimo.details as object), fallbacks: fallos };
    throw ultimo;
  }

  throw new IaError('No se pudo consultar ningún proveedor', 503, { fallbacks: fallos });
}

// Lista los modelos de un proveedor, opcionalmente solo los gratuitos (usa caché de 5 min).
export async function listarModelos(providerId?: unknown, soloGratis?: unknown) {
  const filtro = soloGratis === true || soloGratis === 'true' || soloGratis === '1'; // ?free=true | ?free=1

  const solicitado =
    texto(providerId) ||
    texto(process.env.IA_DEFAULT_PROVIDER) ||
    obtenerCatalogo().defaultProvider;

  // provider=auto: modelos gratis del catálogo, sin llamar a ningún proveedor.
  if (solicitado === 'auto') {
    return { provider: 'auto', models: modelosAuto(), cached: false, gratis: true };
  }

  const { id, config, apiKey } = resolverProveedor(solicitado);

  // Si se piden gratis y el catálogo ya los conoce, se responden sin llamada externa.
  if (filtro && config.freeModels?.length) {
    return {
      provider: id,
      models: config.freeModels.map((modelId) => ({ id: modelId, provider: id, free: true })),
      cached: false,
      gratis: true,
    };
  }

  const cache = cacheModelos.get(id);
  let modelos: ModelInfo[];
  let cached = false; // Indica al cliente si la respuesta salió de la caché

  if (cache && cache.expira > Date.now()) {
    // Caché vigente.
    modelos = cache.modelos;
    cached = true;
  } else {
    // Caché vencida o inexistente: se consulta al proveedor y se guarda.
    try {
      modelos = await obtenerAdaptador(config.api).listModels(config, apiKey);
      cacheModelos.set(id, { expira: Date.now() + CACHE_MODELOS_MS, modelos });
    } catch (error) {
      if (error instanceof ProveedorError) {
        throw new IaError(error.message, error.status, { provider: error.provider });
      }
      throw new IaError('Error inesperado listando modelos', 502);
    }
  }

  if (filtro) {
    modelos = modelos.filter((modelo) => esGratis(modelo, config));
  }

  return { provider: id, models: modelos, cached, ...(filtro ? { gratis: true } : {}) };
}

// Estado general del servicio (diagnóstico público): configuración, cadena, proveedores y rutas.
export function estado() {
  const porDefecto =
    texto(process.env.IA_DEFAULT_PROVIDER) || obtenerCatalogo().defaultProvider;
  const cadena = construirCadena();

  return {
    ok: true,
    servicio: 'ia',
    defaultProvider: porDefecto,
    defaultModel: texto(process.env.IA_DEFAULT_MODEL) || null,
    cadena: cadena.map((intento) => intento.provider), // Orden de proveedores del fallback
    proveedores: listarProveedoresCatalogo(),
    // Rutas disponibles (referencia rápida).
    rutas: [
      'GET /api/ia/estado',
      'GET /api/ia/proveedores',
      'GET /api/ia/models?provider=openrouter&free=1',
      'GET /api/ia/models?provider=auto',
      'POST /api/ia/chat',
      'POST /api/chat (SSE)',
      'GET /api/usage',
    ],
  };
}

// Lista los proveedores del catálogo, el proveedor por defecto y la cadena de respaldo.
export function proveedores() {
  const porDefecto =
    texto(process.env.IA_DEFAULT_PROVIDER) || obtenerCatalogo().defaultProvider;

  return {
    defaultProvider: porDefecto,
    cadena: construirCadena().map((intento) => intento.provider),
    proveedores: listarProveedoresCatalogo(),
  };
}
