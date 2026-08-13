import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { scrapeEtsyKeywordData } from '../src/lib/etsy-scraper';

async function main() {
  const keywords = [
    'oak tree shirt',
    'coiled snake tee',
    'eagle and snake',
    'feather and oak',
    'oak leaf shirt'
  ];

  console.log('====================================================');
  console.log('REAL-TIME ETSY KEYWORD DATA SCRAPING EVALUATION');
  console.log('====================================================\n');

  for (const kw of keywords) {
    const res = await scrapeEtsyKeywordData(kw, {
      workerUrl: process.env.CLOUDFLARE_WORKER_URL
    });

    console.log(`Keyword          : "${res.keyword}"`);
    console.log(`Total Listings   : ${res.totalListings.toLocaleString()} listings`);
    console.log(`Competition Level: ${res.competitionLevel}`);
    console.log(`Bestseller Count : ${res.bestsellerCount}`);
    console.log(`Etsy Suggested   : ${res.isEtsySuggested ? 'YES (Rank #' + res.autocompleteRank + ')' : 'NO'}`);
    console.log(`Opportunity Score: ${res.opportunityScore} / 100`);
    console.log(`Scrape Error     : ${res.scrapeError || 'NONE (100% Success)'}`);
    console.log(`Raw Metrics      :`, JSON.stringify(res.rawMetrics));
    console.log('----------------------------------------------------\n');
  }
}

main();
