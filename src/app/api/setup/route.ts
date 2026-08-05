import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_workspaces (
        user_id VARCHAR(255) PRIMARY KEY,
        mockups JSONB DEFAULT '[]'::jsonb,
        designs JSONB DEFAULT '[]'::jsonb,
        folders JSONB DEFAULT '[]'::jsonb,
        active_folder_id VARCHAR(255),
        selected_mockup_id VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    const { searchParams } = new URL(request.url);
    if (searchParams.get('action') === 'reset') {
      await sql`TRUNCATE TABLE user_workspaces`;
      return NextResponse.json({ success: true, message: 'Veritabanı sıfırlandı. Eski hatalı veriler silindi.' });
    }

    return NextResponse.json({ success: true, message: 'Veritabanı tabloları başarıyla oluşturuldu.' });
  } catch (error: any) {
    console.error('Setup Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
