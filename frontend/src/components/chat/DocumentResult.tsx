import { Download } from 'lucide-react';
import { descargarTexto, nombreSeguro } from '../../lib/download';
import { CopyButton } from './CopyButton';
import { Markdown } from './Markdown';

// Resultado del modo "documento": muestra el Markdown generado con botones
// para copiarlo o descargarlo como archivo .md (nombre basado en el título del chat)
export function DocumentResult({ contenido, titulo }: { contenido: string; titulo: string }) {
  return (
    <div>
      {/* ── Documento renderizado ── */}
      <Markdown>{contenido}</Markdown>

      {/* ── Acciones: copiar y descargar ── */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyButton texto={contenido} etiqueta="Copiar" />
        <button
          type="button"
          onClick={() => descargarTexto(contenido, nombreSeguro(titulo || 'documento', 'md'))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-muted transition hover:bg-white/10 hover:text-foreground"
        >
          <Download size={14} aria-hidden="true" />
          Descargar .md
        </button>
      </div>
    </div>
  );
}
