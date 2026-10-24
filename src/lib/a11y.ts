import type React from 'react';

/**
 * `div` gibi buton olmayan tıklanabilir öğelere klavye ile etkinleştirme ekler (Enter / Boşluk).
 * Yalnızca öğenin kendisi odaktayken çalışır; içindeki butonlar kendi davranışını korur.
 */
export function activateOnKey(handler: () => void) {
  return (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler();
    }
  };
}
