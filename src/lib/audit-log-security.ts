const REDACTED = '[redacted]';
const SENSITIVE_KEY = /(api.?key|secret|token|authorization|password|cookie|credential)/i;

export function sanitizeAuditMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditMetadata(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).slice(0, 100).map(([key, nested]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : sanitizeAuditMetadata(nested, depth + 1),
      ]),
    );
  }
  if (typeof value === 'string') return value.slice(0, 1000);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  return String(value).slice(0, 1000);
}
