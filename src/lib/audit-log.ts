import { randomUUID } from 'node:crypto';
import sql from '@/lib/db';
import { sanitizeAuditMetadata } from '@/lib/audit-log-security';

export async function writeAuditLog(input: {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: unknown;
}): Promise<void> {
  try {
    await sql`
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, metadata)
      VALUES (
        ${`audit-${randomUUID()}`},
        ${input.userId},
        ${input.action.slice(0, 100)},
        ${input.resourceType?.slice(0, 100) || null},
        ${input.resourceId?.slice(0, 255) || null},
        ${JSON.stringify(sanitizeAuditMetadata(input.metadata ?? {}))}::jsonb
      )
    `;
  } catch (error) {
    console.error('[Audit] Write failed:', error instanceof Error ? error.message : 'unknown error');
  }
}

