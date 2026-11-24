import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Code2, FileCode2, Sparkles } from 'lucide-react';
import { APP_TAGLINE, SUGGESTIONS } from '../../config';
import { useUiStore } from '../../store/uiStore';
import type { Mode } from '../../types';

// Icono asociado a cada modo para las tarjetas de sugerencias
const ICONOS: Record<Mode, typeof Code2> = {
  text: Code2,
  document: FileCode2,
};

// Pantalla de bienvenida cuando no hay mensajes: título, lema y tarjetas
// de sugerencias que precargan un prompt en el composer
export function EmptyState() {
  const setModo = useUiStore((estado) => estado.setModo);
  const setBorrador = useUiStore((estado) => estado.setBorrador);
  const pedirFoco = useUiStore((estado) => estado.pedirFoco); // solicita foco en el textarea del composer
  const reducido = useReducedMotion(); // respeta la preferencia de "reducir movimiento"

  // Al elegir una sugerencia: cambia el modo, rellena el borrador y enfoca la caja
  function elegir(modo: Mode, prompt: string) {
    setModo(modo);
    setBorrador(prompt);
    pedirFoco();
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-6 pt-8 text-center sm:pt-14">
      {/* ── Insignia superior ── */}
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">
        <Sparkles size={13} aria-hidden="true" />
        Código · Documentación
      </div>

      {/* ── Título con palabra destacada en degradado ── */}
      <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        ¿Qué{' '}
        <span className="bg-accent-gradient bg-clip-text text-transparent">programamos</span>{' '}
        hoy?
      </h1>

      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
        {APP_TAGLINE}
      </p>

      {/* ── Cuadrícula de sugerencias (entrada escalonada) ── */}
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((sugerencia, indice) => {
          const Icono = ICONOS[sugerencia.mode];

          return (
            <motion.button
              key={sugerencia.id}
              type="button"
              onClick={() => elegir(sugerencia.mode, sugerencia.prompt)}
              initial={reducido ? false : { opacity: 0, y: 10 }}
              animate={reducido ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: indice * 0.05 }}
              className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-muted transition group-hover:text-foreground">
                <Icono size={15} aria-hidden="true" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{sugerencia.title}</span>
                  <ArrowUpRight
                    size={14}
                    className="shrink-0 text-muted opacity-0 transition group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  {sugerencia.description}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* ── Aviso de privacidad ── */}
      <p className="mt-7 max-w-md text-[11px] leading-relaxed text-muted/75">
        Privacidad: tus mensajes se envían a un servicio externo de IA. Evita compartir datos
        personales o confidenciales.
      </p>
    </section>
  );
}
