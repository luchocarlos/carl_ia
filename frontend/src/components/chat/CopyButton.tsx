import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn';

// Props: texto fijo o función que lo obtiene al hacer clic (útil para leer del DOM)
interface Props {
  texto?: string; // contenido estático a copiar
  obtenerTexto?: () => string; // alternativa perezosa; tiene prioridad sobre `texto`
  etiqueta?: string; // texto visible y aria-label del botón
  className?: string; // clases extra para personalizar el estilo
}

// Botón que copia contenido al portapapeles y muestra "Copiado" durante un momento
export function CopyButton({ texto = '', obtenerTexto, etiqueta = 'Copiar', className }: Props) {
  const [copiado, setCopiado] = useState(false); // estado para mostrar la confirmación visual

  // Copia usando la API Clipboard; si falla (contexto inseguro, permisos) usa execCommand
  async function copiar() {
    const contenido = obtenerTexto ? obtenerTexto() : texto;

    try {
      await navigator.clipboard.writeText(contenido);
    } catch {
      // Respaldo: textarea temporal invisible + execCommand('copy')
      const area = document.createElement('textarea');
      area.value = contenido;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }

    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1600); // vuelve al estado normal tras 1,6 s
  }

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-muted transition hover:bg-white/10 hover:text-foreground',
        className,
      )}
      aria-label={copiado ? 'Contenido copiado' : etiqueta}
    >
      {/* ── Icono y texto según el estado de copiado ── */}
      {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span>{copiado ? 'Copiado' : etiqueta}</span>
    </button>
  );
}
