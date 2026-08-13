import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

async function inspectGoogleHtml(keyword: string) {
  const targetUrl = `https://www.google.com/search?q=${encodeURIComponent('site:etsy.com ' + keyword)}&hl=en`;
  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  const html = await res.text();
  const resultStatsMatch = html.match(/id="result-stats"[^>]*>(.*?)<\/div>/i);
  console.log('result-stats:', resultStatsMatch?.[1]);

  // Look for any numbers around "results"
  const allMatches = html.match(/.{0,50}(?:results|result|sonuç).{0,50}/gi);
  console.log('Matches near "results":', allMatches?.slice(0, 10));
}

inspectGoogleHtml('dracula family');
