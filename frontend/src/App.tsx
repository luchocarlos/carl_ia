import { useCallback, useEffect } from 'react';
import { Composer } from './components/chat/Composer';
import { EmptyState } from './components/chat/EmptyState';
import { MessageList } from './components/chat/MessageList';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { ToastHost } from './components/ui/ToastHost';
import { useEnviarMensaje } from './hooks/useEnviarMensaje';
import { cn } from './lib/cn';
import { aiClient } from './services';
import { useChatStore } from './store/chatStore';
import { useUiStore } from './store/uiStore';
import { useUsageStore } from './store/usageStore';

// Componente raíz: arma el layout (sidebar, cabecera, conversación y composer)
// y sincroniza el consumo diario con el backend al iniciar.
export default function App() {
  const chats = useChatStore((estado) => estado.chats); // lista de conversaciones guardadas
  const activeId = useChatStore((estado) => estado.activeId); // id del chat seleccionado
  const colapsado = useUiStore((estado) => estado.sidebarColapsado); // sidebar reducida en escritorio
  const setConexion = useUiStore((estado) => estado.setConexion); // actualiza el estado de conexión del backend
  const reiniciarSiCambioDia = useUsageStore((estado) => estado.reiniciarSiCambioDia); // resetea el consumo al cambiar de día
  const reconciliar = useUsageStore((estado) => estado.reconciliar); // ajusta el consumo local con los datos del servidor

  const { enviando, enviar, detener } = useEnviarMensaje(); // envío de mensajes en streaming y su cancelación
  const activo = chats.find((chat) => chat.id === activeId) ?? null; // chat activo (o null si no hay)

  // Consulta el consumo al backend y refleja si hay conexión o no
  const sincronizarUso = useCallback(async () => {
    try {
      const data = await aiClient.usage();
      reconciliar(data);
      setConexion('conectado');
    } catch {
      setConexion('sin-conexion'); // cualquier fallo de red se trata como backend caído
    }
  }, [reconciliar, setConexion]);

  // Al montar: sincroniza el consumo y revisa cada minuto si cambió el día
  useEffect(() => {
    reiniciarSiCambioDia();
    void sincronizarUso();

    const temporizador = window.setInterval(() => {
      reiniciarSiCambioDia();
    }, 60_000); // cada 60 s

    return () => window.clearInterval(temporizador); // limpia el intervalo al desmontar
  }, [reiniciarSiCambioDia, sincronizarUso]);

  return (
    <div className="min-h-dvh bg-ink text-foreground">
      {/* ── Enlace de accesibilidad: saltar al contenido (visible solo con foco) ── */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-panel focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:outline focus:outline-2 focus:outline-indigo-300"
      >
        Saltar al contenido
      </a>

      {/* ── Barra lateral (historial y consumo) ── */}
      <Sidebar />

      {/* ── Columna principal: deja espacio según el ancho de la sidebar ── */}
      <div
        className={cn(
          'flex h-dvh flex-col transition-[padding] duration-200',
          colapsado ? 'md:pl-[76px]' : 'md:pl-[268px]',
        )}
      >
        {/* ── Encabezado superior ── */}
        <Header titulo={activo?.title} />

        {/* ── Conversación o pantalla de bienvenida ── */}
        <main id="contenido" className="flex-1 overflow-y-auto overscroll-contain">
          {activo && activo.messages.length > 0 ? (
            <MessageList chat={activo} />
          ) : (
            <EmptyState />
          )}
        </main>

        {/* ── Caja de escritura del mensaje ── */}
        <Composer
          enviando={enviando}
          onEnviar={(modo, texto) => void enviar(modo, texto)}
          onDetener={detener}
        />
      </div>

      {/* ── Capas flotantes: notificaciones y diálogo de confirmación ── */}
      <ToastHost />
      <ConfirmDialog />
    </div>
  );
}
