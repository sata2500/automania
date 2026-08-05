import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, /* clientPayload */) => {
        // Burada kullanıcı kimlik doğrulaması yapılabilir.
        // Bizim uygulamamız şimdilik herkesin yüklemesine açık veya 
        // Vercel üzerinden çalışacağı için özel bir auth kullanmıyoruz.
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
          tokenPayload: JSON.stringify({
            // Opsiyonel: token için ekstra veriler
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Yükleme tamamlandığında yapılacak işlemler (Loglama vb.)
        console.log('blob upload completed', blob, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 } // Beklenmeyen bir hata (400)
    );
  }
}
