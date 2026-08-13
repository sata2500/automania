import { scrapeEtsyKeywordData } from '../src/lib/etsy-scraper';

async function test() {
  console.log("Testing server scraper...");
  const res1 = await scrapeEtsyKeywordData("vintage shirt");
  console.log("Result for 'vintage shirt':", res1);

  const res2 = await scrapeEtsyKeywordData("cat mom shirt");
  console.log("Result for 'cat mom shirt':", res2);
}

test().catch(console.error);
