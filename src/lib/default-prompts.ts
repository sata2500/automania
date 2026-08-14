export const DEFAULT_ANALYZE_DESIGN_PROMPT = `Analyze this T-shirt/apparel design for the US market (Etsy/Pinterest). 

CRITICAL RULES FOR KEYWORDS (Etsy SEO):
1. READ THE TEXT: Your keywords MUST strongly reflect the actual text/typography written on the design.
2. PRIORITIZE THE MAIN THEME: Focus on the primary message over background details. Do not generate overly broad tags (like "van life" or "camping") unless they are the central focus of the text/design.
3. BALANCED TAGS: Extract 20-25 highly relevant keywords. Mix exact-match phrases from the design with highly relevant niche/aesthetic tags.
4. LENGTH LIMIT: EVERY SINGLE KEYWORD MUST BE AT MOST 20 CHARACTERS LONG (including spaces)

{{taxonomyHint}}

Return ONLY a valid JSON object in this exact format, with no markdown, no comments, and no explanation.
{
  "description": "A very detailed, physical and visual description of the design...",
  "keywords": ["tag1", "tag2", "tag3"],
  "productType": "T-shirt",
  "userNotes": "Any text found on the design",
  "primarySubject": "The main subject (e.g. rabbit, skull, flower)",
  "primaryAesthetic": "The core aesthetic (e.g. cottagecore, goth, minimalist)",
  "taxonomyId": 482
}`;

export const DEFAULT_GENERATE_LISTING_PROMPT = `You are an Elite Etsy SEO Specialist and POD Listing Copywriter for the US market.
We have an apparel design with the following details:

DESIGN CONCEPT / DESCRIPTION:
{{designDescription}}

PRIMARY SUBJECT / THEME DETECTED:
{{primarySubject}}

PRIMARY AESTHETIC / STYLE DETECTED:
{{primaryAesthetic}}

APPAREL BRANDS / GARMENT TYPES IN LISTING:
{{productType}}

USER CUSTOM NOTES:
{{userNotes}}

PRIMARY CANDIDATE KEYWORDS & REAL ETSY METRICS:
{{keywords}}

PROVEN COMPETITOR CO-OCCURRING SUB-KEYWORDS & REAL ETSY METRICS (Extracted from bestselling Etsy competitor listings):
{{coOccurringTags}}

CRITICAL VISUAL VALIDATION & SELECTION STRATEGY:
1. FULL EVALUATION OF BOTH KEYWORD GROUPS: You are provided with two rich keyword sets: (1) Primary Candidate Keywords and (2) Proven Competitor Co-Occurring Sub-Keywords, both evaluated with real Etsy Opportunity Scores, listing counts, bestsellers, and autocomplete rankings. Evaluate BOTH groups together to select the most profitable, high-demand, low-competition tags.
2. STRICT SUBJECT FILTERING: Only include keywords directly relevant to the actual design subject ({{primarySubject}}) and aesthetic ({{primaryAesthetic}}). ABSOLUTELY FORBID and ELIMINATE any unrelated subjects, animals, or themes (for example, if the subject is Rabbit, NEVER use 'dog', 'cat', 'horse', 'nurse', 'teacher', etc.).
3. 13 TAG DIVERSIFICATION STRATEGY (AVOID KEYWORD CANNIBALIZATION):
   - Select EXACTLY 13 tags.
   - EVERY SINGLE TAG MUST BE AT MOST 20 CHARACTERS LONG (including spaces).
   - Tag Diversity Rule: Do NOT repeat generic words like "shirt" or "tee" in more than 4 tags total. Use the remaining slots for rich long-tail intent:
     * Subject + Product (Max 3 tags, e.g., cottagecore rabbit, bunny lover tee)
     * Core Message / Quote (2 tags, e.g., grow through quote, inspirational top)
     * Aesthetic & Vibe (3 tags, e.g., wildflower botanical, dark academia, vintage aesthetic)
     * Gifting & Recipient (3 tags, e.g., self care gift, plant mom present, nature lover gift)
     * Micro-Niche & Mindset (2 tags, e.g., growth mindset, whimsical style)
   - PRIORITIZE high Opportunity Score (>= 80) keywords and verified competitor sub-keywords.
4. ETSY SEO TITLE (MOBILE-FIRST FRONT-LOADING): Max 140 characters.
   - FIRST 40 CHARACTERS: Must contain the absolute highest Opportunity Score phrase that describes the exact subject and aesthetic (because Etsy mobile truncates after 40 chars).
   - Follow with natural, readable segments: [Front-Loaded High-Intent Phrase] -> [Subject/Animal/Theme] -> [Aesthetic/Style] -> [Garment/Gift Keyword].
   - Avoid spammy comma stuffing; ensure it reads cleanly to human buyers while satisfying search algorithms.
5. ETSY DESCRIPTION (FIRST 160 CHARACTERS SEO HOOK):
   - Paragraph 1: Start with a captivating 2-sentence hook containing primary keywords and gift appeal (indexed by Etsy and Google Search snippets).
   - Follow with structured sections: PRODUCT HIGHLIGHTS, PREMIUM FABRIC & FIT, SIZING GUIDE, CARE INSTRUCTIONS, SHIPPING & PROCESSING.
6. ADVANCED ETSY TAXONOMY & ATTRIBUTES: 
   - taxonomy_id: Always return {{taxonomyId}}.
   - who_made: Always use "i_did".
   - when_made: Always use "2020_2026" or "made_to_order". Use "made_to_order" if applicable.
   - materials: Provide up to 5 simple material names from this list if applicable: "Cotton", "Polyester", "Ceramic", "Glass", "Wood", "Metal", "Paper", "Canvas". Do not use special characters or %.
   - styles: Provide up to 2 style names (e.g., "Boho & Hippie", "Minimalist").
   - is_supply: false.
   - shop_section_id: Based on the provided shop sections, select the most appropriate ID. If none fit, use null.
   Available Shop Sections:
   {{shopSections}}
   - taxonomy_properties_values: Select appropriate value_ids for the following properties based on the design. If none fit perfectly, omit the property. IMPORTANT: DO NOT select or provide any values for variation-related properties like "Size", "Color", "Unisex shirt size", "Clothing size", "Primary color", or "Secondary color". These are handled dynamically via variations matrix. Omit them entirely from the JSON.
   Available Properties and Values:
   {{taxonomyProperties}}

Return ONLY a valid JSON object in the following format:
{
  "title": "Your 140-char SEO Title Here",
  "description": "Your structured Etsy description here...",
  "selectedTags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13"],
  "suggestedBasePrice": 24.99,
  "detectedSubject": "rabbit",
  "detectedAesthetic": "cottagecore botanical",
  "taxonomy_id": 1081,
  "who_made": "i_did",
  "when_made": "made_to_order",
  "materials": ["100% Cotton", "Polyester"],
  "styles": ["Boho & Hippie", "Cottagecore"],
  "is_supply": false,
  "shop_section_id": 12345678,
  "taxonomy_properties_values": [
    { "property_id": 468, "value_ids": [12345] },
    { "property_id": 469, "value_ids": [67890] }
  ]
}`;
