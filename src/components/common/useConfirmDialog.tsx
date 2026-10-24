'use client';

import React, { useCallback, useRef, useState } from 'react';
import { ConfirmModal } from './ConfirmModal';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
};

/**
 * Tarayıcının `confirm()` penceresi yerine uygulamanın erişilebilir onay penceresini kullanır.
 * `const ok = await confirm({...})` ile çağrılır; dönen `confirmDialog` öğesi bileşende render edilmelidir.
 */
export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolverRef.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  };

  const confirmDialog = (
    <ConfirmModal
      isOpen={options !== null}
      title={options?.title ?? ''}
      message={options?.message ?? ''}
      confirmText={options?.confirmText}
      confirmVariant={options?.confirmVariant}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, confirmDialog };
}
