import { sql } from '../src/lib/db.ts';

const rows = await sql`
  SELECT
    jsonb_array_length(COALESCE(folders, '[]'::jsonb)) AS folders_count,
    jsonb_array_length(COALESCE(mockups, '[]'::jsonb)) AS mockups_count,
    jsonb_array_length(COALESCE(designs, '[]'::jsonb)) AS designs_count,
    updated_at
  FROM user_workspaces
  WHERE user_id = 'user-default'
`;

if (rows.length === 0) {
  console.log(JSON.stringify({ exists: false, counts: null }));
} else {
  console.log(JSON.stringify({
    exists: true,
    counts: {
      folders: Number(rows[0].folders_count),
      mockups: Number(rows[0].mockups_count),
      designs: Number(rows[0].designs_count),
    },
    updatedAtPresent: Boolean(rows[0].updated_at),
  }));
}
