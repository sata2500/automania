import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

/**
 * Lightweight endpoint that returns only the last updated timestamp for a user's workspace.
 * Used by clients for efficient real-time sync polling — avoids fetching full payload every 5s.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Prefer authenticated session; fallback to query param for backwards-compat
    const session = await getSession();
    const userId = session?.id || searchParams.get('userId') || 'default_guest';

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
