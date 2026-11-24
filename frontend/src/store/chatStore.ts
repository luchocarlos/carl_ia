import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '../config';
import { nuevoId } from '../lib/id';
import { crearAlmacenamiento } from '../lib/storage';
import type { Chat, ChatMessage, Mode } from '../types';

// Fábrica de mensajes: completa id, fecha y estado por defecto ('done') a partir de los datos mínimos.
export function crearMensaje(
  parcial: Pick<ChatMessage, 'role' | 'mode' | 'content'> &
    Partial<Pick<ChatMessage, 'status' | 'error'>>,
): ChatMessage {
  return {
    id: nuevoId(),
    createdAt: Date.now(),
    status: 'done',
    ...parcial, // lo recibido sobrescribe los valores por defecto
  };
}

// Forma laxa de un mensaje leído del almacenamiento (puede venir incompleto o con modos obsoletos).
type MensajePersistido = Partial<Omit<ChatMessage, 'mode'>> & { mode?: string };

/**
 * Normaliza historiales antiguos: el modo Imagen ya no existe.
 * Valida campo por campo lo que hay en localStorage, descarta datos corruptos,
 * mensajes de imagen y chats que quedan vacíos.
 */
function migrarEstado(crudo: unknown): { chats: Chat[]; activeId: string | null } {
  const estado = (crudo ?? {}) as { chats?: unknown; activeId?: unknown };
  const chats: Chat[] = [];

  if (!Array.isArray(estado.chats)) return { chats, activeId: null }; // nada válido guardado

  for (const crudoChat of estado.chats) {
    if (!crudoChat || typeof crudoChat !== 'object') continue;

    const chat = crudoChat as {
      id?: unknown;
      title?: unknown;
      mode?: unknown;
      messages?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
    };
    if (typeof chat.id !== 'string') continue; // sin id no se puede recuperar

    // Sanea cada mensaje: tipos correctos y valores por defecto seguros
    const mensajes = (Array.isArray(chat.messages) ? chat.messages : [])
      .filter((item): item is MensajePersistido => Boolean(item) && typeof item === 'object')
      .filter((mensaje) => mensaje.mode !== 'image') // se eliminan los mensajes del antiguo modo imagen
      .map<ChatMessage>((mensaje) => ({
        id: typeof mensaje.id === 'string' ? mensaje.id : nuevoId(),
        role: mensaje.role === 'assistant' ? 'assistant' : 'user',
        mode: mensaje.mode === 'document' ? 'document' : 'text',
        content: typeof mensaje.content === 'string' ? mensaje.content : '',
        createdAt: Number(mensaje.createdAt) || Date.now(),
        status:
          mensaje.status === 'streaming' ||
          mensaje.status === 'error' ||
          mensaje.status === 'stopped'
            ? mensaje.status
            : 'done',
        ...(typeof mensaje.error === 'string' ? { error: mensaje.error } : {}),
      }));

    if (!mensajes.length) continue; // chats vacíos no se restauran

    chats.push({
      id: chat.id,
      title: typeof chat.title === 'string' && chat.title ? chat.title : 'Nuevo chat',
      mode: chat.mode === 'document' ? 'document' : 'text',
      messages: mensajes,
      createdAt: Number(chat.createdAt) || Date.now(),
      updatedAt: Number(chat.updatedAt) || Date.now(),
    });
  }

  // El chat activo solo se conserva si sigue existiendo tras la limpieza
  const activeId =
    typeof estado.activeId === 'string' && chats.some((chat) => chat.id === estado.activeId)
      ? estado.activeId
      : null;

  return { chats, activeId };
}

// Estado y acciones del store de conversaciones.
interface ChatState {
  chats: Chat[]; // lista de chats, el más reciente primero
  activeId: string | null; // chat seleccionado (null = pantalla de inicio)
  crearChat: (modo: Mode) => string; // crea un chat vacío, lo activa y devuelve su id
  setActivo: (id: string | null) => void; // cambia el chat seleccionado
  agregarMensaje: (chatId: string, mensaje: ChatMessage) => void; // añade un mensaje al final
  actualizarMensaje: ( // aplica cambios parciales a un mensaje (estado, error, contenido…)
    chatId: string,
    mensajeId: string,
    patch: Partial<Omit<ChatMessage, 'id' | 'role'>>,
  ) => void;
  agregarDelta: (chatId: string, mensajeId: string, delta: string) => void; // concatena un fragmento del streaming
  renombrarDesdePrimerMensaje: (chatId: string) => void; // genera el título a partir del primer mensaje del usuario
  quitarUltimoAsistenteFallido: (chatId: string) => void; // elimina la última respuesta con error/detenida (para reintentar)
  borrarHistorial: () => void; // elimina todos los chats
}

// Devuelve una copia del chat con `updatedAt` actualizado (para ordenar/mostrar actividad reciente).
function tocar(chat: Chat): Chat {
  return { ...chat, updatedAt: Date.now() };
}

// Store global de chats, persistido en localStorage mediante el middleware `persist`.
export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      chats: [],
      activeId: null,

      // Crea un chat nuevo al inicio de la lista y lo deja activo.
      crearChat: (modo) => {
        const ahora = Date.now();
        const chat: Chat = {
          id: nuevoId(),
          title: 'Nuevo chat', // título provisional hasta el primer mensaje
          mode: modo,
          messages: [],
          createdAt: ahora,
          updatedAt: ahora,
        };

        set((estado) => ({ chats: [chat, ...estado.chats], activeId: chat.id }));
        return chat.id;
      },

      // Selecciona el chat visible.
      setActivo: (id) => set({ activeId: id }),

      // Añade un mensaje; el modo del chat pasa a ser el del último mensaje.
      agregarMensaje: (chatId, mensaje) =>
        set((estado) => ({
          chats: estado.chats.map((chat) =>
            chat.id === chatId
              ? tocar({
                  ...chat,
                  mode: mensaje.mode,
                  messages: [...chat.messages, mensaje],
                })
              : chat,
          ),
        })),

      // Fusiona `patch` sobre el mensaje indicado (actualización inmutable).
      actualizarMensaje: (chatId, mensajeId, patch) =>
        set((estado) => ({
          chats: estado.chats.map((chat) =>
            chat.id === chatId
              ? tocar({
                  ...chat,
                  messages: chat.messages.map((mensaje) =>
                    mensaje.id === mensajeId ? { ...mensaje, ...patch } : mensaje,
                  ),
                })
              : chat,
          ),
        })),

      // Agrega un fragmento de texto recibido por streaming al mensaje del asistente.
      agregarDelta: (chatId, mensajeId, delta) =>
        set((estado) => ({
          chats: estado.chats.map((chat) =>
            chat.id === chatId
              ? tocar({
                  ...chat,
                  messages: chat.messages.map((mensaje) =>
                    mensaje.id === mensajeId
                      ? {
                          ...mensaje,
                          content: mensaje.content + delta, // concatena el nuevo trozo
                          status: 'streaming',
                        }
                      : mensaje,
                  ),
                })
              : chat,
          ),
        })),

      // Si el chat aún se llama "Nuevo chat", usa el primer mensaje del usuario como título (máx. 48 caracteres).
      renombrarDesdePrimerMensaje: (chatId) =>
        set((estado) => ({
          chats: estado.chats.map((chat) => {
            if (chat.id !== chatId) return chat;
            if (chat.title !== 'Nuevo chat') return chat; // ya tiene título propio

            const primero = chat.messages.find((mensaje) => mensaje.role === 'user');
            if (!primero) return chat;

            const limpio = primero.content.trim().replace(/\s+/g, ' '); // colapsa saltos de línea y espacios
            const titulo = limpio.length > 48 ? `${limpio.slice(0, 48)}…` : limpio; // trunca con elipsis

            return titulo ? tocar({ ...chat, title: titulo }) : chat;
          }),
        })),

      // Antes de reintentar, quita la última respuesta del asistente si terminó en error o fue detenida.
      quitarUltimoAsistenteFallido: (chatId) =>
        set((estado) => ({
          chats: estado.chats.map((chat) => {
            if (chat.id !== chatId) return chat;

            const mensajes = [...chat.messages];
            const ultimo = mensajes[mensajes.length - 1];
            if (
              ultimo &&
              ultimo.role === 'assistant' &&
              (ultimo.status === 'error' || ultimo.status === 'stopped')
            ) {
              mensajes.pop();
            }

            return tocar({ ...chat, messages: mensajes });
          }),
        })),

      // Vacía todo el historial y vuelve a la pantalla de inicio.
      borrarHistorial: () => set({ chats: [], activeId: null }),
    }),
    {
      name: STORAGE_KEYS.chats, // clave en localStorage
      version: 1, // versión del esquema persistido
      storage: createJSONStorage(crearAlmacenamiento), // almacenamiento seguro (con fallback si localStorage falla)
      merge: (persistido, actual) => ({ ...actual, ...migrarEstado(persistido) }), // sanea/migra al rehidratar
    },
  ),
);
