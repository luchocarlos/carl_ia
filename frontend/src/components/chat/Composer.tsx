import { ArrowUp, Square } from 'lucide-react';
import { type KeyboardEvent, useEffect } from 'react';
import { APP_NAME, COSTS, MAX_INPUT_CHARS } from '../../config';
import { useAutoResize } from '../../hooks/useAutoResize';
import { cn } from '../../lib/cn';
import { textoReinicio } from '../../lib/time';
import { useToastStore } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';
import { useUsageStore } from '../../store/usageStore';
import type { Mode } from '../../types';
import { ModeSelector } from './ModeSelector';

// Props del composer: estado de envío y callbacks para enviar o detener la respuesta
interface Props {
  enviando: boolean; // true mientras la IA está respondiendo
  onEnviar: (modo: Mode, texto: string) => void;
  onDetener: () => void;
}

// Texto de ayuda del textarea según el modo seleccionado
const PLACEHOLDERS: Record<Mode, string> = {
  text: 'Pega código, un error o describe lo que quieres construir…',
  document: 'Pega notas o pide documentación técnica…',
};

// Caja de escritura inferior: textarea autoajustable, selector de modo,
// contador de caracteres y botón de enviar/detener. Bloquea el envío si no hay cupo.
export function Composer({ enviando, onEnviar, onDetener }: Props) {
  const modo = useUiStore((estado) => estado.modo); // modo actual: texto o documento
  const borrador = useUiStore((estado) => estado.borrador); // texto escrito (persistido en el store)
  const setBorrador = useUiStore((estado) => estado.setBorrador);
  const focoToken = useUiStore((estado) => estado.focoToken); // contador que se incrementa para pedir foco
  const agregar = useToastStore((estado) => estado.agregar); // muestra notificaciones

  const usado = useUsageStore((estado) => estado.usado); // puntos consumidos hoy
  const limite = useUsageStore((estado) => estado.limite); // límite diario de puntos
  const globalStatus = useUsageStore((estado) => estado.globalStatus); // estado del cupo global del servicio

  const ref = useAutoResize(borrador); // ref del textarea que crece con el contenido
  const costo = COSTS[modo]; // puntos que cuesta enviar en este modo
  const bloqueado = usado + costo > limite || globalStatus === 'lleno'; // sin cupo personal o global
  const excedido = borrador.length >= MAX_INPUT_CHARS; // se alcanzó el máximo de caracteres

  // Enfoca el textarea cada vez que otro componente pide foco (focoToken cambia)
  useEffect(() => {
    if (focoToken > 0) ref.current?.focus();
  }, [focoToken, ref]);

  // Valida y envía el borrador; si no hay cupo avisa con un toast
  function enviar() {
    const texto = borrador.trim();
    if (!texto || enviando) return; // nada que enviar o ya hay una respuesta en curso

    if (bloqueado) {
      agregar({
        tono: 'error',
        mensaje:
          globalStatus === 'lleno'
            ? 'El cupo global está lleno. Inténtalo más tarde.'
            : `Límite diario alcanzado. ${textoReinicio()}.`,
      });
      return;
    }

    onEnviar(modo, texto);
    setBorrador(''); // limpia la caja tras enviar
  }

  // Enter envía; Shift+Enter hace salto de línea; se ignora durante composición IME
  function alPresionarTecla(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      enviar();
    }
  }

  return (
    <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
      {/* ── Tarjeta del composer ── */}
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.055] p-2 shadow-glow backdrop-blur-xl">
        {/* ── Área de texto ── */}
        <label htmlFor="entrada-carl" className="sr-only">
          Mensaje para {APP_NAME}
        </label>
        <textarea
          id="entrada-carl"
          ref={ref}
          value={borrador}
          rows={1}
          maxLength={MAX_INPUT_CHARS}
          onChange={(evento) => setBorrador(evento.target.value)}
          onKeyDown={alPresionarTecla}
          placeholder={PLACEHOLDERS[modo]}
          aria-describedby="contador-carl"
          className="max-h-[200px] w-full resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted/70 focus:outline-none"
        />

        {/* ── Barra de acciones: modo, contador y botón ── */}
        <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
          <ModeSelector />

          <div className="flex items-center gap-2">
            {/* ── Contador de caracteres ── */}
            <span
              id="contador-carl"
              aria-live="polite"
              className={cn(
                'tabular-nums text-[11px]',
                excedido ? 'text-red-400' : 'text-muted',
              )}
            >
              {borrador.length}/{MAX_INPUT_CHARS}
            </span>

            {/* ── Botón Detener (durante streaming) o Enviar ── */}
            {enviando ? (
              <button
                type="button"
                onClick={onDetener}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                <Square size={12} aria-hidden="true" />
                Detener
              </button>
            ) : (
              <button
                type="button"
                onClick={enviar}
                disabled={!borrador.trim()}
                aria-label="Enviar mensaje"
                className="grid h-9 w-9 place-items-center rounded-xl bg-accent-gradient text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                <ArrowUp size={17} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Aviso de cupo agotado ── */}
      {bloqueado && (
        <p role="status" className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-amber-300">
          {globalStatus === 'lleno'
            ? 'El cupo global está lleno. Inténtalo más tarde.'
            : `Límite diario alcanzado. ${textoReinicio()}.`}
        </p>
      )}

      {/* ── Descargo de responsabilidad ── */}
      <p className="mt-1.5 text-center text-[11px] text-muted/65">
        {APP_NAME} solo responde sobre programación y puede equivocarse.
      </p>
    </div>
  );
}
