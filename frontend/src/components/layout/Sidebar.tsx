import {
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { APP_NAME } from '../../config';
import { cn } from '../../lib/cn';
import { useChatStore } from '../../store/chatStore';
import { useUiStore } from '../../store/uiStore';
import { UsageBars } from '../usage/UsageBars';

// Barra lateral: logo, nuevo chat, historial de conversaciones, consumo y borrado.
// En móvil es un panel deslizable con fondo oscuro; en escritorio puede colapsarse.
export function Sidebar() {
  const chats = useChatStore((estado) => estado.chats); // conversaciones guardadas
  const activeId = useChatStore((estado) => estado.activeId); // id del chat abierto
  const crearChat = useChatStore((estado) => estado.crearChat);
  const setActivo = useChatStore((estado) => estado.setActivo);

  const movilAbierto = useUiStore((estado) => estado.sidebarMovil); // panel visible en móvil
  const colapsado = useUiStore((estado) => estado.sidebarColapsado); // modo compacto en escritorio
  const modo = useUiStore((estado) => estado.modo); // modo actual, se usa al crear un chat
  const cerrarSidebar = useUiStore((estado) => estado.cerrarSidebar);
  const alternarColapso = useUiStore((estado) => estado.alternarColapso);
  const setBorrador = useUiStore((estado) => estado.setBorrador);
  const pedirFoco = useUiStore((estado) => estado.pedirFoco); // enfoca el composer
  const abrirConfirmacion = useUiStore((estado) => estado.abrirConfirmacion); // abre el diálogo de borrado

  // Chats ordenados del más reciente al más antiguo (copia para no mutar el store)
  const ordenados = useMemo(
    () => [...chats].sort((a, b) => b.updatedAt - a.updatedAt),
    [chats],
  );

  // Con el panel móvil abierto: bloquea el scroll del body y cierra con Escape
  useEffect(() => {
    if (!movilAbierto) return;

    const anterior = document.body.style.overflow; // guarda el valor para restaurarlo
    document.body.style.overflow = 'hidden';

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrarSidebar();
    };
    document.addEventListener('keydown', alPresionar);

    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener('keydown', alPresionar);
    };
  }, [movilAbierto, cerrarSidebar]);

  // Crea un chat vacío, limpia el borrador, cierra el panel y enfoca el composer
  function nuevoChat() {
    crearChat(modo);
    setBorrador('');
    cerrarSidebar();
    pedirFoco();
  }

  // Selecciona un chat del historial y cierra el panel (en móvil)
  function abrirChat(id: string) {
    setActivo(id);
    cerrarSidebar();
  }

  return (
    <>
      {/* ── Fondo oscuro tras el panel en móvil (clic para cerrar) ── */}
      {movilAbierto && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={cerrarSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Barra lateral"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-white/10 bg-[#0b0b0e]/95 backdrop-blur-xl transition-[transform,width] duration-200',
          movilAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          colapsado ? 'md:w-[76px]' : 'md:w-[268px]',
        )}
      >
        {/* ── Cabecera: logo, nombre y botones cerrar/colapsar ── */}
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 px-3 pt-[env(safe-area-inset-top)]">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-gradient text-sm font-bold text-white"
              aria-hidden="true"
            >
              {APP_NAME.charAt(0)}
            </span>
            <span
              className={cn(
                'truncate text-sm font-semibold tracking-tight text-foreground',
                colapsado && 'md:hidden',
              )}
            >
              {APP_NAME}
            </span>
          </div>

          {/* ── Cerrar (solo móvil) ── */}
          <button
            type="button"
            onClick={cerrarSidebar}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-foreground md:hidden"
            aria-label="Cerrar menú"
          >
            <X size={17} aria-hidden="true" />
          </button>

          {/* ── Colapsar / expandir (solo escritorio) ── */}
          <button
            type="button"
            onClick={alternarColapso}
            className="hidden h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-foreground md:grid"
            aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
            aria-pressed={colapsado}
          >
            {colapsado ? (
              <PanelLeftOpen size={17} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={17} aria-hidden="true" />
            )}
          </button>
        </div>

        {/* ── Botón Nuevo chat ── */}
        <div className="px-2">
          <button
            type="button"
            onClick={nuevoChat}
            className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-sm font-medium text-foreground transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            title="Nuevo chat"
          >
            <Plus size={16} aria-hidden="true" />
            <span className={cn(colapsado && 'md:hidden')}>Nuevo chat</span>
          </button>
        </div>

        {/* ── Historial de conversaciones ── */}
        <nav aria-label="Historial de conversaciones" className="mt-4 flex-1 overflow-y-auto px-2">
          <p
            className={cn(
              'px-2 pb-1.5 text-[10px] uppercase tracking-wider text-muted/70',
              colapsado && 'md:hidden',
            )}
          >
            Historial
          </p>

          {ordenados.length === 0 ? (
            <p className={cn('px-2 text-xs leading-relaxed text-muted', colapsado && 'md:hidden')}>
              Aún no hay conversaciones.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {ordenados.map((chat) => {
                const activo = chat.id === activeId; // resalta el chat abierto

                return (
                  <li key={chat.id}>
                    <button
                      type="button"
                      onClick={() => abrirChat(chat.id)}
                      aria-current={activo ? 'true' : undefined}
                      title={chat.title}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition',
                        activo
                          ? 'bg-white/10 text-foreground'
                          : 'text-muted hover:bg-white/5 hover:text-foreground',
                      )}
                    >
                      <MessageSquare size={14} className="shrink-0" aria-hidden="true" />
                      <span className={cn('truncate', colapsado && 'md:hidden')}>{chat.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {/* ── Pie: barras de consumo, borrar historial y aviso de privacidad ── */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className={cn(colapsado && 'md:hidden')}>
            <UsageBars />
          </div>

          <button
            type="button"
            onClick={abrirConfirmacion}
            disabled={chats.length === 0}
            title="Borrar historial"
            className={cn(
              'mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40',
              colapsado && 'md:justify-center',
            )}
          >
            <Trash2 size={13} aria-hidden="true" />
            <span className={cn(colapsado && 'md:hidden')}>Borrar historial</span>
          </button>

          <p
            className={cn(
              'mt-3 text-[10px] leading-relaxed text-muted/65',
              colapsado && 'md:hidden',
            )}
          >
            Privacidad: los mensajes se envían a un servicio externo de IA.
          </p>
        </div>
      </aside>
    </>
  );
}
