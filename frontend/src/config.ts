import type { Mode } from './types';

/** Nombre de la aplicación en un único lugar. */
export const APP_NAME = 'Carl';

// Lema que se muestra en la pantalla de inicio.
export const APP_TAGLINE = 'Tu copiloto para escribir, depurar y entender código.';

/** Coste en puntos por tipo de solicitud. */
export const COSTS: Record<Mode, number> = {
  text: 1, // chat de código
  document: 3, // documentación (respuestas más largas)
};

/** Límite diario de puntos por usuario. */
export const DAILY_LIMIT = 30;

/** Caracteres máximos del compositor. */
export const MAX_INPUT_CHARS = 4000;

/** Tiempo máximo por solicitud (30 s); al superarlo se aborta. */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Zona horaria del reinicio diario. */
export const TIMEZONE = 'America/Bogota';

// Claves de localStorage; el sufijo de versión permite cambiar el esquema sin chocar con datos viejos.
export const STORAGE_KEYS = {
  chats: 'carl:chats:v1', // historial de conversaciones
  usage: 'carl:usage:v1', // contador de consumo diario
  user: 'carl:user:v1', // id anónimo del navegador
} as const;

// Modos disponibles en el selector del compositor.
export const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  { id: 'text', label: 'Código', hint: 'Chat sobre código y errores' },
  { id: 'document', label: 'Documentación', hint: 'READMEs, APIs y guías técnicas' },
];

// Tarjetas de sugerencia de la pantalla de inicio; al pulsarlas rellenan el compositor con `prompt`.
export const SUGGESTIONS: Array<{
  id: string;
  mode: Mode;
  title: string;
  description: string;
  prompt: string;
}> = [
  {
    id: 'depurar',
    mode: 'text',
    title: 'Depura un error',
    description: 'Pega el mensaje y el contexto.',
    prompt: 'Ayúdame a depurar este error. Te dejo el mensaje y el código:\n\n',
  },
  {
    id: 'revisar',
    mode: 'text',
    title: 'Revisa mi código',
    description: 'Legibilidad, riesgos y pruebas.',
    prompt:
      'Revisa este código y propón mejoras de legibilidad, rendimiento y seguridad:\n\n',
  },
  {
    id: 'api',
    mode: 'document',
    title: 'Documenta una API',
    description: 'README con ejemplos reales.',
    prompt:
      'Escribe la documentación técnica de esta API en Markdown: endpoints, parámetros, ejemplos de petición y respuesta, y errores.\n\n',
  },
  {
    id: 'arquitectura',
    mode: 'document',
    title: 'Explica la arquitectura',
    description: 'Componentes y decisiones.',
    prompt:
      'Documenta la arquitectura de este proyecto: componentes, flujos, decisiones y trade-offs.\n\n',
  },
];

// Texto visible para cada estado del cupo global.
export const GLOBAL_STATUS_LABEL = {
  ok: 'Disponible',
  ocupado: 'Ocupado',
  lleno: 'Lleno',
} as const;
