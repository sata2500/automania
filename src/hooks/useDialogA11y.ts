'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Açık pencerelerin yığını: iç içe pencerelerde Escape ve Tab yalnızca en üsttekini etkiler.
const dialogStack: symbol[] = [];

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getClientRects().length > 0,
  );
}

/**
 * Modal pencereler için ortak klavye erişilebilirliği:
 * - Açılınca odak pencereye taşınır (`initialFocusRef` veya ilk odaklanabilir öğe), kapanınca geri verilir.
 * - Escape pencereyi kapatır (yalnızca en üstteki pencere).
 * - Tab/Shift+Tab odağı pencerenin içinde tutar.
 * Pencere öğesine ayrıca `role="dialog"` ve `aria-modal="true"` verilmelidir.
 */
export function useDialogA11y(
  containerRef: RefObject<HTMLElement | null>,
  options: { isOpen?: boolean; onClose?: () => void; initialFocusRef?: RefObject<HTMLElement | null> } = {},
) {
  const { isOpen = true, onClose, initialFocusRef } = options;
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const id = Symbol('dialog');
    dialogStack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      const container = containerRef.current;
      if (!container || container.contains(document.activeElement)) return;
      const target = initialFocusRef?.current ?? getFocusable(container)[0] ?? container;
      if (target === container && !container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
      target.focus();
    }, 30);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== id) return;
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      const index = dialogStack.indexOf(id);
      if (index !== -1) dialogStack.splice(index, 1);
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus?.();
    };
  }, [isOpen, containerRef, initialFocusRef]);
}
