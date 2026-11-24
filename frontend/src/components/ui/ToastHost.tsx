import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '../../lib/cn';
import { useToastStore, type Toast } from '../../store/toastStore';

// Clases de color (borde, fondo, texto) según el tono del aviso
const ESTILOS: Record<Toast['tono'], string> = {
  error: 'border-red-400/30 bg-[#2a1013]/95 text-red-100',
  info: 'border-white/15 bg-panel/95 text-foreground',
  exito: 'border-emerald-400/30 bg-[#0c2318]/95 text-emerald-100',
};

// Icono que acompaña a cada tono
const ICONOS = {
  error: AlertCircle,
  info: Info,
  exito: CheckCircle2,
} as const;

// Un aviso individual animado que se cierra solo tras unos segundos
function ToastItem({ toast, reducido }: { toast: Toast; reducido: boolean }) {
  const quitar = useToastStore((estado) => estado.quitar); // elimina el aviso del store

  // Auto-cierre: 9 s si tiene acción (para dar tiempo a pulsarla), 5 s si no
  useEffect(() => {
    const temporizador = window.setTimeout(
      () => quitar(toast.id),
      toast.accion ? 9000 : 5000,
    );
    return () => window.clearTimeout(temporizador);
  }, [quitar, toast.id, toast.accion]);

  const Icono = ICONOS[toast.tono];

  return (
    <motion.div
      layout
      role={toast.tono === 'error' ? 'alert' : 'status'}
      initial={reducido ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={reducido ? undefined : { opacity: 1, y: 0, scale: 1 }}
      exit={reducido ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-3 py-2.5 shadow-xl backdrop-blur-xl',
        ESTILOS[toast.tono],
      )}
    >
      {/* ── Icono y mensaje ── */}
      <Icono size={16} className="mt-0.5 shrink-0" aria-hidden="true" />

      <p className="min-w-0 flex-1 text-xs leading-relaxed">{toast.mensaje}</p>

      {/* ── Acción opcional (p. ej. "Deshacer"): ejecuta y cierra el aviso ── */}
      {toast.accion && (
        <button
          type="button"
          onClick={() => {
            toast.accion?.onClick();
            quitar(toast.id);
          }}
          className="shrink-0 rounded-md border border-white/20 px-2 py-1 text-[11px] font-medium transition hover:bg-white/10"
        >
          {toast.accion.etiqueta}
        </button>
      )}

      {/* ── Botón cerrar ── */}
      <button
        type="button"
        onClick={() => quitar(toast.id)}
        aria-label="Cerrar aviso"
        className="shrink-0 rounded-md p-0.5 opacity-70 transition hover:opacity-100"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </motion.div>
  );
}

// Contenedor fijo de notificaciones, situado sobre el composer; apila los toasts activos
export function ToastHost() {
  const toasts = useToastStore((estado) => estado.toasts); // avisos visibles
  const reducido = useReducedMotion(); // desactiva animaciones si el usuario lo prefiere

  return (
    <div
      aria-label="Notificaciones"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+8.5rem)] z-[70] flex flex-col items-center gap-2 px-3 sm:bottom-32"
    >
      {/* ── Pila de avisos con animación de entrada/salida ── */}
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} reducido={Boolean(reducido)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
