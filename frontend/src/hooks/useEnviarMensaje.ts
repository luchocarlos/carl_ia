import { useCallback, useEffect, useRef, useState } from 'react';
import { COSTS, REQUEST_TIMEOUT_MS } from '../config';
import { textoReinicio } from '../lib/time';
import { aiClient, ApiError } from '../services';
import { crearMensaje, useChatStore } from '../store/chatStore';
import { useToastStore } from '../store/toastStore';
import { useUiStore } from '../store/uiStore';
import { useUsageStore } from '../store/usageStore';
import type { ChatRequestMessage, Mode } from '../types';

// Datos de la última solicitud enviada; se guardan para poder reintentarla.
interface UltimaSolicitud {
  chatId: string; // chat al que pertenecía la solicitud
  modo: Mode; // modo usado (texto / documento)
  prompt: string; // texto del usuario ya recortado
}

/**
 * Orquesta envío, streaming, timeout y respaldo de cuota.
 * Es el hook principal del chat: valida la cuota, crea los mensajes en el store,
 * llama al backend con streaming y traduce cada tipo de error en un aviso (toast).
 */
export function useEnviarMensaje() {
  const [enviando, setEnviando] = useState(false); // estado reactivo para la UI (deshabilitar input, mostrar "detener")
  const abortRef = useRef<AbortController | null>(null); // controlador para cancelar la petición en curso
  const ultimaRef = useRef<UltimaSolicitud | null>(null); // última solicitud, usada por "Reintentar"
  const enviandoRef = useRef(false); // bandera síncrona para evitar envíos dobles (el state llega tarde)
  const reintentarRef = useRef<() => void>(() => {}); // referencia estable a reintentar() para los toasts
  const avisar = useToastStore((estado) => estado.agregar); // muestra notificaciones
  const setConexion = useUiStore((estado) => estado.setConexion); // actualiza el indicador de conexión

  // Consulta el consumo real al backend y lo concilia con el contador local.
  const sincronizarUso = useCallback(async () => {
    try {
      const data = await aiClient.usage(); // GET de uso/cuota
      useUsageStore.getState().reconciliar(data);
      setConexion('conectado');
    } catch {
      setConexion('sin-conexion'); // si falla, solo marcamos la conexión; no interrumpe al usuario
    }
  }, [setConexion]);

  // Envía un mensaje (o reintenta el último) y gestiona todo el ciclo de vida de la respuesta.
  const ejecutar = useCallback(
    async (modo: Mode, prompt: string, reintento = false, chatDestino?: string) => {
      // --- 1. Validaciones previas ---
      if (enviandoRef.current) return; // ya hay una solicitud en curso

      const limpio = prompt.trim();
      if (!limpio) return; // no se envían mensajes vacíos

      // --- 2. Comprobación de cuota (diaria del usuario y global) ---
      useUsageStore.getState().reiniciarSiCambioDia(); // resetea el contador si cambió el día
      const uso = useUsageStore.getState();
      const costo = COSTS[modo]; // unidades que consume este modo

      if (!uso.puedeGastar(costo)) {
        avisar({
          tono: 'error',
          mensaje: `Límite diario alcanzado. ${textoReinicio()}.`,
        });
        return;
      }

      if (uso.globalStatus === 'lleno') {
        avisar({
          tono: 'error',
          mensaje: 'El cupo global está lleno. Inténtalo más tarde.',
        });
        return;
      }

      // --- 3. Resolver el chat destino (el indicado, el activo o uno nuevo) ---
      const existeDestino =
        chatDestino &&
        useChatStore.getState().chats.some((chat) => chat.id === chatDestino);

      let chatId = existeDestino ? chatDestino : useChatStore.getState().activeId;
      if (!chatId) chatId = useChatStore.getState().crearChat(modo); // no hay chat activo: se crea uno

      // --- 4. Registrar el mensaje del usuario (o limpiar el fallido si es reintento) ---
      if (reintento) {
        useChatStore.getState().quitarUltimoAsistenteFallido(chatId); // quita la respuesta con error/detenida
      } else {
        useChatStore.getState().agregarMensaje(
          chatId,
          crearMensaje({ role: 'user', mode: modo, content: limpio }),
        );
        useChatStore.getState().renombrarDesdePrimerMensaje(chatId); // título del chat a partir del primer mensaje
      }

      // --- 5. Crear el mensaje del asistente vacío, que se irá llenando con el streaming ---
      const asistente = crearMensaje({
        role: 'assistant',
        mode: modo,
        content: '',
        status: 'streaming',
      });
      useChatStore.getState().agregarMensaje(chatId, asistente);

      // --- 6. Preparar cancelación, estado de envío y timeout ---
      const controller = new AbortController();
      abortRef.current = controller;
      enviandoRef.current = true;
      setEnviando(true);
      ultimaRef.current = { chatId, modo, prompt: limpio }; // se guarda para "Reintentar"

      let agotado = false; // distingue un abort por timeout de uno manual (botón detener)
      const temporizador = window.setTimeout(() => {
        agotado = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      // Marca el mensaje del asistente como fallido con el texto indicado.
      const marcarError = (mensaje: string) => {
        useChatStore.getState().actualizarMensaje(chatId, asistente.id, {
          status: 'error',
          error: mensaje,
        });
      };

      try {
        // --- 7. Construir el historial que se manda al backend ---
        // Se excluyen el placeholder del asistente, mensajes vacíos y los que fallaron o se detuvieron.
        const chatActual = useChatStore.getState().chats.find((chat) => chat.id === chatId);
        const historial: ChatRequestMessage[] = (chatActual?.messages ?? [])
          .filter(
            (mensaje) =>
              mensaje.id !== asistente.id &&
              mensaje.content.trim().length > 0 &&
              mensaje.status !== 'error' &&
              mensaje.status !== 'stopped',
          )
          .map((mensaje) => ({ role: mensaje.role, content: mensaje.content })); // solo role + content

        // --- 8. Llamada al backend con streaming: cada fragmento se agrega al mensaje ---
        let recibido = ''; // acumulado para detectar respuestas vacías
        await aiClient.chat(modo, historial, {
          signal: controller.signal,
          onDelta: (delta) => {
            recibido += delta;
            useChatStore
              .getState()
              .agregarDelta(chatId, asistente.id, delta);
          },
        });

        if (!recibido.trim()) throw new Error('respuesta-vacia'); // se trata como error genérico

        // --- 9. Éxito: cerrar el mensaje y registrar el consumo ---
        useChatStore
          .getState()
          .actualizarMensaje(chatId, asistente.id, { status: 'done' });

        useUsageStore.getState().registrarConsumo(costo); // descuento optimista local
        void sincronizarUso(); // y luego se concilia con el backend (sin esperar)
      } catch (error) {
        // --- 10. Manejo de errores según su tipo ---
        if (agotado) {
          // Timeout propio
          marcarError('La solicitud tardó demasiado.');
          avisar({
            tono: 'error',
            mensaje: 'Tiempo de espera agotado (30 s).',
            accion: { etiqueta: 'Reintentar', onClick: () => reintentarRef.current() },
          });
        } else if (controller.signal.aborted) {
          // El usuario pulsó "detener": se conserva lo recibido y se marca como detenido
          useChatStore
            .getState()
            .actualizarMensaje(chatId, asistente.id, { status: 'stopped' });
        } else if (error instanceof ApiError && error.status === 429) {
          // Cuota agotada en el backend (global o del usuario)
          const global = error.code === 'quota_global';
          const mensaje = global
            ? 'El cupo global está lleno. Inténtalo más tarde.'
            : 'Alcanzaste tu límite diario.';

          if (global) {
            useUsageStore.setState({ globalStatus: 'lleno', globalPct: 100 });
          } else {
            useUsageStore.setState({ usado: useUsageStore.getState().limite }); // fuerza el contador al máximo
          }
          if (error.resetAt) useUsageStore.setState({ resetAt: error.resetAt }); // hora de reinicio informada por el backend

          marcarError(mensaje);
          avisar({
            tono: 'error',
            mensaje,
            accion: { etiqueta: 'Reintentar', onClick: () => reintentarRef.current() },
          });
          void sincronizarUso();
        } else if (error instanceof ApiError) {
          // Otro error HTTP con mensaje del backend
          const mensaje = error.message || 'No se pudo completar la respuesta.';
          marcarError(mensaje);
          avisar({
            tono: 'error',
            mensaje,
            accion: { etiqueta: 'Reintentar', onClick: () => reintentarRef.current() },
          });
        } else {
          // Error de red o respuesta vacía
          marcarError('No se pudo completar la respuesta.');
          avisar({
            tono: 'error',
            mensaje: 'No se pudo conectar con el servicio.',
            accion: { etiqueta: 'Reintentar', onClick: () => reintentarRef.current() },
          });
        }
      } finally {
        // --- 11. Limpieza: siempre se libera el estado de envío ---
        window.clearTimeout(temporizador);
        abortRef.current = null;
        enviandoRef.current = false;
        setEnviando(false);
      }
    },
    [avisar, sincronizarUso],
  );

  // Repite la última solicitud en su chat original, reemplazando la respuesta fallida.
  const reintentar = useCallback(() => {
    const ultima = ultimaRef.current;
    if (!ultima) return;
    void ejecutar(ultima.modo, ultima.prompt, true, ultima.chatId);
  }, [ejecutar]);

  // Mantiene la ref actualizada para que los toasts siempre llamen a la versión vigente.
  useEffect(() => {
    reintentarRef.current = reintentar;
  }, [reintentar]);

  // Cancela la respuesta en curso (botón "detener").
  const detener = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { enviando, enviar: ejecutar, detener, reintentar };
}
