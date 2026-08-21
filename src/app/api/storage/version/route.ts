import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

/**
 * Lightweight endpoint that returns only the last updated timestamp for a user's workspace.
 * Used by clients for efficient real-time sync polling — avoids fetching full payload every 5s.
 */
export async function GET() {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.id;

    const rows = await sql`
      SELECT EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_at_ms
      FROM user_workspaces
      WHERE user_id = ${userId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ updatedAt: null });
    }

    return NextResponse.json({
      updatedAt: Math.floor(Number(rows[0].updated_at_ms)),
    });
  } catch (error) {
    console.error('Storage version check error:', error);
    return NextResponse.json({ updatedAt: null });
  }
}
