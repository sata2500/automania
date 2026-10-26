'use client';

/**
 * Admin › AI Ayarları › Sistem Promptları: yapay zekâya giden tüm talimatlar (bkz. `prompt-registry`).
 * Her talimat burada görünür ve düzenlenir; boş bırakılan alanda varsayılan metin kullanılır.
 */
import React, { useState } from 'react';
import { ClipboardCopy, Info, Plus, RotateCcw, Tag } from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import {
  PROMPT_DEFINITIONS,
  PROMPT_GROUPS,
  type PromptDefinition,
  type PromptGroup,
  type PromptKey,
  type PromptVariable,
} from '@/lib/prompt-registry';

const PILL_COLORS = [
  'border-indigo-200 bg-indigo-50/80 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60',
  'border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60',
  'border-purple-200 bg-purple-50/80 text-purple-700 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60',
  'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60',
  'border-cyan-200 bg-cyan-50/80 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60',
  'border-rose-200 bg-rose-50/80 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60',
];

export const PROMPT_VARIABLE_COUNT = PROMPT_DEFINITIONS.reduce((sum, d) => sum + d.variables.length, 0);

const PromptVariablePill: React.FC<{ variable: PromptVariable; colorClass: string; onClick: () => void }> = ({ variable, colorClass, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="relative inline-block group">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95 ${colorClass}`}
      >
        <span aria-hidden="true">{variable.icon}</span>
        <span className="font-semibold">{variable.label}</span>
        <code className="px-1 py-0.5 bg-black/5 dark:bg-white/10 rounded font-mono text-[10px] opacity-80">{variable.tag}</code>
      </button>
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-900 dark:bg-slate-800 text-white text-[11px] rounded-xl shadow-xl border border-slate-700 pointer-events-none animate-fadeIn leading-relaxed">
          <p className="text-slate-300 text-[10px]">{variable.desc}</p>
          <div className="mt-1.5 pt-1.5 border-t border-slate-700/60 text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
            <Plus className="w-3 h-3" />
            <span>Tıklayınca imlecin olduğu konuma ekler</span>
          </div>
        </div>
      )}
    </div>
  );
};

function PromptCard({ definition, index, value, onChange }: {
  definition: PromptDefinition;
  index: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const toast = useToast();
  const textareaId = `prompt_${definition.key}`;
  const isDefault = value.trim() === definition.defaultValue.trim();

  const insertVariable = (variable: PromptVariable) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + variable.tag + value.slice(end));
    setTimeout(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + variable.tag.length, start + variable.tag.length);
    }, 10);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
            <span>{index}. {definition.title}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isDefault ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300'}`}>
              {isDefault ? 'Varsayılan' : 'Düzenlendi'}
            </span>
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{definition.description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(definition.defaultValue);
            toast.info(`"${definition.title}" varsayılana döndürüldü. Kaydetmeyi unutmayın.`);
          }}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer self-start shrink-0"
        >
          <RotateCcw className="w-3 h-3" /> Varsayılana Sıfırla
        </button>
      </div>

      {definition.variables.length > 0 && (
        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-indigo-500" />
            Değişkenler (sistem bu yerlere veriyi yazar; tıklayınca imlecin olduğu yere eklenir)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {definition.variables.map((variable, i) => (
              <PromptVariablePill key={variable.tag} variable={variable} colorClass={PILL_COLORS[i % PILL_COLORS.length]!} onClick={() => insertVariable(variable)} />
            ))}
          </div>
        </div>
      )}

      <textarea
        id={textareaId}
        aria-label={definition.title}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Boş bırakılırsa varsayılan metin kullanılır."
        className="w-full h-56 sm:h-72 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono custom-scrollbar transition-all leading-relaxed"
      />
    </div>
  );
}

/** Tüm talimatları başlık, anahtar ve durumla tek metin olarak döner (gözden geçirmek için paylaşılır). */
export function formatAllPrompts(values: Record<PromptKey, string>): string {
  return PROMPT_DEFINITIONS.map((definition, i) => {
    const value = values[definition.key] ?? '';
    const status = value.trim() === definition.defaultValue.trim() ? 'Varsayılan' : 'Düzenlendi';
    return `=== ${i + 1}. ${definition.title} (${definition.key}) — ${status} ===\n${value.trim() || '(boş: varsayılan kullanılır)'}`;
  }).join('\n\n');
}

/** Panoya kopyalar; Clipboard API yoksa (eski/mobil tarayıcı) gizli metin alanı ile kopyalar. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Aşağıdaki yönteme düş.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  return ok;
}

export function AdminPromptEditor({ values, onChange }: {
  values: Record<PromptKey, string>;
  onChange: (key: PromptKey, value: string) => void;
}) {
  const toast = useToast();
  const [group, setGroup] = useState<PromptGroup | 'all'>('all');

  const copyAll = async () => {
    const ok = await copyText(formatAllPrompts(values));
    if (ok) toast.success(`${PROMPT_DEFINITIONS.length} talimat panoya kopyalandı. Kaydedilmemiş değişiklikler de dahildir.`);
    else toast.error('Kopyalanamadı. Tarayıcı panoya erişime izin vermedi.');
  };
  const visible = PROMPT_DEFINITIONS
    .map((definition, i) => ({ definition, index: i + 1 }))
    .filter(({ definition }) => group === 'all' || definition.group === group);

  const tabClass = (active: boolean) => `px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
    active ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
  }`;

  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
          <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <span>Yapay zekâya giden talimatların tamamı buradadır; sistem başka bir talimat eklemez, yalnızca değişkenleri veriyle doldurur.</span>
        </div>
        <button
          type="button"
          onClick={copyAll}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <ClipboardCopy className="w-3.5 h-3.5" /> Tüm promptları kopyala
        </button>
        <div role="tablist" aria-label="Prompt grupları" className="flex flex-wrap items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-stretch sm:self-auto max-w-full">
          <button type="button" role="tab" aria-selected={group === 'all'} onClick={() => setGroup('all')} className={tabClass(group === 'all')}>Tümü</button>
          {PROMPT_GROUPS.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={group === g.id} onClick={() => setGroup(g.id)} className={tabClass(group === g.id)}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {visible.map(({ definition, index }) => (
          <PromptCard
            key={definition.key}
            definition={definition}
            index={index}
            value={values[definition.key]}
            onChange={(value) => onChange(definition.key, value)}
          />
        ))}
      </div>
    </div>
  );
}
