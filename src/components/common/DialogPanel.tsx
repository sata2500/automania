'use client';

import React, { useRef } from 'react';
import { useDialogA11y } from '@/hooks/useDialogA11y';

type DialogPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Escape ile kapatma. Verilmezse Escape bir şey yapmaz (ör. işlem sürerken). */
  onClose?: () => void;
};

/**
 * Modal pencerenin içeriğini saran erişilebilir panel: `role="dialog"`, `aria-modal`, odak tuzağı,
 * Escape ile kapanma ve kapanınca odağın geri verilmesi. Pencere görünürken bağlanır.
 */
export function DialogPanel({ onClose, children, ...rest }: DialogPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(ref, { onClose });
  return (
    <div ref={ref} role="dialog" aria-modal="true" {...rest}>
      {children}
    </div>
  );
}
