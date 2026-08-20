import { NextResponse } from 'next/server';
import { isProtectedUrl } from '@/lib/sample-data';
import { isR2Configured, deleteFromR2 } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const urls: string[] = body.urls;

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({ error: 'Geçersiz veri formatı. "urls" dizisi bekleniyor.' }, { status: 400 });
    }

    // Filtreleme: Yalnızca örnek verilere ait olmayan URL'leri silinecekler listesine ekle
    const urlsToDelete = urls.filter(url => !isProtectedUrl(url));

    let deletedCount = 0;

    if (urlsToDelete.length > 0) {
      // Delete from Cloudflare R2
      if (isR2Configured()) {
        try {
          const res = await deleteFromR2(urlsToDelete);
          deletedCount += res.deletedCount;
        } catch (r2Err) {
          console.error('[Storage Delete] Failed to delete from Cloudflare R2:', r2Err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      skippedCount: urls.length - urlsToDelete.length,
    });
  } catch (error: any) {
    console.error('Storage Delete Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
