import { AlertCircle, Ban, User } from 'lucide-react';
import { APP_NAME } from '../../config';
import { cn } from '../../lib/cn';
import type { ChatMessage } from '../../types';
import { DocumentResult } from './DocumentResult';
import { Markdown } from './Markdown';
import { ThinkingSkeleton } from './ThinkingSkeleton';

// Props: el mensaje a mostrar y el título del chat (se usa para nombrar descargas)
interface Props {
  mensaje: ChatMessage;
  tituloChat: string;
}

// Un mensaje de la conversación (usuario o asistente) con avatar, cabecera y cuerpo
export function MessageItem({ mensaje, tituloChat }: Props) {
  const esUsuario = mensaje.role === 'user'; // distingue mensaje propio de respuesta de la IA
  const streaming = mensaje.status === 'streaming'; // la respuesta aún se está recibiendo
  const vacio = !mensaje.content.trim(); // todavía no llegó contenido

  // Decide qué mostrar en la respuesta del asistente: esqueleto, detenido, error o contenido
  function cuerpoAsistente() {
    if (vacio && streaming) return <ThinkingSkeleton />; // esperando el primer fragmento

    if (vacio) {
      // Sin contenido y sin streaming: el usuario la detuvo o hubo un error
      if (mensaje.status === 'stopped') {
        return (
          <p className="inline-flex items-center gap-2 text-sm text-muted">
            <Ban size={15} aria-hidden="true" />
            Respuesta detenida.
          </p>
        );
      }

      return (
        <p className="inline-flex items-center gap-2 text-sm text-red-300">
          <AlertCircle size={15} aria-hidden="true" />
          {mensaje.error ?? 'No se pudo completar la respuesta.'}
        </p>
      );
    }

    return (
      <div>
        {/* ── Contenido: documento descargable o Markdown normal ── */}
        {mensaje.mode === 'document' ? (
          <DocumentResult contenido={mensaje.content} titulo={tituloChat} />
        ) : (
          <Markdown>{mensaje.content}</Markdown>
        )}
        {/* ── Cursor parpadeante mientras llega el texto ── */}
        {streaming && (
          <span
            className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-foreground align-middle"
            aria-hidden="true"
          />
        )}
      </div>
    );
  }

  return (
    <article
      className="flex gap-3 sm:gap-4"
      aria-label={esUsuario ? 'Tu mensaje' : `Respuesta de ${APP_NAME}`}
    >
      {/* ── Avatar: icono de usuario o inicial de la app ── */}
      <div
        className={cn(
          'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
          esUsuario
            ? 'border border-white/10 bg-white/5 text-muted'
            : 'bg-accent-gradient text-white',
        )}
        aria-hidden="true"
      >
        {esUsuario ? <User size={14} /> : APP_NAME.charAt(0)}
      </div>

      <div className="min-w-0 flex-1">
        {/* ── Cabecera: autor y estado (escribiendo / detenido) ── */}
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className="font-medium text-foreground">{esUsuario ? 'Tú' : APP_NAME}</span>
          {streaming && <span className="text-muted">escribiendo…</span>}
          {mensaje.status === 'stopped' && (
            <span className="inline-flex items-center gap-1 text-muted">
              <Ban size={11} aria-hidden="true" />
              Detenido
            </span>
          )}
        </div>

        {/* ── Cuerpo: burbuja de texto plano (usuario) o respuesta renderizada (IA) ── */}
        <div
          aria-live={esUsuario ? undefined : 'polite'}
          className={cn(
            'text-sm leading-relaxed text-foreground/95',
            esUsuario &&
              'whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-white/5 bg-white/[0.04] px-3.5 py-2.5',
          )}
        >
          {esUsuario ? mensaje.content : cuerpoAsistente()}
        </div>
      </div>
    </article>
  );
}
