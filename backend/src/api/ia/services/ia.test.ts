// Pruebas del servicio de IA: normalización de mensajes, cadena de respaldo, modelos gratis y fallback.
import { describe, expect, it, vi } from 'vitest';
import {
  IaError,
  chat,
  construirCadena,
  esGratis,
  normalizarMensajes,
  resolverProveedor,
} from './ia';

// Validación y limpieza de la entrada de chat (incluye validaciones de resolverProveedor).
describe('normalizarMensajes', () => {
  it('acepta un string como mensaje de usuario', () => {
    expect(normalizarMensajes('Hola')).toEqual([{ role: 'user', content: 'Hola' }]);
  });

  // El system del parámetro va primero; se descartan vacíos y roles desconocidos.
  it('antepone el system y descarta mensajes vacíos o con roles inválidos', () => {
    const mensajes = normalizarMensajes(
      [
        { role: 'system', content: 'Eres breve' },
        { role: 'user', content: 'Hola' },
        { role: 'assistant', content: '' },
        { role: 'otro', content: 'ignorado' },
        { role: 'assistant', content: 'Hola de nuevo' },
      ],
      'Responde en español',
    );

    expect(mensajes).toEqual([
      { role: 'system', content: 'Responde en español' },
      { role: 'system', content: 'Eres breve' },
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Hola de nuevo' },
    ]);
  });

  // 20 001 caracteres supera MAX_CARACTERES (20 000).
  it('rechaza contenido demasiado largo', () => {
    expect(() => normalizarMensajes('x'.repeat(20_001))).toThrow(IaError);
  });

  it('rechaza un proveedor desconocido', () => {
    expect(() => resolverProveedor('no-existe')).toThrow(/Proveedor desconocido/);
  });

  it('rechaza auto como proveedor explícito', () => {
    expect(() => resolverProveedor('auto')).toThrow(/auto solo se usa/);
  });
});

// Orden de proveedores a intentar según petición y variables de entorno.
describe('construirCadena', () => {
  // Con proveedor explícito no hay fallback.
  it('usa solo el proveedor explícito con su modelo', () => {
    expect(construirCadena('openrouter', 'modelo/x:free')).toEqual([
      { provider: 'openrouter', model: 'modelo/x:free' },
    ]);
  });

  // Sin IA_FALLBACK_CHAIN se usan los gratuitos del catálogo; opencode se excluye (solo OpenCode).
  it('arma la cadena automática con los modelos gratis del catálogo', () => {
    const anterior = process.env.IA_DEFAULT_PROVIDER;
    const anteriorCadena = process.env.IA_FALLBACK_CHAIN;

    process.env.IA_DEFAULT_PROVIDER = 'openrouter';
    delete process.env.IA_FALLBACK_CHAIN;

    try {
      const cadena = construirCadena();
      expect(cadena[0].provider).toBe('openrouter');
      expect(cadena[0].model).toBe('google/gemma-4-31b-it:free');
      expect(cadena.map((intento) => intento.provider)).not.toContain('opencode');
    } finally {
      if (anterior === undefined) delete process.env.IA_DEFAULT_PROVIDER;
      else process.env.IA_DEFAULT_PROVIDER = anterior;
      if (anteriorCadena === undefined) delete process.env.IA_FALLBACK_CHAIN;
      else process.env.IA_FALLBACK_CHAIN = anteriorCadena;
    }
  });

  // Solo se corta en el primer ':' de cada entrada (gemini-x:free conserva el sufijo).
  it('respeta IA_FALLBACK_CHAIN con modelos que contienen dos puntos', () => {
    const anterior = process.env.IA_DEFAULT_PROVIDER;
    const anteriorCadena = process.env.IA_FALLBACK_CHAIN;

    process.env.IA_DEFAULT_PROVIDER = 'openrouter';
    process.env.IA_FALLBACK_CHAIN = 'groq:llama-x,google:gemini-x:free';

    try {
      expect(construirCadena()).toEqual([
        { provider: 'openrouter', model: 'google/gemma-4-31b-it:free' },
        { provider: 'groq', model: 'llama-x' },
        { provider: 'google', model: 'gemini-x:free' },
      ]);
    } finally {
      if (anterior === undefined) delete process.env.IA_DEFAULT_PROVIDER;
      else process.env.IA_DEFAULT_PROVIDER = anterior;
      if (anteriorCadena === undefined) delete process.env.IA_FALLBACK_CHAIN;
      else process.env.IA_FALLBACK_CHAIN = anteriorCadena;
    }
  });
});

// Detección de modelos gratuitos.
describe('esGratis', () => {
  it('detecta modelos gratis por sufijo y por catálogo', () => {
    const config = { name: 'x', api: 'openai' as const, baseURL: 'http://x' };

    expect(esGratis({ id: 'modelo:free' }, config)).toBe(true);
    expect(esGratis({ id: 'modelo' }, { ...config, freeModels: ['modelo'] })).toBe(true);
    expect(esGratis({ id: 'modelo', free: false }, config)).toBe(false);
  });
});

// Fallback entre proveedores simulando fetch.
describe('chat con respaldo', () => {
  // openrouter responde 429 (reintentable) -> se usa groq y se informa el fallo.
  it('pasa al siguiente proveedor si el primero responde 429', async () => {
    const claves = ['IA_DEFAULT_PROVIDER', 'IA_FALLBACK_CHAIN', 'OPENROUTER_API_KEY', 'GROQ_API_KEY'];
    const previos = Object.fromEntries(claves.map((clave) => [clave, process.env[clave]]));

    process.env.IA_DEFAULT_PROVIDER = 'openrouter';
    process.env.IA_FALLBACK_CHAIN = 'groq:modelo-groq';
    process.env.OPENROUTER_API_KEY = 'k1';
    process.env.GROQ_API_KEY = 'k2';

    let llamadas = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        llamadas += 1;
        if (String(url).includes('openrouter')) {
          return new Response(JSON.stringify({ error: { message: 'rate limit' } }), {
            status: 429,
          });
        }
        return new Response(
          JSON.stringify({
            model: 'modelo-groq',
            choices: [{ message: { content: 'hola' } }],
            usage: {},
          }),
          { status: 200 },
        );
      }),
    );

    try {
      const resultado = await chat({ messages: 'Hola' });

      expect(resultado.provider).toBe('groq');
      expect(resultado.content).toBe('hola');
      expect(resultado.fallbacks).toEqual([
        { provider: 'openrouter', status: 429, error: 'rate limit' },
      ]);
      expect(llamadas).toBe(2);
    } finally {
      vi.unstubAllGlobals();
      for (const clave of claves) {
        if (previos[clave] === undefined) delete process.env[clave];
        else process.env[clave] = previos[clave];
      }
    }
  });

  // Un 400 es error de la petición: no se prueba otro proveedor (una sola llamada).
  it('no reintenta cuando el error es de la solicitud', async () => {
    const claves = ['IA_DEFAULT_PROVIDER', 'IA_FALLBACK_CHAIN', 'OPENROUTER_API_KEY', 'GROQ_API_KEY'];
    const previos = Object.fromEntries(claves.map((clave) => [clave, process.env[clave]]));

    process.env.IA_DEFAULT_PROVIDER = 'openrouter';
    process.env.IA_FALLBACK_CHAIN = 'groq:modelo-groq';
    process.env.OPENROUTER_API_KEY = 'k1';
    process.env.GROQ_API_KEY = 'k2';

    let llamadas = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        llamadas += 1;
        return new Response(JSON.stringify({ error: { message: 'modelo inválido' } }), {
          status: 400,
        });
      }),
    );

    try {
      await expect(chat({ messages: 'Hola' })).rejects.toThrow('modelo inválido');
      expect(llamadas).toBe(1);
    } finally {
      vi.unstubAllGlobals();
      for (const clave of claves) {
        if (previos[clave] === undefined) delete process.env[clave];
        else process.env[clave] = previos[clave];
      }
    }
  });
});
