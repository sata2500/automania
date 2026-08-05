import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { isProtectedUrl } from '@/lib/sample-data';

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const urls: string[] = body.urls;

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({ error: 'Geçersiz veri formatı. "urls" dizisi bekleniyor.' }, { status: 400 });
    }

    // Filtreleme: Yalnızca örnek verilere ait olmayan URL'leri silinecekler listesine ekle
    const urlsToDelete = urls.filter(url => !isProtectedUrl(url));

    if (urlsToDelete.length > 0) {
      await del(urlsToDelete);
      console.log(`Successfully deleted ${urlsToDelete.length} blobs.`);
    }

    return NextResponse.json({ success: true, deletedCount: urlsToDelete.length, skippedCount: urls.length - urlsToDelete.length });
  } catch (error: any) {
    console.error('Blob DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
