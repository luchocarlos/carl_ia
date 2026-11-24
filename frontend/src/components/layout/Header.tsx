import { Menu, ShieldCheck } from 'lucide-react';
import { usandoMock } from '../../services';
import { useUiStore } from '../../store/uiStore';

// Cabecera fija superior: botón de menú (móvil), título del chat y estado del servicio
export function Header({ titulo }: { titulo?: string }) {
  const abrirSidebar = useUiStore((estado) => estado.abrirSidebar); // abre la sidebar en móvil
  const conexion = useUiStore((estado) => estado.conexion); // estado de conexión con el backend

  // Texto de estado: modo demo (mock) o estado real de la conexión
  const estado = usandoMock
    ? 'Modo demostración'
    : conexion === 'conectado'
      ? 'Servicio conectado'
      : conexion === 'sin-conexion'
        ? 'Backend sin conexión'
        : 'Conectando…';

  return (
    <header className="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 border-b border-white/5 bg-ink/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-4">
      {/* ── Botón hamburguesa (solo móvil) ── */}
      <button
        type="button"
        onClick={abrirSidebar}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-foreground md:hidden"
        aria-label="Abrir menú"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {/* ── Título del chat y estado de conexión ── */}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-medium text-foreground">{titulo || 'Nuevo chat'}</h2>
        <p className="truncate text-[10px] text-muted">
          {estado}
        </p>
      </div>

      {/* ── Insignia de seguridad (oculta en pantallas pequeñas) ── */}
      <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-muted sm:inline-flex">
        <ShieldCheck size={12} aria-hidden="true" />
        Sin claves en el navegador
      </span>
    </header>
  );
}
