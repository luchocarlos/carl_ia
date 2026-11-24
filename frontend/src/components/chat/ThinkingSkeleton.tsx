import { APP_NAME } from '../../config';

/** Esqueleto animado (shimmer) mientras la IA piensa y aún no llega el primer fragmento. */
export function ThinkingSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-2.5 py-1">
      {/* ── Texto solo para lectores de pantalla ── */}
      <span className="sr-only">{APP_NAME} está pensando</span>
      {/* ── Tres líneas de ancho decreciente con retraso escalonado ── */}
      <div className="h-3 w-11/12 animate-shimmer rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.06),rgba(255,255,255,0.14),rgba(255,255,255,0.06))] bg-[length:200%_100%]" />
      <div className="h-3 w-3/4 animate-shimmer rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.06),rgba(255,255,255,0.14),rgba(255,255,255,0.06))] bg-[length:200%_100%] [animation-delay:120ms]" />
      <div className="h-3 w-1/2 animate-shimmer rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.06),rgba(255,255,255,0.14),rgba(255,255,255,0.06))] bg-[length:200%_100%] [animation-delay:240ms]" />
    </div>
  );
}
