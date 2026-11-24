import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useUiStore } from '../../store/uiStore';

// Diálogo modal accesible para confirmar el borrado de todo el historial.
// Atrapa el foco dentro del diálogo, cierra con Escape y devuelve el foco al salir.
export function ConfirmDialog() {
  const abierto = useUiStore((estado) => estado.confirmarBorrado); // controla la visibilidad
  const cerrar = useUiStore((estado) => estado.cerrarConfirmacion);
  const borrarHistorial = useChatStore((estado) => estado.borrarHistorial);
  const dialogoRef = useRef<HTMLDivElement>(null); // contenedor del diálogo para buscar enfocables

  // Gestión del foco y teclado mientras el diálogo está abierto
  useEffect(() => {
    if (!abierto) return;

    const previo = document.activeElement as HTMLElement | null; // elemento a re-enfocar al cerrar

    // Devuelve los elementos enfocables dentro del diálogo
    const enfocables = () =>
      Array.from(
        dialogoRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    enfocables()[0]?.focus(); // foco inicial en el primer botón

    // Escape cierra; Tab / Shift+Tab hacen ciclo entre el primer y el último enfocable
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        cerrar();
        return;
      }

      if (evento.key !== 'Tab') return;

      const lista = enfocables();
      if (!lista.length) return;

      const primero = lista[0];
      const ultimo = lista[lista.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus(); // desde el primero, Shift+Tab salta al último
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus(); // desde el último, Tab vuelve al primero
      }
    }

    document.addEventListener('keydown', alPresionar);

    return () => {
      document.removeEventListener('keydown', alPresionar);
      previo?.focus(); // restaura el foco donde estaba antes de abrir
    };
  }, [abierto, cerrar]);

  if (!abierto) return null; // cerrado: no se renderiza nada

  // Confirma: borra el historial y cierra el diálogo
  function borrar() {
    borrarHistorial();
    cerrar();
  }

  return (
    // Fondo: un clic fuera del diálogo (sobre el propio fondo) lo cierra
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) cerrar();
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        aria-describedby="confirmar-descripcion"
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-5 shadow-2xl"
      >
        {/* ── Icono de advertencia, título y descripción ── */}
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-300">
            <AlertTriangle size={17} aria-hidden="true" />
          </span>
          <div>
            <h3 id="confirmar-titulo" className="text-sm font-semibold text-foreground">
              ¿Borrar todo el historial?
            </h3>
            <p id="confirmar-descripcion" className="mt-1 text-xs leading-relaxed text-muted">
              Se eliminarán todas las conversaciones guardadas en este navegador. Tu consumo
              diario no cambia.
            </p>
          </div>
        </div>

        {/* ── Botones Cancelar / Borrar todo ── */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={borrar}
            className="rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500"
          >
            Borrar todo
          </button>
        </div>
      </div>
    </div>
  );
}
