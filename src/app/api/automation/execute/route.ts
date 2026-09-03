/**
 * POST /api/automation/execute
 * =============================
 * "Kur ve Unut" otomasyonunun arka planda çalışan ana iş yükleyicisi.
 * Bu endpoint fire-and-forget olarak çağrılır ve otomasyon adımlarını
 * sırayla işler (Design Gen -> Bg Removal -> ...).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, sql } from '@/lib/db';
import { automationRuns, podTemplates, userWorkspaces } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { loadAIConfig, generateImage } from '@/lib/ai-provider';
import { removeGreenBackground } from '@/lib/chroma-key';
import { uploadToR2, isR2Configured } from '@/lib/r2';
import { DesignItem } from '@/types/pod';
import { AutomationRunSteps } from '@/types/templates';

export async function POST(req: NextRequest) {
  try {
    const internalToken = req.headers.get('X-Internal-Token');
    const expectedToken = process.env.INTERNAL_API_TOKEN ?? 'dev-internal';
    
    if (internalToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized internal call' }, { status: 401 });
    }

    const { runId, templateId, userId } = await req.json();

    if (!runId || !templateId || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Fetch template and run record
    const [template] = await db
      .select()
      .from(podTemplates)
      .where(and(eq(podTemplates.id, templateId), eq(podTemplates.userId, userId)));

    const [run] = await db
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.id, runId));

    if (!template || !run) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // 2. State setup
    const steps = run.steps as unknown as AutomationRunSteps;
    
    const updateRunState = async (updates: Partial<typeof run>) => {
      await db.update(automationRuns).set(updates).where(eq(automationRuns.id, runId));
    };

    await updateRunState({
      status: 'running',
      startedAt: new Date().toISOString(),
      steps: {
        ...steps,
        designGeneration: { status: 'running', startedAt: new Date().toISOString() }
      }
    });

    // 3. AI Config and Prompt
    const config = await loadAIConfig();
    let systemPromptTemplate = '';
    try {
      const rows = await sql`SELECT setting_value FROM app_settings WHERE setting_key = 'ai_prompt_generate_design'`;
      if (rows.length > 0 && rows[0].setting_value) {
        systemPromptTemplate = rows[0].setting_value;
      }
    } catch (e) {
      console.error('[Automation] Failed to fetch custom prompt template', e);
    }

    const basePrompt = template.seoHints.customNotes 
      ? template.seoHints.customNotes 
      : `Creative design for ${template.seoHints.primaryNiche}, tailored for ${template.seoHints.targetAudience}`;
      
    let finalPrompt = basePrompt;
    if (systemPromptTemplate.trim()) {
      finalPrompt = systemPromptTemplate
        .replace(/\{\{userPrompt\}\}/g, basePrompt)
        .replace(/\{\{selectedStyle\}\}/g, template.seoHints.primaryNiche);
    }

    // 4. Generate Design
    const generatedImages = await generateImage(config, { prompt: finalPrompt, greenBackground: true });
    
    if (!generatedImages || generatedImages.length === 0) {
      throw new Error('AI could not generate the design.');
    }
    
    const generatedData = generatedImages[0].data;

    steps.designGeneration = { status: 'completed', completedAt: new Date().toISOString() };
    steps.backgroundRemoval = { status: 'running', startedAt: new Date().toISOString() };
    await updateRunState({ steps });

    // 5. Remove Background (Chroma Key)
    const bgResult = await removeGreenBackground(generatedData, {
      threshold: 80,
      feather: 40
    });
    
    const pngBuffer = bgResult.pngBuffer;

    // 6. Upload to R2
    if (!isR2Configured()) {
      throw new Error('Storage is not configured. Please check R2 environment variables.');
    }
    
    const fileName = `auto-design-${runId}-${Date.now()}.png`;
    const uploadResult = await uploadToR2(pngBuffer, fileName, 'image/png');

    // 7. Save Design to User Workspace
    const newDesign: DesignItem = {
      id: `design-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Auto: ${template.name}`,
      src: uploadResult.url,
      width: 1024,
      height: 1024,
      isProductionActive: false,
      createdAt: Date.now(),
      tags: [],
      generatedByAI: true,
      promptUsed: finalPrompt,
    };

    const [workspace] = await db
      .select()
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userId));

    if (workspace) {
      const updatedDesigns = [...(workspace.designs as DesignItem[] || []), newDesign];
      await db.update(userWorkspaces)
        .set({ designs: updatedDesigns })
        .where(eq(userWorkspaces.userId, userId));
    } else {
      await db.insert(userWorkspaces).values({
        userId,
        designs: [newDesign],
      });
    }

    // 8. Update Run Record
    steps.backgroundRemoval = { status: 'completed', completedAt: new Date().toISOString() };
    await updateRunState({
      steps,
      generatedDesignId: newDesign.id,
      generatedDesignUrl: uploadResult.url,
    });

    // 9. Mockup Render (Jimp ile Şeffaf Tasarımı Mockup Üzerine Koyma)
    steps.mockupRender = { status: 'running', startedAt: new Date().toISOString() };
    await updateRunState({ steps });

    const generatedMockupUrls: string[] = [];

    if (template.mockupConfig.printAreaMockupIds && template.mockupConfig.printAreaMockupIds.length > 0) {
      try {
        const { renderDesignOnMockup } = await import('@/lib/backend-render');
        const [workspaceForMockups] = await db
          .select()
          .from(userWorkspaces)
          .where(eq(userWorkspaces.userId, userId));

        // Şablonun belirttiği mockup'lardan ilkini (veya hepsini) deneyelim. Şimdilik ilkini alıyoruz.
        const targetMockupId = template.mockupConfig.printAreaMockupIds[0];
        const targetMockup = (workspaceForMockups?.mockups as any[] || []).find(m => m.id === targetMockupId);

        if (targetMockup && targetMockup.src && targetMockup.printArea) {
           // Mockup buffer'ı R2 veya dış URL'den çekiyoruz
           const mockupRes = await fetch(targetMockup.src);
           if (mockupRes.ok) {
             const mockupBuffer = Buffer.from(await mockupRes.arrayBuffer());
             
             // pnBuffer zaten removeGreenBackground'dan geldi
             const compositedBuffer = await renderDesignOnMockup(mockupBuffer, pngBuffer, targetMockup.printArea);
             
             const compositeFileName = `auto-mockup-${runId}-${Date.now()}.png`;
             const uploadComposite = await uploadToR2(compositedBuffer, compositeFileName, 'image/png');
             generatedMockupUrls.push(uploadComposite.url);
           }
        }
      } catch (err) {
        console.error('[Automation] Mockup rendering failed', err);
        // Hata olsa da pipeline'ı çökertmemek için devam edebiliriz
      }
    }

    steps.mockupRender = { 
      status: generatedMockupUrls.length > 0 ? 'completed' : 'skipped', 
      completedAt: new Date().toISOString() 
    };
    
    await updateRunState({ 
      steps, 
      generatedMockupUrls 
    });

    // 10. Video Generation
    steps.videoGeneration = { status: 'running', startedAt: new Date().toISOString() };
    await updateRunState({ steps });
    let generatedVideoUrl: string | null = null;

    try {
      const { generateVideo } = await import('@/lib/ai-provider');
      
      let videoPromptTemplate = 'Create a cinematic showcase video for a t-shirt.';
      try {
        const rows = await sql`SELECT setting_value FROM app_settings WHERE setting_key = 'ai_prompt_generate_video'`;
        if (rows.length > 0 && rows[0].setting_value) {
          videoPromptTemplate = rows[0].setting_value;
        }
      } catch (e) {
        console.error('[Automation] Failed to load video prompt template', e);
      }

      const finalVideoPrompt = videoPromptTemplate
        .replace(/\{\{userPrompt\}\}/g, basePrompt)
        .replace(/\{\{selectedStyle\}\}/g, template.seoHints.primaryNiche);

      // AI Provider ayarlarından video modeli de geliyor
      const generatedVideo = await generateVideo(config, { prompt: finalVideoPrompt });
      
      if (generatedVideo && generatedVideo.uri) {
        generatedVideoUrl = generatedVideo.uri;
      }
      
      steps.videoGeneration = { status: 'completed', completedAt: new Date().toISOString() };
    } catch (err) {
      console.error('[Automation] Video generation failed', err);
      steps.videoGeneration = { status: 'failed', completedAt: new Date().toISOString() };
    }

    await updateRunState({ 
      steps,
      ...(generatedVideoUrl && { generatedVideoUrl }) 
    });

    // NOTE: SEO, Listing steps...
    
    steps.seoGeneration = { status: 'skipped' };
    steps.listingCreation = { status: 'skipped' };
    
    await updateRunState({
      status: 'completed',
      completedAt: new Date().toISOString(),
      steps
    });

    return NextResponse.json({ success: true, runId });
  } catch (error: unknown) {
    console.error('[Automation Execute] Error:', error);
    
    const reqBody = await req.clone().json().catch(() => ({}));
    if (reqBody.runId) {
      await db.update(automationRuns)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date().toISOString(),
        })
        .where(eq(automationRuns.id, reqBody.runId));
    }

    return NextResponse.json({ error: 'Internal pipeline error' }, { status: 500 });
  }
}
