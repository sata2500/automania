import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testSerper(keyword: string) {
  const serperKey = process.env.SERPER_API_KEY;
  console.log('SERPER_API_KEY:', serperKey ? 'Configured' : 'Missing');

  if (!serperKey) return;

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': serperKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: `site:etsy.com/listing "${keyword}"`
    })
  });

  const data = await res.json();
  console.log(`Serper result for "${keyword}":`, JSON.stringify(data.searchInformation, null, 2));
}

async function main() {
  await testSerper('dragonfly shirt');
  await testSerper('dracula family');
}

main();
