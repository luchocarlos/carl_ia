import type { ReactNode } from 'react';
import { useRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { CopyButton } from './CopyButton';

// Bloque de código con cabecera y botón de copiar (lee el texto plano del <pre>)
function BloqueCodigo({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null); // referencia al <pre> para extraer su textContent

  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-white/10 bg-black/40">
      {/* ── Cabecera del bloque: etiqueta y botón copiar ── */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted">código</span>
        <CopyButton
          obtenerTexto={() => ref.current?.textContent ?? ''}
          etiqueta="Copiar"
          className="border-transparent bg-transparent px-1.5 py-1 hover:bg-white/10"
        />
      </div>
      {/* ── Código con scroll horizontal ── */}
      <pre ref={ref} className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

/**
 * Markdown seguro (sobrescritura de componentes de react-markdown):
 * - El HTML crudo se ignora (skipHtml).
 * - Los enlaces no se renderizan como enlaces (se muestran como texto subrayado).
 * - Las imágenes del modelo no se renderizan.
 * - Los bloques <pre> se envuelven en BloqueCodigo.
 */
const componentes: Components = {
  a: ({ children }) => (
    <span className="text-foreground underline decoration-white/30 underline-offset-2">
      {children}
    </span>
  ),
  img: () => null,
  pre: ({ children }) => <BloqueCodigo>{children}</BloqueCodigo>,
};

// Renderiza Markdown con soporte GFM (tablas, listas de tareas) y resaltado de sintaxis
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        skipHtml
        components={componentes}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
