import { GLOBAL_STATUS_LABEL } from '../../config';
import { cn } from '../../lib/cn';
import { textoReinicio } from '../../lib/time';
import {
  colorDeConsumo,
  estadoDeConsumo,
  etiquetaDeConsumo,
  porcentajeConsumo,
} from '../../lib/usage';
import { useUsageStore } from '../../store/usageStore';

// Barras de progreso del consumo: puntos personales del día y ocupación del cupo global
export function UsageBars() {
  const usado = useUsageStore((estado) => estado.usado); // puntos gastados hoy
  const limite = useUsageStore((estado) => estado.limite); // máximo diario
  const globalPct = useUsageStore((estado) => estado.globalPct); // % del cupo global usado
  const globalStatus = useUsageStore((estado) => estado.globalStatus); // libre / ocupado / lleno

  const estado = estadoDeConsumo(usado, limite); // nivel del consumo personal (para color y texto)
  const pct = porcentajeConsumo(usado, limite); // ancho de la barra personal
  // Color de la barra global: rojo lleno, ámbar ocupado, verde libre
  const colorGlobal =
    globalStatus === 'lleno'
      ? 'bg-red-400'
      : globalStatus === 'ocupado'
        ? 'bg-amber-400'
        : 'bg-emerald-400';

  return (
    <div className="space-y-4">
      {/* ── Consumo personal del día ── */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-foreground">Tu consumo hoy</span>
          <span className="tabular-nums text-[11px] text-muted">
            {usado}/{limite} pts
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Tu consumo hoy"
          aria-valuenow={usado}
          aria-valuemin={0}
          aria-valuemax={limite}
          aria-valuetext={`${usado} de ${limite} puntos`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className={cn('h-full rounded-full transition-all duration-500', colorDeConsumo(estado))}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* ── Etiqueta de nivel y hora de reinicio ── */}
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted">
          <span>{etiquetaDeConsumo(estado)}</span>
          <span className="text-right">{textoReinicio()}</span>
        </div>
      </div>

      {/* ── Cupo global del servicio ── */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-foreground">Cupo global</span>
          <span className="tabular-nums text-[11px] text-muted">{globalPct}%</span>
        </div>

        <div
          role="progressbar"
          aria-label="Cupo global"
          aria-valuenow={globalPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${globalPct}% del cupo global`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className={cn('h-full rounded-full transition-all duration-500', colorGlobal)}
            style={{ width: `${globalPct}%` }}
          />
        </div>

        <div className="mt-1.5 text-[10px] text-muted">{GLOBAL_STATUS_LABEL[globalStatus]}</div>
      </div>
    </div>
  );
}
