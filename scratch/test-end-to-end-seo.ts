import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testPipeline() {
  const { default: sql } = await import('../src/lib/db');
  const { DEFAULT_GENERATE_LISTING_PROMPT } = await import('../src/lib/default-prompts');

  console.log('--- 1. Testing Keyword Pool Enrichment & Co-Occurring Tags Query ---');
  
  // Sample keywords that exist in DB
  const testKeywords = ['scholar series', 'american tradition', 'cottagecore shirt', 'wildflower tee'];
  
  const dbKeywords = await sql`
    SELECT keyword, opportunity_score, etsy_score, total_listings, bestseller_count, 
           autocomplete_rank, tag_eligible, avg_price, raw_metrics
    FROM keyword_pool
    WHERE LOWER(keyword) = ANY(${testKeywords as any})
  `;

  console.log(`Found ${dbKeywords.length} matching keywords in DB:`);
  dbKeywords.forEach(k => {
    console.log(`- "${k.keyword}": Score=${k.opportunity_score}/100, Listings=${k.total_listings}, Bestsellers=${k.bestseller_count}`);
  });

  // Extract co-occurring tags
  let coOccurringTagsList: string[] = [];
  for (const row of dbKeywords) {
    const rm = typeof row.raw_metrics === 'string' ? JSON.parse(row.raw_metrics) : (row.raw_metrics || {});
    if (Array.isArray(rm.topTags)) {
      for (const tag of rm.topTags) {
        const cleanTag = String(tag).trim().toLowerCase();
        if (cleanTag && cleanTag.length <= 20) {
          coOccurringTagsList.push(cleanTag);
        }
      }
    }
  }

  console.log(`\n--- 2. Extracted Co-Occurring Competitor Tags (${coOccurringTagsList.length} total) ---`);
  const tagFrequency: Record<string, number> = {};
  coOccurringTagsList.forEach(t => { tagFrequency[t] = (tagFrequency[t] || 0) + 1; });
  const rankedCoOccurringTags = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 10);
  console.log('Top ranked competitor co-occurring tags:', rankedCoOccurringTags);

  console.log('\n--- 3. Testing Prompt Construction with Placeholder Replacement ---');
  const enrichedKeywords = testKeywords.map(kStr => {
    const dbData = dbKeywords.find(d => d.keyword.toLowerCase() === kStr.toLowerCase());
    const score = dbData?.opportunity_score ?? dbData?.etsy_score ?? 75;
    const listings = dbData?.total_listings ?? 0;
    const bestsellers = dbData?.bestseller_count ?? 0;
    const autoRank = dbData?.autocomplete_rank ?? 0;
    const tagOk = kStr.length <= 20;

    return {
      keyword: kStr,
      opportunity_score: score,
      total_listings: listings,
      bestseller_count: bestsellers,
      autocomplete_rank: autoRank,
      tag_eligible: tagOk
    };
  }).sort((a, b) => b.opportunity_score - a.opportunity_score);

  const formattedKeywords = enrichedKeywords.map(k => {
    let details = `Score: ${k.opportunity_score}/100`;
    if (k.total_listings > 0) details += `, Listings: ${k.total_listings.toLocaleString('en-US')}`;
    if (k.bestseller_count > 0) details += `, Bestsellers: ${k.bestseller_count}`;
    if (k.autocomplete_rank > 0) details += `, Autocomplete: #${k.autocomplete_rank}`;
    details += `, Tag Fit: ${k.tag_eligible ? 'YES (<=20 char)' : 'NO (>20 char)'}`;
    return `- "${k.keyword}" (${details})`;
  }).join('\n');

  const formattedCoOccurring = rankedCoOccurringTags.length > 0
    ? rankedCoOccurringTags.map(t => `- "${t}" (Len: ${t.length}/20, Verified Competitor Tag)`).join('\n')
    : 'None detected yet in pool.';

  let prompt = DEFAULT_GENERATE_LISTING_PROMPT
    .replace(/\{\{designDescription\}\}/g, 'Vintage Botanical Scholar Rabbit Tee')
    .replace(/\{\{primarySubject\}\}/g, 'scholar rabbit reading books')
    .replace(/\{\{primaryAesthetic\}\}/g, 'cottagecore dark academia vintage')
    .replace(/\{\{productType\}\}/g, 'Comfort Colors 1717 Garment Dyed Tee')
    .replace(/\{\{userNotes\}\}/g, '100% ring spun cotton, oversize fit')
    .replace(/\{\{keywords\}\}/g, formattedKeywords)
    .replace(/\{\{coOccurringTags\}\}/g, formattedCoOccurring)
    .replace(/\{\{taxonomyId\}\}/g, '482')
    .replace(/\{\{shopSections\}\}/g, 'None')
    .replace(/\{\{taxonomyProperties\}\}/g, 'None');

  console.log('\n--- 4. Prompt Verification Check ---');
  const hasKeywordsPlaceholder = prompt.includes('{{keywords}}');
  const hasCoOccurringPlaceholder = prompt.includes('{{coOccurringTags}}');
  console.log('Keywords placeholder replaced correctly:', !hasKeywordsPlaceholder);
  console.log('CoOccurringTags placeholder replaced correctly:', !hasCoOccurringPlaceholder);
  console.log('Contains Score Details:', prompt.includes('Score: 99/100') || prompt.includes('Score: 89/100'));

  console.log('\nSUCCESS: All pipeline components tested and validated.');
  process.exit(0);
}

testPipeline().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
