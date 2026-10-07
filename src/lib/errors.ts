/** `catch` bloğundaki bilinmeyen bir hatadan okunabilir mesaj çıkarır. */
export function getErrorMessage(error: unknown, fallback = 'Bilinmeyen hata'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}

/** Hata bir AbortError (zaman aşımı / iptal) mi? */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}
