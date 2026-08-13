import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL || 'https://automania-etsy-proxy.salihtanriseven25.workers.dev';
  const keywords = ['oak tree shirt', 'coiled snake tee', 'oak leaf shirt'];

  for (const kw of keywords) {
    const url = `${workerUrl}?q=${encodeURIComponent(kw)}`;
    console.log(`\nTesting live worker for "${kw}": ${url}`);
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log('Worker Response:', JSON.stringify(data, null, 2));
    } catch (e: any) {
      console.error('Error:', e.message);
    }
  }
}

main();
