import { SAMPLE_MOCKUPS, SAMPLE_DESIGNS } from '../src/lib/sample-data';
import sharp from 'sharp';
import { put } from '@vercel/blob';
import * as fs from 'fs';
import * as path from 'path';

// Using the config from env
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MAX_DIMENSION = 2000;

async function optimizeUrl(url: string, prefix: string): Promise<{ newUrl: string; width: number; height: number }> {
  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const metadata = await sharp(buffer).metadata();
  
  if (metadata.format === 'mp4' || metadata.format === 'webm' || metadata.format === 'mov' || !metadata.width || !metadata.height) {
    console.log(`Skipping non-image/video: ${url}`);
    return { newUrl: url, width: metadata.width || 2000, height: metadata.height || 2000 };
  }

  let width = metadata.width;
  let height = metadata.height;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_DIMENSION) / width);
      width = MAX_DIMENSION;
    } else {
      width = Math.round((width * MAX_DIMENSION) / height);
      height = MAX_DIMENSION;
    }
  }

  console.log(`Optimizing to ${width}x${height} WebP...`);
  const optimizedBuffer = await sharp(buffer)
    .resize(width, height)
    .webp({ quality: 85 })
    .toBuffer();

  const originalSize = buffer.length;
  const newSize = optimizedBuffer.length;
  console.log(`Size reduced: ${(originalSize / 1024 / 1024).toFixed(2)} MB -> ${(newSize / 1024 / 1024).toFixed(2)} MB`);

  const filename = `${prefix}-optimized-${Date.now()}.webp`;
  console.log(`Uploading ${filename}...`);
  const blob = await put(filename, optimizedBuffer, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return { newUrl: blob.url, width, height };
}

async function run() {
  const newMockups = [];
  
  for (let i = 0; i < SAMPLE_MOCKUPS.length; i++) {
    const mockup = SAMPLE_MOCKUPS[i];
    if (mockup.isVideo || mockup.src.endsWith('.mp4') || mockup.src.endsWith('.mov')) {
      newMockups.push(mockup);
      continue;
    }
    
    try {
      console.log(`[Mockup ${i+1}/${SAMPLE_MOCKUPS.length}] Processing ${mockup.name}...`);
      const { newUrl, width, height } = await optimizeUrl(mockup.src, 'mockup');
      newMockups.push({
        ...mockup,
        src: newUrl,
        width,
        height
      });
    } catch (e) {
      console.error(`Failed to process ${mockup.name}:`, e);
      newMockups.push(mockup);
    }
  }

  const newDesigns = [];
  for (let i = 0; i < SAMPLE_DESIGNS.length; i++) {
    const design = SAMPLE_DESIGNS[i];
    try {
      console.log(`[Design ${i+1}/${SAMPLE_DESIGNS.length}] Processing ${design.name}...`);
      const { newUrl, width, height } = await optimizeUrl(design.src, 'design');
      newDesigns.push({
        ...design,
        src: newUrl,
        width,
        height
      });
    } catch (e) {
      console.error(`Failed to process ${design.name}:`, e);
      newDesigns.push(design);
    }
  }

  // Rewrite sample-data.ts
  const sampleDataPath = path.join(__dirname, '..', 'src', 'lib', 'sample-data.ts');
  let content = fs.readFileSync(sampleDataPath, 'utf-8');
  
  // A bit hacky: replace the JSON string representation
  const mockupsRegex = /export const SAMPLE_MOCKUPS: MockupItem\[\] = (\[[\s\S]*?\]);\n\nexport const SAMPLE_DESIGNS/m;
  content = content.replace(mockupsRegex, `export const SAMPLE_MOCKUPS: MockupItem[] = ${JSON.stringify(newMockups, null, 2)};\n\nexport const SAMPLE_DESIGNS`);
  
  const designsRegex = /export const SAMPLE_DESIGNS: DesignItem\[\] = (\[[\s\S]*?\]);\n\nexport const SAMPLE_PRESETS/m;
  content = content.replace(designsRegex, `export const SAMPLE_DESIGNS: DesignItem[] = ${JSON.stringify(newDesigns, null, 2)};\n\nexport const SAMPLE_PRESETS`);

  fs.writeFileSync(sampleDataPath, content);
  console.log('Successfully updated src/lib/sample-data.ts!');
}

run().catch(console.error);
