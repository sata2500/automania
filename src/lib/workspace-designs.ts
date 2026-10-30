/**
 * Çalışma alanındaki tek bir tasarım kaydının sunucuda atomik güncellenmesi (yalnızca o tasarımın JSON'u
 * değişir). updated_at ilerler: açık sekmeler değişikliği eşitlemede (üç yönlü birleştirme) alır.
 */
import { sql } from '@/lib/db';
import type { DesignItem } from '@/types/pod';

/**
 * Tasarıma alanları ekler/değiştirir; `remove` içindeki anahtarlar silinir. Tasarım bulunamazsa false döner
 * (ör. henüz kaydedilmemiş yeni tasarım).
 */
export async function patchWorkspaceDesign(
  userId: string,
  designId: string,
  patch: Partial<DesignItem>,
  remove: Array<keyof DesignItem> = [],
): Promise<boolean> {
  const rows = await sql`
    UPDATE user_workspaces
    SET designs = (
      SELECT jsonb_agg(CASE
        WHEN elem ->> 'id' = ${designId} THEN (elem - ${remove as string[]}::text[]) || ${JSON.stringify(patch)}::jsonb
        ELSE elem END ORDER BY ord)
      FROM jsonb_array_elements(designs) WITH ORDINALITY AS t(elem, ord)
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND designs @> ${JSON.stringify([{ id: designId }])}::jsonb
    RETURNING user_id
  `;
  return rows.length > 0;
}

/** Çalışma alanındaki tek tasarımı okur (yoksa null). */
export async function readWorkspaceDesign(userId: string, designId: string): Promise<DesignItem | null> {
  const rows = await sql`
    SELECT elem AS design
    FROM user_workspaces, jsonb_array_elements(designs) AS elem
    WHERE user_id = ${userId} AND elem ->> 'id' = ${designId}
    LIMIT 1
  `;
  return (rows[0]?.design as DesignItem | undefined) ?? null;
}
