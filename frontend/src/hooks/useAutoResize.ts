import { useLayoutEffect, useRef } from 'react';

/**
 * Ajusta la altura del textarea a su contenido.
 * Crece con el texto hasta `maxAlto` px; a partir de ahí aparece scroll vertical.
 * Devuelve la ref que debe asignarse al <textarea>.
 */
export function useAutoResize(valor: string, maxAlto = 200) {
  const ref = useRef<HTMLTextAreaElement>(null); // referencia al textarea controlado

  // useLayoutEffect (y no useEffect) para medir y redimensionar antes del pintado y evitar parpadeos
  useLayoutEffect(() => {
    const elemento = ref.current;
    if (!elemento) return; // aún no montado

    elemento.style.height = 'auto'; // resetea para que scrollHeight refleje el contenido real
    elemento.style.height = `${Math.min(elemento.scrollHeight, maxAlto)}px`; // altura = contenido, con tope
    elemento.style.overflowY = elemento.scrollHeight > maxAlto ? 'auto' : 'hidden'; // scroll solo si supera el tope
  }, [valor, maxAlto]); // se recalcula cada vez que cambia el texto

  return ref;
}
