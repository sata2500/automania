/**
 * İlan metni üretiminde konu tespiti ve "konu kirliliği" filtresi.
 * Eşleşmeler kelime sınırına göre yapılır: "vacation" içinde "cat", "education" içinde "cat",
 * "delicate" içinde "cat" geçtiği için bir tasarım kedi sayılmamalı.
 */

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Metin, terimi ayrı bir kelime (ya da çoğul hali) olarak içeriyor mu? */
export function containsWord(text: string, term: string): boolean {
  if (!text || !term) return false;
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term.toLowerCase())}(s|es)?(?=$|[^\\p{L}\\p{N}])`, 'u');
  return pattern.test(text.toLowerCase());
}

const SUBJECT_SYNONYMS: Array<{ subject: string; label: string; terms: string[] }> = [
  { subject: 'rabbit', label: 'rabbit bunny', terms: ['rabbit', 'bunny', 'bunnies'] },
  { subject: 'dog', label: 'dog', terms: ['dog', 'puppy', 'puppies', 'doggo'] },
  { subject: 'cat', label: 'cat', terms: ['cat', 'kitten', 'kitty', 'kitties'] },
];

/** Tasarım açıklamasından ana hayvan konusunu bulur (yoksa null). */
export function detectPrimarySubject(text: string): { subject: string; label: string } | null {
  for (const entry of SUBJECT_SYNONYMS) {
    if (entry.terms.some((term) => containsWord(text, term))) return { subject: entry.subject, label: entry.label };
  }
  return null;
}

/** Konu farklıysa ilan etiketlerine/kelimelerine sızmaması gereken terimler. */
export const CONTAMINATION_TERMS = ['dog', 'cat', 'horse', 'rabbit', 'nurse', 'teacher', 'halloween', 'christmas'] as const;

/**
 * Tasarımla ilgisi olmayan konu terimlerini içeren etiketleri çıkarır.
 * - Tasarımın kendi açıklamasında geçen terimler serbesttir.
 * - Aktif sezonun temaları (ör. Q4'te "christmas") serbesttir; sezon motoru bunları zaten önerir.
 */
export function filterContaminatedTerms<T>(
  items: T[],
  getText: (item: T) => string,
  context: { subjectText: string; allowedTerms?: string[] },
): T[] {
  const allowed = new Set((context.allowedTerms || []).map((t) => t.toLowerCase()));
  const forbidden = CONTAMINATION_TERMS.filter(
    (term) => !allowed.has(term) && !containsWord(context.subjectText, term),
  );
  if (forbidden.length === 0) return items;
  return items.filter((item) => !forbidden.some((term) => containsWord(getText(item), term)));
}
