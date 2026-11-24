import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../config';
import { crearMensaje, useChatStore } from './chatStore';

// Cada test parte de un almacenamiento y un store vacíos.
beforeEach(() => {
  localStorage.clear();
  useChatStore.setState({ chats: [], activeId: null });
});

// Pruebas de guardado, rehidratación y migración del historial de chats.
describe('persistencia del historial', () => {
  // Crea un chat, verifica que se escribe en localStorage y que se recupera tras vaciar el store.
  it('guarda los chats y los rehidrata desde localStorage', async () => {
    const chatId = useChatStore.getState().crearChat('text');
    useChatStore
      .getState()
      .agregarMensaje(chatId, crearMensaje({ role: 'user', mode: 'text', content: 'Hola Carl' }));
    useChatStore.getState().renombrarDesdePrimerMensaje(chatId);

    const crudo = localStorage.getItem(STORAGE_KEYS.chats); // JSON persistido por zustand
    expect(crudo).toContain('Hola Carl');
    expect(useChatStore.getState().chats[0].title).toBe('Hola Carl'); // título tomado del primer mensaje

    // Simula una recarga: se vacía el store y se rehidrata desde lo guardado
    useChatStore.setState({ chats: [], activeId: null });
    localStorage.setItem(STORAGE_KEYS.chats, crudo ?? '');
    await useChatStore.persist.rehydrate();

    expect(useChatStore.getState().chats).toHaveLength(1);
    expect(useChatStore.getState().chats[0].messages[0].content).toBe('Hola Carl');
  });

  // Un chat del antiguo modo imagen debe eliminarse y el activeId que apuntaba a él quedar en null.
  it('descarta el antiguo modo imagen al rehidratar', async () => {
    localStorage.setItem(
      STORAGE_KEYS.chats,
      JSON.stringify({
        state: {
          activeId: 'chat-imagen', // apunta al chat que será descartado
          chats: [
            {
              id: 'chat-codigo',
              title: 'Depurar error',
              mode: 'text',
              messages: [
                {
                  id: 'm1',
                  role: 'user',
                  mode: 'text',
                  content: '¿Por qué falla mi test?',
                  createdAt: 1,
                  status: 'done',
                },
              ],
              createdAt: 1,
              updatedAt: 1,
            },
            {
              id: 'chat-imagen',
              title: 'Imagen antigua',
              mode: 'image',
              messages: [
                {
                  id: 'm2',
                  role: 'assistant',
                  mode: 'image',
                  content: '',
                  image: { url: 'mock://gradient/gato-azul', prompt: 'Un gato azul' },
                  createdAt: 2,
                  status: 'done',
                },
              ],
              createdAt: 2,
              updatedAt: 2,
            },
          ],
        },
        version: 1,
      }),
    );

    await useChatStore.persist.rehydrate();

    const { chats, activeId } = useChatStore.getState();
    expect(chats.map((chat) => chat.id)).toEqual(['chat-codigo']); // solo sobrevive el chat de texto
    expect(chats[0].mode).toBe('text');
    expect(activeId).toBeNull();
    expect(JSON.stringify(chats)).not.toContain('mock://gradient'); // no quedan restos de imágenes
  });

  // borrarHistorial deja el store sin chats ni chat activo.
  it('borra todo el historial', () => {
    const chatId = useChatStore.getState().crearChat('document');
    useChatStore
      .getState()
      .agregarMensaje(chatId, crearMensaje({ role: 'user', mode: 'document', content: 'Notas' }));

    useChatStore.getState().borrarHistorial();

    expect(useChatStore.getState().chats).toEqual([]);
    expect(useChatStore.getState().activeId).toBeNull();
  });
});
