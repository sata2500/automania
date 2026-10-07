/**
 * "Kur ve Unut" otomasyon pipeline'ı.
 * Adımlar: Design Gen -> Bg Removal -> Mockup Render -> Video -> (SEO, Listing: henüz yok)
 *
 * Bu modül hem `POST /api/automation/run` (after() ile, aynı istek içinde) hem de
 * yalnızca sunucu içi token ile korunan `POST /api/automation/execute` tarafından çağrılır.
 */
import { db, sql } from '@/lib/db';
import { automationRuns, podTemplates, userWorkspaces } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { loadAIConfig, generateImage } from '@/lib/ai-provider';
import { removeGreenBackground } from '@/lib/chroma-key';
import { uploadToR2, isR2Configured } from '@/lib/r2';
import { createOwnedUploadName } from '@/lib/upload-security';
import { loadSetting } from '@/lib/app-settings';
import { loadImageForUser } from '@/lib/media-source';
import type { DesignItem, MockupItem } from '@/types/pod';
import type { AutomationRunSteps } from '@/types/templates';

export type AutomationRunInput = {
  runId: string;
  templateId: string;
  userId: string;
};

export type AutomationRunOutcome =
  | { ok: true; runId: string }
  | { ok: false; runId: string; reason: 'not_found' | 'not_pending' | 'failed'; error?: string };

async function loadPromptSetting(key: string): Promise<string> {
  try {
    return (await loadSetting(key)) ?? '';
  } catch (error) {
    console.error(`[Automation] Failed to load prompt setting ${key}`, error);
    return '';
  }
}

export async function executeAutomationRun({ runId, templateId, userId }: AutomationRunInput): Promise<AutomationRunOutcome> {
  const [template] = await db
    .select()
    .from(podTemplates)
    .where(and(eq(podTemplates.id, templateId), eq(podTemplates.userId, userId)));

  const [run] = await db
    .select()
    .from(automationRuns)
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.userId, userId)));

  if (!template || !run) return { ok: false, runId, reason: 'not_found' };

  // Aynı run'ın iki kez çalıştırılmasını engelle: yalnızca 'pending' durumundaki kayıt 'running'e geçebilir.
  const claimed = await db
    .update(automationRuns)
    .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.status, 'pending')))
    .returning({ id: automationRuns.id });
  if (claimed.length === 0) return { ok: false, runId, reason: 'not_pending' };

  const steps = run.steps as unknown as AutomationRunSteps;
  const updateRunState = async (updates: Partial<typeof run>) => {
    await db.update(automationRuns).set({ ...updates, updatedAt: new Date() }).where(eq(automationRuns.id, runId));
  };

  try {
    steps.designGeneration = { status: 'running', startedAt: new Date().toISOString() };
    await updateRunState({ steps });

    // 1. AI config ve prompt
    const config = await loadAIConfig();
    const systemPromptTemplate = await loadPromptSetting('ai_prompt_generate_design');

    const basePrompt = template.seoHints?.customNotes
      ? template.seoHints.customNotes
      : `Creative design for ${template.seoHints?.primaryNiche || 'apparel'}, tailored for ${template.seoHints?.targetAudience || 'everyone'}`;

    let finalPrompt = basePrompt;
    if (systemPromptTemplate.trim()) {
      finalPrompt = systemPromptTemplate
        .replace(/\{\{userPrompt\}\}/g, basePrompt)
        .replace(/\{\{selectedStyle\}\}/g, template.seoHints?.primaryNiche || '');
    }

    // 2. Tasarım üretimi
    const generatedImages = await generateImage(config, { prompt: finalPrompt, greenBackground: true });
    if (!generatedImages || generatedImages.length === 0) {
      throw new Error('AI could not generate the design.');
    }

    steps.designGeneration = { status: 'completed', completedAt: new Date().toISOString() };
    steps.backgroundRemoval = { status: 'running', startedAt: new Date().toISOString() };
    await updateRunState({ steps });

    // 3. Arka plan kaldırma (chroma key)
    const { pngBuffer } = await removeGreenBackground(generatedImages[0].data, { threshold: 80, feather: 40 });

    // 4. R2'ye yükleme (kullanıcı önekli anahtar ile; aksi halde kullanıcı kendi dosyasını göremez)
    if (!isR2Configured()) {
      throw new Error('Storage is not configured. Please check R2 environment variables.');
    }
    const uploadResult = await uploadToR2(pngBuffer, createOwnedUploadName(userId, `auto-design-${runId}`, 'image/png'), 'image/png');

    // 5. Tasarımı kullanıcının çalışma alanına ekle
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

    const [workspace] = await db.select().from(userWorkspaces).where(eq(userWorkspaces.userId, userId));
    if (workspace) {
      await db.update(userWorkspaces)
        .set({ designs: [...((workspace.designs as DesignItem[]) || []), newDesign] })
        .where(eq(userWorkspaces.userId, userId));
    } else {
      await db.insert(userWorkspaces).values({ userId, designs: [newDesign] });
    }

    steps.backgroundRemoval = { status: 'completed', completedAt: new Date().toISOString() };
    await updateRunState({ steps, generatedDesignId: newDesign.id, generatedDesignUrl: uploadResult.url });

    // 6. Mockup render
    steps.mockupRender = { status: 'running', startedAt: new Date().toISOString() };
    await updateRunState({ steps });

    const generatedMockupUrls: string[] = [];
    const targetMockupId = template.mockupConfig?.printAreaMockupIds?.[0];
    if (targetMockupId) {
      try {
        const { renderDesignOnMockup } = await import('@/lib/backend-render');
        const mockups = (workspace?.mockups as MockupItem[] | undefined) ?? [];
        const targetMockup = mockups.find((m) => m.id === targetMockupId);

        // Eski kod var olmayan `printArea` alanını okuduğu için bu adım her zaman atlanıyordu.
        const printArea = targetMockup?.printAreas?.[0];
        if (targetMockup?.src && printArea) {
          // Mockup görseli sahiplik doğrulamasıyla depolamadan okunur (SSRF yok).
          const mockupBuffer = await loadImageForUser(userId, targetMockup.src);
          const compositedBuffer = await renderDesignOnMockup(mockupBuffer, pngBuffer, printArea);
          const uploadComposite = await uploadToR2(
            compositedBuffer,
            createOwnedUploadName(userId, `auto-mockup-${runId}`, 'image/png'),
            'image/png',
          );
          generatedMockupUrls.push(uploadComposite.url);
        }
      } catch (error) {
        // Mockup hatası pipeline'ı durdurmaz.
        console.error('[Automation] Mockup rendering failed', error);
      }
    }

    steps.mockupRender = {
      status: generatedMockupUrls.length > 0 ? 'completed' : 'skipped',
      completedAt: new Date().toISOString(),
    };
    await updateRunState({ steps, generatedMockupUrls });

    // 7. Video üretimi
    steps.videoGeneration = { status: 'running', startedAt: new Date().toISOString() };
    await updateRunState({ steps });
    let generatedVideoUrl: string | null = null;

    try {
      const { generateVideo } = await import('@/lib/ai-provider');
      const videoPromptTemplate = (await loadPromptSetting('ai_prompt_generate_video'))
        || 'Create a cinematic showcase video for a t-shirt.';
      const finalVideoPrompt = videoPromptTemplate
        .replace(/\{\{userPrompt\}\}/g, basePrompt)
        .replace(/\{\{selectedStyle\}\}/g, template.seoHints?.primaryNiche || '');

      const generatedVideo = await generateVideo(config, { prompt: finalVideoPrompt });
      if (generatedVideo?.uri) generatedVideoUrl = generatedVideo.uri;
      steps.videoGeneration = { status: 'completed', completedAt: new Date().toISOString() };
    } catch (error) {
      console.error('[Automation] Video generation failed', error);
      steps.videoGeneration = { status: 'failed', completedAt: new Date().toISOString() };
    }

    await updateRunState({ steps, ...(generatedVideoUrl && { generatedVideoUrl }) });

    // SEO ve listing adımları henüz uygulanmadı.
    steps.seoGeneration = { status: 'skipped' };
    steps.listingCreation = { status: 'skipped' };

    await updateRunState({ status: 'completed', completedAt: new Date(), steps });
    await db.update(podTemplates)
      .set({
        lastRunAt: new Date(),
        totalListingsGenerated: (template.totalListingsGenerated ?? 0) + 1,
      })
      .where(eq(podTemplates.id, templateId))
      .catch((error: unknown) => console.error('[Automation] Template stats update failed', error));

    return { ok: true, runId };
  } catch (error) {
    console.error('[Automation] Run failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    await updateRunState({ status: 'failed', errorMessage: message.slice(0, 1000), completedAt: new Date(), steps })
      .catch((dbError: unknown) => console.error('[Automation] Failed to persist failure state', dbError));
    return { ok: false, runId, reason: 'failed', error: message };
  }
}

/** Uzun süredir 'running' durumunda kalan çalıştırmaları 'failed' olarak işaretler. */
export async function failStaleAutomationRuns(olderThanMinutes = 30): Promise<number> {
  const rows = await sql`
    UPDATE automation_runs
    SET status = 'failed',
        error_message = 'Zaman aşımı: çalıştırma tamamlanamadı.',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('running', 'pending')
      AND COALESCE(started_at, created_at) < CURRENT_TIMESTAMP - make_interval(mins => ${olderThanMinutes}::int)
    RETURNING id
  `;
  return rows.length;
}
