import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';
import { list, del } from '@vercel/blob';
import * as sampleData from '@/lib/sample-data';

export async function POST(request: Request) {
  try {
    const adminSession = await requireAdmin();
    if (!adminSession) {
      return NextResponse.json({ success: false, message: 'Yetkisiz erişim.' }, { status: 403 });
    }

    // 1. Extract protected URLs from sample-data
    const sampleDataString = JSON.stringify(sampleData);
    const urlMatches = sampleDataString.match(/https:\/\/[^\s"',]+/g) || [];
    const protectedUrls = new Set(urlMatches);

    // 2. Fetch active workspaces from DB
    const rows = await sql`SELECT mockups, designs, etsy_generated_mockups FROM user_workspaces`;
    
    const activeUrls = new Set<string>();
    
    rows.forEach(row => {
      try {
        const mockups = typeof row.mockups === 'string' ? JSON.parse(row.mockups) : row.mockups;
        const designs = typeof row.designs === 'string' ? JSON.parse(row.designs) : row.designs;
        const etsyMockups = typeof row.etsy_generated_mockups === 'string' ? JSON.parse(row.etsy_generated_mockups) : row.etsy_generated_mockups;
        
        if (Array.isArray(mockups)) {
          mockups.forEach((m: any) => m.src && activeUrls.add(m.src));
        }
        if (Array.isArray(designs)) {
          designs.forEach((d: any) => d.src && activeUrls.add(d.src));
        }
        if (Array.isArray(etsyMockups)) {
          etsyMockups.forEach((m: any) => m.previewUrl && activeUrls.add(m.previewUrl));
        }
      } catch (e) {
        console.error('Failed to parse a row', e);
      }
    });

    // 3. Fetch all blobs from Vercel
    let hasMore = true;
    let cursor: string | undefined = undefined;
    const allBlobs: any[] = [];
    
    while (hasMore) {
      const response = await list({
        token: process.env.BLOB_READ_WRITE_TOKEN,
        limit: 1000,
        cursor
      });
      
      allBlobs.push(...response.blobs);
      hasMore = response.hasMore;
      cursor = response.cursor;
    }

    // 4. Find orphaned blobs
    const orphanedBlobs = allBlobs.filter(b => {
      if (activeUrls.has(b.url)) return false; // Keep active
      if (protectedUrls.has(b.url)) return false; // Keep sample data
      return true; // Delete orphaned
    });

    const deletedCount = orphanedBlobs.length;

    // 5. Delete orphaned blobs in chunks of 500
    if (deletedCount > 0) {
      const urlsToDelete = orphanedBlobs.map(b => b.url);
      for (let i = 0; i < urlsToDelete.length; i += 500) {
        const chunk = urlsToDelete.slice(i, i + 500);
        await del(chunk, { token: process.env.BLOB_READ_WRITE_TOKEN });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Toplam ${deletedCount} adet çöp veri/görsel Vercel Blob üzerinden başarıyla temizlendi.`,
      stats: {
        active: activeUrls.size,
        protected: protectedUrls.size,
        deleted: deletedCount,
        totalChecked: allBlobs.length
      }
    });
  } catch (error: any) {
    console.error('Clean Blobs Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
