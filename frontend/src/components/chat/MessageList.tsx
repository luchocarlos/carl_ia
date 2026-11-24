import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { Chat } from '../../types';
import { MessageItem } from './MessageItem';

// Lista de mensajes del chat activo con desplazamiento automático al final
export function MessageList({ chat }: { chat: Chat }) {
  const finRef = useRef<HTMLDivElement>(null); // marcador invisible al final de la lista
  const reducido = useReducedMotion(); // si el usuario prefiere menos animación, scroll instantáneo
  const ultimo = chat.messages[chat.messages.length - 1]; // último mensaje (crece durante el streaming)

  // Baja al final al cambiar de chat, al llegar mensajes nuevos o al crecer el último
  useEffect(() => {
    finRef.current?.scrollIntoView({
      behavior: reducido ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [chat.id, chat.messages.length, ultimo?.content, reducido]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-6 sm:pt-8">
      {/* ── Mensajes de la conversación ── */}
      <ol className="space-y-7 sm:space-y-8" aria-label="Conversación">
        {chat.messages.map((mensaje) => (
          <li key={mensaje.id}>
            <MessageItem mensaje={mensaje} tituloChat={chat.title} />
          </li>
        ))}
      </ol>
      {/* ── Ancla para el auto-scroll ── */}
      <div ref={finRef} className="h-2" aria-hidden="true" />
    </div>
  );
}
