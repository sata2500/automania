import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { etsyTaxonomyCache, appSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Return all categories from the cache
    const categories = await db.select().from(etsyTaxonomyCache).orderBy(etsyTaxonomyCache.name);
    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action, id, isActive } = await req.json().catch(() => ({ action: 'sync' }));
    
    // Action: Update single category's isActive status
    if (action === 'update' && id) {
      await db.update(etsyTaxonomyCache)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(etsyTaxonomyCache.id, id));
      return NextResponse.json({ success: true });
    }

    // Action: Sync from Etsy
    if (action === 'sync') {
      const settings = await db.select().from(appSettings);
      let key = process.env.ETSY_API_KEY;
      let secret = process.env.ETSY_SHARED_SECRET;
      
      settings.forEach(s => {
        if (s.settingKey === 'etsy_keystring') key = s.settingValue || undefined;
        if (s.settingKey === 'etsy_shared_secret') secret = s.settingValue || undefined;
      });

      if (!key || !secret) {
        return NextResponse.json({ success: false, error: 'Etsy API Key or Secret not found' }, { status: 400 });
      }

      const res = await fetch(`https://openapi.etsy.com/v3/application/seller-taxonomy/nodes`, {
        headers: { 'x-api-key': `${key}:${secret}` }
      });

      if (!res.ok) {
        throw new Error(`Etsy API Error: ${await res.text()}`);
      }

      const data = await res.json();
      const flatNodes: any[] = [];
      const defaultActiveIds = [482, 2202, 1853, 1062, 153, 101, 1054]; // Default POD items

      const flatten = (nodes: any[], path: string = "") => {
        for (const node of nodes) {
          const currentPath = path ? `${path} > ${node.name}` : node.name;
          flatNodes.push({
            id: node.id,
            name: node.name,
            path: currentPath,
            isActive: defaultActiveIds.includes(node.id)
          });
          if (node.children) {
            flatten(node.children, currentPath);
          }
        }
      };

      flatten(data.results || []);

      // Bulk insert/upsert
      // We process in chunks to avoid query size limits
      const chunkSize = 1000;
      for (let i = 0; i < flatNodes.length; i += chunkSize) {
        const chunk = flatNodes.slice(i, i + chunkSize);
        await db.insert(etsyTaxonomyCache)
          .values(chunk)
          .onConflictDoUpdate({
            target: etsyTaxonomyCache.id,
            set: {
              name: sql`EXCLUDED.name`,
              path: sql`EXCLUDED.path`,
              updatedAt: new Date()
            }
            // Notice: we DO NOT overwrite isActive here, so user's manual changes are preserved
          });
      }

      return NextResponse.json({ success: true, count: flatNodes.length });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
