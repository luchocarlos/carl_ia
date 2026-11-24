// Adaptador para la API nativa de Google Gemini (generateContent).
import { ProveedorError } from './errors';
import { pedirJson, unirUrl } from './http';
import type {
  ChatOptions,
  ChatResult,
  ModelInfo,
  ProviderAdapter,
} from './types';

// Implementación de ProviderAdapter para Gemini.
export const google: ProviderAdapter = {
  // Chat con la API de Gemini: traduce los mensajes al formato de Google y normaliza la respuesta.
  async chat(config, options: ChatOptions, apiKey): Promise<ChatResult> {
    // Validación: Gemini siempre requiere API key.
    if (!apiKey) {
      throw new ProveedorError('Falta la API key de Gemini', 503, options.provider);
    }

    // Gemini no acepta mensajes "system" en la conversación: se unen en una sola instrucción de sistema.
    const sistema = options.messages
      .filter((mensaje) => mensaje.role === 'system')
      .map((mensaje) => mensaje.content)
      .join('\n\n');

    // Resto de mensajes en formato Gemini ("assistant" pasa a llamarse "model").
    const contents = options.messages
      .filter((mensaje) => mensaje.role !== 'system')
      .map((mensaje) => ({
        role: mensaje.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: mensaje.content }],
      }));

    // Cuerpo de la petición.
    const body: Record<string, any> = { contents };
    if (sistema) {
      body.systemInstruction = { parts: [{ text: sistema }] };
    }

    // Parámetros de generación opcionales (solo se envían si se indicaron).
    const generationConfig: Record<string, unknown> = {};
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
    if (Object.keys(generationConfig).length) {
      body.generationConfig = generationConfig;
    }

    // URL del endpoint; se quita el prefijo "models/" si viene incluido y la key va como query param.
    const modelo = options.model.replace(/^models\//, '');
    const url = `${unirUrl(config.baseURL, `/models/${encodeURIComponent(modelo)}:generateContent`)}?key=${encodeURIComponent(apiKey)}`;

    // Llamada externa a Gemini.
    const data = await pedirJson(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      },
      options.provider,
    );

    // Concatena el texto de todas las partes del primer candidato.
    const partes = data?.candidates?.[0]?.content?.parts;
    const content = Array.isArray(partes)
      ? partes.map((parte: any) => (typeof parte?.text === 'string' ? parte.text : '')).join('')
      : '';

    // Respuesta vacía (p. ej. bloqueada por filtros de seguridad) se trata como error.
    if (!content) {
      throw new ProveedorError('El proveedor no devolvió contenido', 502, options.provider, data);
    }

    // Resultado normalizado.
    return {
      provider: options.provider,
      model: options.model,
      content,
      usage: (data?.usageMetadata as Record<string, unknown>) ?? null, // Consumo de tokens según Gemini
    };
  },

  // Lista los modelos Gemini que soportan generación de contenido.
  async listModels(config, apiKey): Promise<ModelInfo[]> {
    if (!apiKey) {
      throw new ProveedorError('Falta la API key de Gemini', 503, config.name);
    }

    // Llamada externa al listado de modelos.
    const data = await pedirJson(
      `${unirUrl(config.baseURL, '/models')}?key=${encodeURIComponent(apiKey)}`,
      { method: 'GET', headers: { Accept: 'application/json' } },
      config.name,
    );

    const lista = Array.isArray(data?.models) ? data.models : [];
    return lista
      // Se descartan modelos que no sirven para chat (p. ej. solo embeddings).
      .filter(
        (modelo: any) =>
          !Array.isArray(modelo?.supportedGenerationMethods) ||
          modelo.supportedGenerationMethods.includes('generateContent'),
      )
      .map((modelo: any) => ({
        id: String(modelo?.name ?? '').replace(/^models\//, ''), // "models/gemini-x" -> "gemini-x"
        name: typeof modelo?.displayName === 'string' ? modelo.displayName : undefined,
      }))
      .filter((modelo) => modelo.id); // Descarta entradas sin ID
  },
};
