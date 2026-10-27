/**
 * Parçalı yükleme: Vercel tek istekte en fazla ~4,5 MB gövde kabul eder. Büyük dosyalar (tam çözünürlüklü
 * tasarımlar, videolar) istemcide parçalara bölünür, her parça R2'de geçici bir nesne olarak saklanır;
 * tamamlama isteğinde sunucu parçaları birleştirir, doğrular, gerekirse sıkıştırır ve kalıcı dosyayı yazar.
 */
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getBucketName, getR2Client } from '@/lib/r2';
import { getUserStoragePrefix } from '@/lib/upload-security';

/** İstemcinin gönderdiği parça boyutu (Vercel sınırının altında). */
export const CHUNK_BYTES = 3.5 * 1024 * 1024;
/** Sunucunun kabul ettiği en büyük parça. */
export const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
export const MAX_CHUNKS = 64;
/** Parçalı yüklemede izin verilen toplam boyut. */
export const MAX_CHUNKED_IMAGE_BYTES = 60 * 1024 * 1024;
export const MAX_CHUNKED_VIDEO_BYTES = 200 * 1024 * 1024;

const UPLOAD_ID = /^[a-f0-9-]{16,64}$/i;

export function isValidUploadId(id: unknown): id is string {
  return typeof id === 'string' && UPLOAD_ID.test(id);
}

function partKey(userId: string, uploadId: string, index: number): string {
  return `upload-parts/${getUserStoragePrefix(userId)}${uploadId}/${String(index).padStart(3, '0')}`;
}

export async function storeChunk(userId: string, uploadId: string, index: number, data: Buffer): Promise<void> {
  await getR2Client().send(new PutObjectCommand({
    Bucket: getBucketName(),
    Key: partKey(userId, uploadId, index),
    Body: data,
    ContentType: 'application/octet-stream',
  }));
}

/** Parçaları sırayla okuyup birleştirir; eksik parça varsa hata fırlatır. */
export async function assembleChunks(userId: string, uploadId: string, total: number, maxBytes: number): Promise<Buffer> {
  const parts: Buffer[] = [];
  let size = 0;
  for (let index = 0; index < total; index++) {
    const res = await getR2Client().send(new GetObjectCommand({ Bucket: getBucketName(), Key: partKey(userId, uploadId, index) }));
    if (!res.Body) throw new Error(`Parça ${index + 1} bulunamadı.`);
    const bytes = Buffer.from(await res.Body.transformToByteArray());
    size += bytes.byteLength;
    if (size > maxBytes) throw new Error('Dosya boyutu izin verilen sınırı aşıyor.');
    parts.push(bytes);
  }
  return Buffer.concat(parts);
}

export async function deleteChunks(userId: string, uploadId: string, total: number): Promise<void> {
  const keys = Array.from({ length: total }, (_, index) => ({ Key: partKey(userId, uploadId, index) }));
  if (keys.length === 0) return;
  await getR2Client().send(new DeleteObjectsCommand({ Bucket: getBucketName(), Delete: { Objects: keys, Quiet: true } }));
}
