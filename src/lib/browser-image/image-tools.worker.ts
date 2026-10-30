/// <reference lib="webworker" />
/** Misafirin tasarım işlemlerini ana iş parçacığı dışında yürütür (bkz. `pixel-ops`, `browser-image`). */
import { runPixelOp, type PixelOp } from './pixel-ops';

type Request = { id: number; op: PixelOp; data: Uint8ClampedArray; width: number; height: number };

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, op, data, width, height } = event.data;
  try {
    const result = runPixelOp(op, data, width, height);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, ok: true, result }, result.png ? [result.png.buffer] : []);
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : 'Görsel işlenemedi.' });
  }
};
