/**
 * Önceki sürümlerin varsayılan talimatları. Admin panelinde kayıtlı değer bunlardan biriyle birebir aynıysa
 * (hiç düzenlenmemişse) güncel varsayılan kullanılır; düzenlenmiş metinlere dokunulmaz.
 */

export const LEGACY_ANALYZE_DESIGN_V1 = `Analyze this T-shirt/apparel design for the US market (Etsy/Pinterest). 

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

export const LEGACY_ANALYZE_DESIGN_V2 = `Analyze this T-shirt/apparel design for the US market (Etsy/Pinterest). 

CRITICAL RULES FOR KEYWORDS (Etsy SEO):
1. READ THE TEXT: Your keywords MUST strongly reflect the actual text/typography written on the design.
2. PRIORITIZE THE MAIN THEME: Focus on the primary message over background details. Do not generate overly broad tags (like "van life" or "camping") unless they are the central focus of the text/design.
3. BALANCED TAGS: Extract 20-25 highly relevant keywords. Mix exact-match phrases from the design with highly relevant niche/aesthetic tags.
4. LENGTH LIMIT: EVERY SINGLE KEYWORD MUST BE AT MOST 20 CHARACTERS LONG (including spaces)

TAXONOMY: choose the most appropriate taxonomyId ONLY from this list of Etsy categories:
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

export const LEGACY_ANALYZE_LISTING_IMAGE = `You are a professional Etsy E-Commerce Visual Merchandising and Image Analysis AI.
Carefully inspect this product listing cover image and extract key design attributes in STRICT JSON format:

{
  "primarySubject": "Concise main subject (e.g., 'Retro 80s Cyberpunk Samurai Cat', 'Vintage Minimalist Wildflower Bouquet')",
  "primaryAesthetic": "Aesthetic style (e.g., 'Vintage Distressed Retro', 'Minimalist Cottagecore Boho', 'Y2K Cyberpunk Grunge')",
  "detectedStyle": "Visual technique (e.g., 'Distressed Vector Illustration', 'Watercolour Painting', 'Typography & Line Art')",
  "detectedColors": ["Dominant color 1", "Dominant color 2", "Dominant color 3"],
  "productType": "Specific POD product type as seen in the image (e.g., 'Heavyweight T-Shirt', 'Crewneck Sweatshirt', 'Ceramic Coffee Mug')",
  "description": "2-3 sentences visually detailing the artwork, focal elements, typography, and mood.",
  "keywords": ["5-8 high intent visual search tags (max 20 chars each)"]
}

Return ONLY valid JSON matching this schema. No markdown backticks, no explanations.`;

export const LEGACY_GENERATE_DESIGN_V1 = `Generate a creative and highly detailed vector-style T-shirt design based on the following concept:

CONCEPT / DESCRIPTION:
{{userPrompt}}

AESTHETIC / STYLE:
{{selectedStyle}}

CRITICAL INSTRUCTIONS:
1. BACKGROUND: The background MUST be a solid, pure bright green (chroma key green, #00FF00). DO NOT include any gradients, shadows, or other colors in the background. This is strictly required for background removal.
2. SUBJECT: The design subject must be centered, high-contrast, and clearly defined.
3. STYLE: The artwork should be flat vector style, suitable for screen printing or DTG printing on apparel. Do not include photorealistic elements unless specified.
4. TYPOGRAPHY: If the concept includes text, render it clearly with bold, readable typography that matches the aesthetic.
5. ISOLATION: Ensure the design does not blend into the green background.

Output ONLY the image without any text descriptions or chat formatting.`;

export const LEGACY_GENERATE_DESIGN_V2 = `Generate a creative and highly detailed vector-style T-shirt design based on the following concept:

CONCEPT / DESCRIPTION:
{{userPrompt}}

AESTHETIC / STYLE:
{{selectedStyle}}

CRITICAL INSTRUCTIONS:
1. SUBJECT: The design subject must be centered, high-contrast, and clearly defined.
2. STYLE: The artwork should be flat vector style, suitable for screen printing or DTG printing on apparel. Do not include photorealistic elements unless specified.
3. TYPOGRAPHY: If the concept includes text, render it clearly with bold, readable typography that matches the aesthetic.
4. ISOLATION: The design is a standalone graphic with a clean outer edge. Background and composition rules follow below.

Output ONLY the image without any text descriptions or chat formatting.`;

export const LEGACY_GENERATE_LISTING = `You are an Elite Etsy SEO Specialist and POD Listing Copywriter for the US market.
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

SEASONAL SHOPPING & TREND CONTEXT:
{{seasonalityContext}}

PRIMARY CANDIDATE KEYWORDS & REAL ETSY METRICS:
{{keywords}}

PROVEN COMPETITOR CO-OCCURRING SUB-KEYWORDS & REAL ETSY METRICS (Extracted from bestselling Etsy competitor listings):
{{coOccurringTags}}

CRITICAL VISUAL VALIDATION & SELECTION STRATEGY:
1. TRADEMARK & IP SAFETY MANDATE: ABSOLUTELY FORBIDDEN to use any trademarked brand names, franchises, pop culture icons, or generic trademark traps (e.g. Disney, Marvel, Harry Potter, Barbie, Swiftie, Taylor Swift, Nike, Onesie, Velcro, Stanley Cup, etc.). All titles, descriptions, and tags MUST be 100% original and safe.
2. FULL EVALUATION OF BOTH KEYWORD GROUPS: You are provided with two rich keyword sets: (1) Primary Candidate Keywords and (2) Proven Competitor Co-Occurring Sub-Keywords, both evaluated with real Etsy Opportunity Scores (including dynamic seasonal trend boosts), listing counts, bestsellers, and autocomplete rankings. Evaluate BOTH groups together to select the most profitable, high-demand, low-competition tags.
3. STRICT SUBJECT FILTERING: Only include keywords directly relevant to the actual design subject ({{primarySubject}}) and aesthetic ({{primaryAesthetic}}). ABSOLUTELY FORBID and ELIMINATE any unrelated subjects, animals, or themes (for example, if the subject is Rabbit, NEVER use 'dog', 'cat', 'horse', 'nurse', 'teacher', etc.).
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
   - taxonomy_id: You MUST always return exactly the taxonomy ID provided here: {{taxonomyId}}. Do not use the example's ID.
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

export const LEGACY_OPTIMIZE_LISTING = `You are a World-Class Etsy SEO Strategist, Copywriter, and E-Commerce Conversion Optimization Expert.
Your goal is to take an existing Etsy listing and optimize its Title, Tags, and Description to maximize search ranking, click-through rate, and conversions.

### Current Seasonal Trend Context:
- Active Wave: {{seasonName}}
- Recommended Seasonal Keywords: {{seasonKeywords}}

### Available High-Opportunity Keyword Pool from Database:
{{poolKeywords}}

### Strict Rules:
1. **Title**:
   - MUST be between 120 and 140 characters.
   - Front-load the most powerful, high-intent niche phrase in the first 40 characters (e.g. "Vintage Japanese Samurai Cat Shirt, Retro Graphic Tee...").
   - Use clean separators like "|" or ",".
   - Do NOT repeat the same word more than twice.
2. **Tags**:
   - Generate EXACTLY 13 golden tags.
   - Every single tag MUST be 20 characters or fewer.
   - Prioritize multi-word long-tail phrases (e.g. "vintage cat shirt", "retro anime tee").
   - NO trademarks (no Disney, Nike, Marvel, Taylor Swift, etc.).
3. **Description**:
   - Engaging opening hook in first 160 chars.
   - Key Features bullet points (Fabric, Fit, Quality).
   - Sizing and Fit Guide summary.
   - Care Instructions (Wash inside out, cool wash, do not iron on print).
   - Production & Shipping timeline note.
   - Helpful Gift Idea notes.

### Listing Details to Optimize:
- Current Title: "{{title}}"
- Current Tags: [{{tags}}]
- Product Price: {{price}}
- Product Type / Niche: {{productType}}
- Vision AI Primary Subject: "{{primarySubject}}"
- Vision AI Aesthetic Style: "{{primaryAesthetic}}"
- Vision Detected Colors: [{{colors}}]
- Vision Visual Description: "{{visualDescription}}"
- Extra User Instructions: "{{userInstructions}}"

### Expected Output:
Return ONLY valid JSON (no markdown backticks, no wrapping text):
{
  "title": "Optimized 120-140 chars Etsy Title",
  "tags": ["tag 1", "tag 2", "tag 3", "tag 4", "tag 5", "tag 6", "tag 7", "tag 8", "tag 9", "tag 10", "tag 11", "tag 12", "tag 13"],
  "description": "Full structured markdown/plain text formatted Etsy description.",
  "rationale": "Short 2-3 sentence summary of why this SEO strategy will boost ranking."
}`;

export const LEGACY_GENERATE_VIDEO = `Realistic e-commerce product video. The exact {{product}} from the reference image is displayed on an invisible (ghost) mannequin in a bright, clean photo studio. The camera slowly orbits to show the garment from the front, three-quarter and side angles, then gently pushes in on the printed design. Soft natural lighting, subtle fabric movement, photorealistic.
Keep the garment color, the printed artwork and its placement exactly as in the reference image; do not change, add or distort any text or graphics.
No captions, no watermarks, no logos, no on-screen text.`;

export const LEGACY_GENERATE_DESIGN_V3 = `Create a print-ready t-shirt graphic for an Etsy print-on-demand shop.

CONCEPT:
{{concept}}

STYLE: {{style}}

DESIGN RULES:
- Flat, vector-style artwork suitable for DTG and screen printing. No photorealism unless the concept asks for it.
- One clear focal subject with strong contrast, readable from a distance.
- Any text must be in English, spelled correctly, short and meaningful, in bold readable typography that matches the style. No placeholder, filler or gibberish text.
- No trademarks, brand names, logos, celebrities or copyrighted characters.

CANVAS AND BACKGROUND (required for automatic background removal):
- Square canvas with one single standalone graphic, centered horizontally and vertically, covering about 85-90% of the canvas width with equal empty margins on all four sides. Nothing touches or is cut off by the canvas edges.
- Background: one flat, uniform {{keyColorName}} ({{keyColorHex}}) fill covering the entire canvas edge to edge. No gradient, texture, noise, shadow, vignette, border or frame.
- Do not use {{keyColorName}} or similar shades anywhere in the design. Draw green elements in dark forest green, olive or teal instead of bright green, and pink or purple elements in burgundy, coral or soft lavender instead of magenta.
- Crisp, clean outer edges with a solid outline. No glow, haze, smoke, drop shadow or soft spray touching the background, and no stray specks around the design.

Output only the image.`;

export const LEGACY_GENERATE_LISTING_V2 = `You are an expert Etsy SEO copywriter for a US print-on-demand apparel shop. Write the listing for this design.

DESIGN DESCRIPTION:
{{designDescription}}

MAIN SUBJECT: {{primarySubject}}
AESTHETIC / STYLE: {{primaryAesthetic}}
PRODUCT TYPE: {{productType}}
SHOP NOTES (product details from the shop owner): {{userNotes}}

CANDIDATE KEYWORDS WITH ETSY METRICS (prefer high opportunity scores and phrases that fit in 20 characters):
{{keywords}}

TAGS THAT BEST-SELLING COMPETITORS USE TOGETHER WITH THESE KEYWORDS:
{{coOccurringTags}}

RULES:
1. RELEVANCE: use only phrases that match this design's subject ({{primarySubject}}) and aesthetic ({{primaryAesthetic}}). Never add unrelated subjects, animals, professions or themes.
2. NO TRADEMARKS: no brand names, celebrities, sports teams, copyrighted characters or protected phrases.
3. TAGS: exactly 13 tags, each at most 20 characters including spaces, no duplicates. Spread them across: subject + product, the message or quote on the design, aesthetic / style, buyer intent and gifting (who it is for, occasion), and micro-niche phrases.
4. TITLE: at most 140 characters. Start with the strongest buyer search phrase (the design's message or subject + product type), then add subject, aesthetic and gift intent, separated by commas. Do not repeat a word more than twice.
5. DESCRIPTION: an engaging first sentence about the design and who it is for, then short sections: Product Highlights, Sizing, Care, Shipping. State product facts only if they appear in SHOP NOTES or PRODUCT TYPE; never invent garment brands, fabric blends, weights, certifications or delivery times.
6. ETSY FIELDS:
   - taxonomy_id: always {{taxonomyId}}.
   - who_made: "i_did". when_made: "made_to_order". is_supply: false.
   - materials: up to 5 simple names from this list, only if they match the product: Cotton, Polyester, Ceramic, Glass, Wood, Metal, Paper, Canvas. No percentages or special characters.
   - styles: up to 2 style names (e.g. "Boho & Hippie", "Minimalist").
   - shop_section_id: the ID of the best matching shop section below, or null if none fits:
   {{shopSections}}
   - taxonomy_properties_values: value_ids for the properties below that clearly fit the design; omit the rest. Never include size or color properties (Size, Color, Unisex shirt size, Clothing size, Primary color, Secondary color); variations handle those.
   {{taxonomyProperties}}

Return ONLY a valid JSON object in this format, with no markdown and no explanation:
{
  "title": "SEO title, at most 140 characters",
  "description": "Structured Etsy description",
  "selectedTags": ["tag 1", "tag 2", "tag 3", "tag 4", "tag 5", "tag 6", "tag 7", "tag 8", "tag 9", "tag 10", "tag 11", "tag 12", "tag 13"],
  "suggestedBasePrice": 24.99,
  "detectedSubject": "main subject",
  "detectedAesthetic": "main aesthetic",
  "taxonomy_id": {{taxonomyId}},
  "who_made": "i_did",
  "when_made": "made_to_order",
  "materials": ["Cotton"],
  "styles": ["Minimalist"],
  "is_supply": false,
  "shop_section_id": null,
  "taxonomy_properties_values": [
    { "property_id": 0, "value_ids": [0] }
  ]
}`;

export const LEGACY_NICHE_RESEARCH_V1 = `You are a senior Etsy print-on-demand market researcher for the US market.
Today is {{today}}. Pick ONE design niche for a new {{productType}} listing that is most likely to sell on Etsy.
Etsy buyers search for seasonal products 6-10 weeks before the date, so favor occasions inside that window; evergreen niches are fine when nothing seasonal fits.
Etsy category: {{category}}
The shop owner's general direction (stay within it; "none" means no restriction): {{focus}}

Upcoming US occasions:
{{upcomingEvents}}

The shop's best performing listings (favorites/views) — learn which themes and styles resonate, but do not copy them:
{{topListings}}

Etsy keyword data from our research pool (higher score = better opportunity):
{{poolKeywords}}

Niches already used recently by this automation — choose something clearly different:
{{recentNiches}}

If a Google Search tool is available, use it to check what is trending right now for this window: Etsy trending searches, Pinterest trends/Pinterest Predicts, Google Trends, social media and pop culture moments. Prefer niches with rising demand and reasonable competition.

Rules: no trademarks, brand names, celebrities, sports teams, copyrighted characters or quotes from movies/songs. All design text must be in English.
Respond with ONLY a JSON object (no markdown) with these fields:
{"niche": "short niche phrase in English", "targetAudience": "who buys it", "style": "visual style (e.g. retro distressed, cute kawaii, minimalist line art)",
 "designBrief": "1-2 sentences describing the artwork and any short English text on it", "occasion": "occasion name or null",
 "keywords": ["5-10 Etsy search phrases buyers would type"], "reasoning": "2-3 sentences in Turkish explaining why this niche now"}`;

export const LEGACY_GENERATE_VIDEO_V2 = `Ultra-realistic product video of the exact {{product}} from the reference image, worn by a mannequin in a bright, clean photo studio. Show the mannequin from several angles (front, three-quarter and side) with slow, smooth camera movement, ending on a close-up of the printed design. Soft natural lighting, subtle fabric movement, photorealistic.
The printed design must stay exactly identical to the reference image: same artwork, colors, placement and size. All text on the design must stay exactly as in the reference image, spelled correctly and fully legible. Do not add, remove or distort any text or graphics, because this video advertises a real product for sale.
No captions, watermarks, logos or on-screen text.`;

export const LEGACY_GENERATE_DESIGN_V4 = `Create a print-ready t-shirt graphic for an Etsy print-on-demand shop.

CONCEPT:
{{concept}}

STYLE: {{style}}
AUDIENCE / GARMENT FIT: {{audienceGroup}}
PRINT FABRIC: {{fabric}}

DESIGN RULES:
- Flat, vector-style artwork suitable for DTG and screen printing. No photorealism unless the concept asks for it.
- One clear focal subject with strong contrast, readable from a distance.
- Choose ink colors that stand out on the print fabric: dark, saturated inks on light garments; light and bright inks on dark garments (avoid large black or very dark areas); a self-contained palette with a solid outline when the design must work on both.
- Any text must be in English, spelled correctly, short and meaningful, in bold readable typography that matches the style. No placeholder, filler or gibberish text.
- No trademarks, brand names, logos, celebrities or copyrighted characters.

CANVAS AND BACKGROUND (required for automatic background removal):
- Square canvas with one single standalone graphic, centered horizontally and vertically, covering about 85-90% of the canvas width with equal empty margins on all four sides. Nothing touches or is cut off by the canvas edges.
- Background: one flat, uniform {{keyColorName}} ({{keyColorHex}}) fill covering the entire canvas edge to edge. No gradient, texture, noise, shadow, vignette, border or frame.
- Do not use {{keyColorName}} or similar shades anywhere in the design. Draw green elements in dark forest green, olive or teal instead of bright green, and pink or purple elements in burgundy, coral or soft lavender instead of magenta.
- Crisp, clean outer edges with a solid outline. No glow, haze, smoke, drop shadow or soft spray touching the background, and no stray specks around the design.

Output only the image.`;

export const LEGACY_GENERATE_DESIGN_V5 = `Create a print-ready t-shirt graphic for an Etsy print-on-demand shop.

CONCEPT:
{{concept}}

STYLE: {{style}}
AUDIENCE / GARMENT FIT: {{audienceGroup}}
PRINT FABRIC: {{fabric}}

DESIGN RULES:
- Flat, vector-style artwork suitable for DTG and screen printing. No photorealism unless the concept asks for it.
- One clear focal subject with strong contrast, readable from a distance.
- Choose ink colors that stand out on the print fabric: dark, saturated inks on light garments; light and bright inks on dark garments (avoid large black or very dark areas); a self-contained palette with a solid outline when the design must work on both.
- Any text must be in English, spelled correctly, short and meaningful, in bold readable typography that matches the style. No placeholder, filler or gibberish text.
- Keep the layout simple enough to read on a shirt from a few meters away: at most three text elements (for example a headline, a subline and one short tagline), with no small text badges, labels, captions or arrows.
- Use "EST." or similar founding phrases only together with a year (for example "EST. 2026"); otherwise leave them out.
- No trademarks, brand names, logos, celebrities or copyrighted characters.

CANVAS AND BACKGROUND (required for automatic background removal):
- Square canvas with one single standalone graphic, centered horizontally and vertically, covering about 85-90% of the canvas width with equal empty margins on all four sides. Nothing touches or is cut off by the canvas edges.
- Background: one flat, uniform {{keyColorName}} ({{keyColorHex}}) fill covering the entire canvas edge to edge. No gradient, texture, noise, shadow, vignette, border or frame.
- Do not use {{keyColorName}} or similar shades anywhere in the design. Draw green elements in dark forest green, olive or teal instead of bright green, and pink or purple elements in burgundy, coral or soft lavender instead of magenta.
- Crisp, clean outer edges with a solid outline. No glow, haze, smoke, drop shadow or soft spray touching the background, and no stray specks around the design.

Output only the image.`;

export const LEGACY_GENERATE_LISTING_V3 = `You are an expert Etsy SEO copywriter for a US print-on-demand apparel shop. Write the listing for this design.

DESIGN DESCRIPTION:
{{designDescription}}

MAIN SUBJECT: {{primarySubject}}
AESTHETIC / STYLE: {{primaryAesthetic}}
PRODUCT TYPE: {{productType}}
AUDIENCE / GARMENT FIT: {{audienceGroup}}
GARMENT OPTIONS THE BUYER CAN CHOOSE: {{garments}}
SHOP NOTES (product details from the shop owner): {{userNotes}}

CANDIDATE KEYWORDS WITH ETSY METRICS (prefer high opportunity scores and phrases that fit in 20 characters):
{{keywords}}

TAGS THAT BEST-SELLING COMPETITORS USE TOGETHER WITH THESE KEYWORDS:
{{coOccurringTags}}

RULES:
1. RELEVANCE: use only phrases that match this design's subject ({{primarySubject}}) and aesthetic ({{primaryAesthetic}}). Never add unrelated subjects, animals, professions or themes.
2. NO TRADEMARKS: no brand names, celebrities, sports teams, copyrighted characters or protected phrases in the title or tags (garment model names may appear only in the description).
3. TAGS: exactly 13 tags, each at most 20 characters including spaces, no duplicates. Spread them across: subject + product, the message or quote on the design, aesthetic / style, buyer intent and gifting (who it is for, occasion), and micro-niche phrases.
4. TITLE: at most 140 characters. Start with the strongest buyer search phrase (the design's message or subject + product type), then add subject, aesthetic and gift intent, separated by commas. Do not repeat a word more than twice.
5. DESCRIPTION: an engaging first sentence about the design and who it is for, then short sections: Product Highlights, Sizing, Care, Shipping. Describe the GARMENT OPTIONS as the available choices (a short line for each). State product facts only if they appear in GARMENT OPTIONS, SHOP NOTES or PRODUCT TYPE; never invent garment brands, fabric blends, weights, certifications or delivery times.
6. ETSY FIELDS:
   - taxonomy_id: always {{taxonomyId}}.
   - who_made: "i_did". when_made: "made_to_order". is_supply: false.
   - materials: up to 5 simple names from this list, only if they match the product: Cotton, Polyester, Ceramic, Glass, Wood, Metal, Paper, Canvas. No percentages or special characters.
   - styles: up to 2 style names (e.g. "Boho & Hippie", "Minimalist").
   - shop_section_id: the ID of the best matching shop section below, or null if none fits:
   {{shopSections}}
   - taxonomy_properties_values: value_ids for the properties below that clearly fit the design; omit the rest. Never include size or color properties (Size, Color, Unisex shirt size, Clothing size, Primary color, Secondary color); variations handle those.
   {{taxonomyProperties}}

Return ONLY a valid JSON object in this format, with no markdown and no explanation:
{
  "title": "SEO title, at most 140 characters",
  "description": "Structured Etsy description",
  "selectedTags": ["tag 1", "tag 2", "tag 3", "tag 4", "tag 5", "tag 6", "tag 7", "tag 8", "tag 9", "tag 10", "tag 11", "tag 12", "tag 13"],
  "suggestedBasePrice": 24.99,
  "detectedSubject": "main subject",
  "detectedAesthetic": "main aesthetic",
  "taxonomy_id": {{taxonomyId}},
  "who_made": "i_did",
  "when_made": "made_to_order",
  "materials": ["Cotton"],
  "styles": ["Minimalist"],
  "is_supply": false,
  "shop_section_id": null,
  "taxonomy_properties_values": [
    { "property_id": 0, "value_ids": [0] }
  ]
}`;

export const LEGACY_GENERATE_LISTING_V4 = `You are an expert Etsy SEO copywriter for a US print-on-demand apparel shop. Write the listing for this design.

DESIGN DESCRIPTION:
{{designDescription}}

MAIN SUBJECT: {{primarySubject}}
AESTHETIC / STYLE: {{primaryAesthetic}}
PRODUCT TYPE: {{productType}}
AUDIENCE / GARMENT FIT: {{audienceGroup}}
GARMENT OPTIONS THE BUYER CAN CHOOSE: {{garments}}
SHOP NOTES (product details from the shop owner): {{userNotes}}

CANDIDATE KEYWORDS WITH ETSY METRICS (prefer high opportunity scores and phrases that fit in 20 characters):
{{keywords}}

TAGS THAT BEST-SELLING COMPETITORS USE TOGETHER WITH THESE KEYWORDS:
{{coOccurringTags}}

RULES:
1. RELEVANCE: use only phrases that match this design's subject ({{primarySubject}}) and aesthetic ({{primaryAesthetic}}). Never add unrelated subjects, animals, professions or themes.
2. NO TRADEMARKS: no brand names, celebrities, sports teams, copyrighted characters or protected phrases in the title or tags. The only exception: the garment model names from GARMENT OPTIONS appear in the description.
3. TAGS: exactly 13 tags, each at most 20 characters including spaces, no duplicates. Cover different searches instead of repeating one word: the same word may appear in at most 4 tags. Spread them across: subject + product, the message or quote on the design, related roles and synonyms, aesthetic / style, buyer intent and gifting (who it is for, occasion), and micro-niche phrases. Every tag must describe this exact design.
4. TITLE: at most 140 characters. Start with the strongest buyer search phrase (the design's message or subject + product type), then add subject, aesthetic and gift intent, separated by commas. Do not repeat a word more than twice.
5. DESCRIPTION: an engaging first sentence about the design and who it is for, then short sections: Product Highlights, Sizing, Care, Shipping. List the GARMENT OPTIONS as the available choices, copying each name exactly as written (do not rename, shorten, translate or reinterpret it, and do not guess its fit, size range or material). State product facts only if they appear in GARMENT OPTIONS, SHOP NOTES or PRODUCT TYPE; never invent garment brands, fabric blends, weights, certifications, size ranges or delivery times.
6. ETSY FIELDS:
   - taxonomy_id: always {{taxonomyId}}.
   - who_made: "i_did". when_made: "made_to_order". is_supply: false.
   - materials: up to 5 simple names from this list, only if they match the product: Cotton, Polyester, Ceramic, Glass, Wood, Metal, Paper, Canvas. No percentages or special characters.
   - styles: up to 2 style names (e.g. "Boho & Hippie", "Minimalist").
   - shop_section_id: the ID of the best matching shop section below, or null if none fits:
   {{shopSections}}
   - taxonomy_properties_values: value_ids for the properties below that clearly fit the design; omit the rest. Never include size or color properties (Size, Color, Unisex shirt size, Clothing size, Primary color, Secondary color); variations handle those.
   {{taxonomyProperties}}

Return ONLY a valid JSON object in this format, with no markdown and no explanation:
{
  "title": "SEO title, at most 140 characters",
  "description": "Structured Etsy description",
  "selectedTags": ["tag 1", "tag 2", "tag 3", "tag 4", "tag 5", "tag 6", "tag 7", "tag 8", "tag 9", "tag 10", "tag 11", "tag 12", "tag 13"],
  "suggestedBasePrice": 24.99,
  "detectedSubject": "main subject",
  "detectedAesthetic": "main aesthetic",
  "taxonomy_id": {{taxonomyId}},
  "who_made": "i_did",
  "when_made": "made_to_order",
  "materials": ["Cotton"],
  "styles": ["Minimalist"],
  "is_supply": false,
  "shop_section_id": null,
  "taxonomy_properties_values": [
    { "property_id": 0, "value_ids": [0] }
  ]
}`;

export const LEGACY_GENERATE_LISTING_V5 = `You are an expert Etsy SEO copywriter for a US print-on-demand apparel shop. Write the listing for this design.

DESIGN DESCRIPTION:
{{designDescription}}

MAIN SUBJECT: {{primarySubject}}
AESTHETIC / STYLE: {{primaryAesthetic}}
PRODUCT TYPE: {{productType}}
AUDIENCE / GARMENT FIT: {{audienceGroup}}
GARMENT OPTIONS THE BUYER CAN CHOOSE: {{garments}}
SHOP NOTES (product details from the shop owner): {{userNotes}}

CANDIDATE KEYWORDS WITH ETSY METRICS (prefer high opportunity scores and phrases that fit in 20 characters):
{{keywords}}

TAGS THAT BEST-SELLING COMPETITORS USE TOGETHER WITH THESE KEYWORDS:
{{coOccurringTags}}

RULES:
1. RELEVANCE: use only phrases that match this design's subject ({{primarySubject}}) and aesthetic ({{primaryAesthetic}}). Never add unrelated subjects, animals, professions or themes.
2. NO TRADEMARKS: no brand names, celebrities, sports teams, copyrighted characters or protected phrases in the title or tags. The only exception: the garment model names from GARMENT OPTIONS appear in the description.
3. TAGS: exactly 13 tags, each at most 20 characters including spaces, no duplicates. Cover different searches instead of repeating one word: the same word may appear in at most 4 tags. Spread them across: subject + product, the message or quote on the design, related roles and synonyms, aesthetic / style, buyer intent and gifting (who it is for, occasion), and micro-niche phrases. Every tag must describe this exact design.
4. TITLE: at most 140 characters. Start with the strongest buyer search phrase (the design's message or subject + product type), then add subject, aesthetic and gift intent, separated by commas. Do not repeat a word more than twice.
5. DESCRIPTION: an engaging first sentence about the design and who it is for, then short sections: Product Highlights, Sizing, Care, Shipping. List the GARMENT OPTIONS as the available choices, copying each name exactly as written (do not rename, shorten, translate or reinterpret it, and do not guess its fit, size range or material). State product facts only if they appear in GARMENT OPTIONS, SHOP NOTES or PRODUCT TYPE; never invent garment brands, fabric blends, weights, certifications, size ranges or delivery times.
6. ETSY FIELDS:
   - taxonomy_id: always {{taxonomyId}}.
   - who_made: "i_did". when_made: "made_to_order". is_supply: false.
   - materials: up to 5 simple names from this list, only if they match the product: Cotton, Polyester, Ceramic, Glass, Wood, Metal, Paper, Canvas. No percentages or special characters.
   - styles: up to 2 style names (e.g. "Boho & Hippie", "Minimalist").
   - shop_section_id: the ID of the best matching shop section below, or null if none fits:
   {{shopSections}}
   - taxonomy_properties_values: Etsy category attributes buyers filter by (e.g. sleeve length, neckline, clothing style, occasion, holiday, graphic, material features). Fill every property below that genuinely applies to this product and design, choosing only value_ids from its list (one value unless the property allows several); omit properties that do not apply. Never include size or color properties (Size, Color, Unisex shirt size, Clothing size, Primary color, Secondary color); variations handle those.
   {{taxonomyProperties}}

Return ONLY a valid JSON object in this format, with no markdown and no explanation:
{
  "title": "SEO title, at most 140 characters",
  "description": "Structured Etsy description",
  "selectedTags": ["tag 1", "tag 2", "tag 3", "tag 4", "tag 5", "tag 6", "tag 7", "tag 8", "tag 9", "tag 10", "tag 11", "tag 12", "tag 13"],
  "suggestedBasePrice": 24.99,
  "detectedSubject": "main subject",
  "detectedAesthetic": "main aesthetic",
  "taxonomy_id": {{taxonomyId}},
  "who_made": "i_did",
  "when_made": "made_to_order",
  "materials": ["Cotton"],
  "styles": ["Minimalist"],
  "is_supply": false,
  "shop_section_id": null,
  "taxonomy_properties_values": [
    { "property_id": 0, "value_ids": [0] }
  ]
}`;

export const LEGACY_GENERATE_DESIGN_V6 = `Create a print-ready t-shirt graphic for an Etsy print-on-demand shop.

CONCEPT:
{{concept}}

STYLE: {{style}}
AUDIENCE / GARMENT FIT: {{audienceGroup}}
PRINT FABRIC: {{fabric}}

DESIGN RULES:
- Flat, vector-style artwork suitable for DTG and screen printing. No photorealism unless the concept asks for it.
- One clear focal subject with strong contrast, readable from a distance.
- Choose ink colors that stand out on the print fabric: dark, saturated inks on light garments; light and bright inks on dark garments (avoid large black or very dark areas); a self-contained palette with a solid outline when the design must work on both.
- Any text must be in English, spelled correctly and meaningful, in readable typography that matches the style. No placeholder, filler or gibberish text (for example, an "EST." needs a year).
- Clean, balanced composition with a clear visual hierarchy: the main message and subject read at a glance on a shirt. Supporting text, badges and small details are welcome when they strengthen the idea, not as clutter.
- No trademarks, brand names, logos, celebrities or copyrighted characters.

CANVAS AND BACKGROUND (required for automatic background removal):
- Square canvas with one single standalone graphic, centered horizontally and vertically, covering about 85-90% of the canvas width with equal empty margins on all four sides. Nothing touches or is cut off by the canvas edges.
- Background: one flat, uniform {{keyColorName}} ({{keyColorHex}}) fill covering the entire canvas edge to edge. No gradient, texture, noise, shadow, vignette, border or frame.
- Do not use {{keyColorName}} or similar shades anywhere in the design. Draw green elements in dark forest green, olive or teal instead of bright green, and pink or purple elements in burgundy, coral or soft lavender instead of magenta.
- Crisp, clean outer edges with a solid outline. No glow, haze, smoke, drop shadow or soft spray touching the background, and no stray specks around the design.

Output only the image.`;

export const LEGACY_GENERATE_DESIGN_V7 = `Create a print-ready t-shirt graphic for an Etsy print-on-demand shop.

CONCEPT:
{{concept}}

STYLE: {{style}}
AUDIENCE / GARMENT FIT: {{audienceGroup}}
PRINT FABRIC: {{fabric}}

DESIGN RULES:
- Flat, vector-style artwork suitable for DTG and screen printing. No photorealism unless the concept asks for it.
- One clear focal subject with strong contrast, readable from a distance.
- Choose ink colors that stand out on the print fabric: dark, saturated inks on light garments; light and bright inks on dark garments (avoid large black or very dark areas); a self-contained palette with a solid outline when the design must work on both.
- Any text must be in English, spelled correctly and meaningful, in readable typography that matches the style. No placeholder, filler or gibberish text (for example, an "EST." needs a year).
- Clean, balanced composition with a clear visual hierarchy: the main message and subject read at a glance on a shirt. Supporting text and small details are welcome when they strengthen the idea, not as clutter.
- Full-front print: this graphic is printed large (about 11-12 inches wide) across the front of the shirt, so it must look like a bold front graphic, not a small logo. Build it around an open illustration or a strong typographic layout. Do not make the whole design a circular badge, round seal, crest, patch or emblem enclosed in a circle or shield (the kind of mark meant for a small left-chest print).
- No trademarks, brand names, logos, celebrities or copyrighted characters.

CANVAS AND BACKGROUND (required for automatic background removal):
- Square canvas with one single standalone graphic, centered horizontally and vertically, covering about 85-90% of the canvas width with equal empty margins on all four sides. Nothing touches or is cut off by the canvas edges.
- Background: one flat, uniform {{keyColorName}} ({{keyColorHex}}) fill covering the entire canvas edge to edge. No gradient, texture, noise, shadow, vignette, border or frame.
- Do not use {{keyColorName}} or similar shades anywhere in the design. Draw green elements in dark forest green, olive or teal instead of bright green, and pink or purple elements in burgundy, coral or soft lavender instead of magenta.
- Crisp, clean outer edges with a solid outline. No glow, haze, smoke, drop shadow or soft spray touching the background, and no stray specks around the design.

Output only the image.`;

export const LEGACY_DESIGN_VARIANT_V1 = `Redraw this exact t-shirt graphic as a version for {{fabric}}.

Keep everything identical: composition, subject, characters, layout, proportions, all text and its spelling. Change only the ink colors so the design stands out clearly on {{fabric}}: light and bright inks for dark garments (avoid large black or very dark areas), dark and saturated inks for light garments. Keep the color harmony of the original.

CANVAS AND BACKGROUND (required for automatic background removal):
- Square canvas, the graphic centered with equal empty margins, same size as in the original.
- Background: one flat, uniform {{keyColorName}} ({{keyColorHex}}) fill covering the entire canvas edge to edge. No gradient, texture, shadow, border or frame. Do not use {{keyColorName}} or similar shades in the design.
- Crisp, clean outer edges with a solid outline; no glow, haze or soft shadow touching the background.

Output only the image.`;
