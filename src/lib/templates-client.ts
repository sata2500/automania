/**
 * Otomasyon şablonlarını kaydetmek için tarayıcı tarafı yardımcılar
 * (Toplu Üretim › Otomasyon Şablonları ve mockup klasörü menüsü aynı API'yi kullanır).
 */
import type { PodTemplate, PodTemplateInput } from '@/types/templates';

/** Şablonu oluşturur (id yoksa) veya günceller; kaydedilen şablonu döner. */
export async function saveTemplate(data: PodTemplateInput, id?: string): Promise<PodTemplate> {
  const res = await fetch(id ? `/api/templates/${id}` : '/api/templates', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok || !result.template) throw new Error(result.error || 'Şablon kaydedilemedi.');
  return result.template as PodTemplate;
}

/** Kullanıcının tüm şablonlarını getirir. */
export async function fetchTemplates(): Promise<PodTemplate[]> {
  const res = await fetch('/api/templates');
  if (!res.ok) throw new Error('Şablonlar yüklenemedi.');
  const data = await res.json();
  return (data.templates ?? []) as PodTemplate[];
}
