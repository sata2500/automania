const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbPath = 'D:/Projelerim/automania-next/.data/users/user-c2fsawh0yw5yaxnldmvumjvaz21hawwuy29t-db.json';
const uploadsDir = 'D:/Projelerim/automania-next/.data/uploads';
const targetSampleDataPath = 'D:/Projelerim/automania-next/src/lib/sample-data.ts';

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

console.log('Reading DB file from:', dbPath);
const raw = fs.readFileSync(dbPath, 'utf8');
const parsed = JSON.parse(raw);

function saveBase64(dataUrl, defaultExt = 'webp') {
  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
  if (dataUrl.startsWith('/api/uploads/') || dataUrl.startsWith('http')) return dataUrl;

  const matches = dataUrl.match(/^data:([a-zA-Z0-9\/\-+.]+);base64,(.+)$/);
  if (!matches) return dataUrl;

  const mime = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  let ext = defaultExt;
  if (mime.includes('png')) ext = 'png';
  else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
  else if (mime.includes('mp4')) ext = 'mp4';
  else if (mime.includes('webm')) ext = 'webm';

  const fname = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const outPath = path.join(uploadsDir, fname);
  fs.writeFileSync(outPath, buffer);
  return `/api/uploads/${fname}`;
}

const mockups = (parsed.mockups || []).map((m) => ({
  ...m,
  src: saveBase64(m.src, m.isVideo ? 'mp4' : 'webp'),
  opacity: 1.0,
}));

const designs = (parsed.designs || []).map((d) => ({
  ...d,
  src: saveBase64(d.src, 'png'),
}));

const folders = parsed.folders || [];

const tsContent = `import { MockupItem, DesignItem, MockupFolder } from '@/types/pod';

export const DEFAULT_FOLDERS: MockupFolder[] = ${JSON.stringify(folders, null, 2)};

export const SAMPLE_MOCKUPS: MockupItem[] = ${JSON.stringify(mockups, null, 2)};

export const SAMPLE_DESIGNS: DesignItem[] = ${JSON.stringify(designs, null, 2)};
`;

fs.writeFileSync(targetSampleDataPath, tsContent, 'utf8');

const cleanedPayload = {
  mockups,
  designs,
  folders,
  activeFolderId: parsed.activeFolderId || null,
  selectedMockupId: parsed.selectedMockupId || (mockups[0]?.id || null),
};

fs.writeFileSync(dbPath, JSON.stringify(cleanedPayload), 'utf8');
fs.writeFileSync('D:/Projelerim/automania-next/.data/pod-db.json', JSON.stringify(cleanedPayload), 'utf8');
console.log('COMPLETE_SUCCESS');
