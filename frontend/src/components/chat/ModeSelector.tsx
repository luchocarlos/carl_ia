import { Code2, FileCode2 } from 'lucide-react';
import { MODES } from '../../config';
import { cn } from '../../lib/cn';
import { useUiStore } from '../../store/uiStore';
import type { Mode } from '../../types';

// Icono de cada modo en el selector
const ICONOS: Record<Mode, typeof Code2> = {
  text: Code2,
  document: FileCode2,
};

// Selector segmentado para elegir el tipo de solicitud (código o documentación)
export function ModeSelector() {
  const modo = useUiStore((estado) => estado.modo); // modo seleccionado actualmente
  const setModo = useUiStore((estado) => estado.setModo);

  return (
    <div
      role="group"
      aria-label="Tipo de solicitud"
      className="inline-flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/20 p-0.5"
    >
      {/* ── Un botón conmutador por modo ── */}
      {MODES.map((opcion) => {
        const Icono = ICONOS[opcion.id];
        const activo = modo === opcion.id; // resalta la opción elegida

        return (
          <button
            key={opcion.id}
            type="button"
            aria-pressed={activo}
            title={opcion.hint}
            onClick={() => setModo(opcion.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-[11px] font-medium transition sm:px-2.5',
              activo
                ? 'bg-white/10 text-foreground shadow-sm'
                : 'text-muted hover:bg-white/5 hover:text-foreground',
            )}
          >
            <Icono size={13} aria-hidden="true" />
            <span>{opcion.label}</span>
          </button>
        );
      })}
    </div>
  );
}
