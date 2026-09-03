'use client';

/**
 * ScheduleSection — Sade & Akıllı Zamanlama Bileşeni
 * =====================================================
 * Kullanıcı:
 *   1. Günde kaç kez çalışacağını seçer (1, 2, 3, 4, 6, 12, 24)
 *   2. Başlangıç saatini seçer (00:00 – 23:00)
 *   3. Zaman dilimini seçer
 *   4. Her çalışmada kaç listing üretileceğini seçer
 *   5. Yayın modunu seçer (Taslak / Direkt Yayın)
 *
 * Cron ifadesi otomatik hesaplanır.
 */

import React, { useMemo } from 'react';
import { Clock, Globe, Shield, AlertCircle, Zap } from 'lucide-react';
import { PodTemplateAutomationSchedule } from '@/types/templates';

interface ScheduleSectionProps {
  schedule: PodTemplateAutomationSchedule;
  onChange: (schedule: PodTemplateAutomationSchedule) => void;
}

// ─── Sabitler ────────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  { value: 1,  label: 'Günde 1×',  desc: '24 saatte bir' },
  { value: 2,  label: 'Günde 2×',  desc: '12 saatte bir' },
  { value: 3,  label: 'Günde 3×',  desc: '8 saatte bir'  },
  { value: 4,  label: 'Günde 4×',  desc: '6 saatte bir'  },
  { value: 6,  label: 'Günde 6×',  desc: '4 saatte bir'  },
  { value: 12, label: 'Günde 12×', desc: '2 saatte bir'  },
];

const START_HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i.toString().padStart(2, '0') + ':00',
}));

const TIMEZONES = [
  { value: 'Europe/Istanbul',    label: 'İstanbul (TRT +3)',   flag: '🇹🇷' },
  { value: 'America/New_York',   label: 'New York (EST/EDT)',   flag: '🇺🇸' },
  { value: 'America/Chicago',    label: 'Chicago (CST/CDT)',    flag: '🇺🇸' },
  { value: 'America/Los_Angeles',label: 'Los Angeles (PST/PDT)',flag: '🇺🇸' },
  { value: 'Europe/London',      label: 'Londra (GMT/BST)',     flag: '🇬🇧' },
  { value: 'Europe/Berlin',      label: 'Berlin (CET/CEST)',    flag: '🇩🇪' },
  { value: 'Asia/Tokyo',         label: 'Tokyo (JST)',          flag: '🇯🇵' },
];

const LISTINGS_OPTIONS = [1, 2, 3, 5, 10];

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

/**
 * Frekans + başlangıç saatinden cron ifadesi üretir.
 * Örnek: freq=4, startHour=0 → "0 0,6,12,18 * * *"
 */
function buildCron(freq: number, startHour: number): string {
  const interval = 24 / freq;
  const hours: number[] = [];
  for (let i = 0; i < freq; i++) {
    hours.push((startHour + i * interval) % 24);
  }
  hours.sort((a, b) => a - b);
  return `0 ${hours.join(',')} * * *`;
}

/**
 * Mevcut cron ifadesinden frekans ve başlangıç saatini çözer.
 * Sadece "0 H,H,H... * * *" formatını anlar.
 */
function parseCron(cron: string): { freq: number; startHour: number } {
  try {
    const parts = cron.split(' ');
    if (parts.length < 5) return { freq: 1, startHour: 9 };
    const hourPart = parts[1];
    if (hourPart.startsWith('*/')) {
      const interval = parseInt(hourPart.slice(2), 10);
      return { freq: 24 / interval, startHour: 0 };
    }
    const hours = hourPart.split(',').map(Number).sort((a, b) => a - b);
    return { freq: hours.length, startHour: hours[0] ?? 0 };
  } catch {
    return { freq: 1, startHour: 9 };
  }
}

// ─── Bileşen ──────────────────────────────────────────────────────────────────

export function ScheduleSection({ schedule, onChange }: ScheduleSectionProps) {
  const update = <K extends keyof PodTemplateAutomationSchedule>(
    field: K,
    value: PodTemplateAutomationSchedule[K]
  ) => {
    onChange({ ...schedule, [field]: value });
  };

  // Mevcut cron'u ayrıştır
  const { freq, startHour } = useMemo(
    () => parseCron(schedule.cronExpression || '0 9 * * *'),
    [schedule.cronExpression]
  );

  // Frekans değişince cron'u yeniden hesapla
  const handleFreqChange = (newFreq: number) => {
    onChange({ ...schedule, cronExpression: buildCron(newFreq, startHour) });
  };

  // Başlangıç saati değişince cron'u yeniden hesapla
  const handleStartHourChange = (newHour: number) => {
    onChange({ ...schedule, cronExpression: buildCron(freq, newHour) });
  };

  // Çalışma saatlerini insan dostu göster
  const runTimes = useMemo(() => {
    const interval = 24 / freq;
    const hours: number[] = [];
    for (let i = 0; i < freq; i++) {
      hours.push((startHour + i * interval) % 24);
    }
    hours.sort((a, b) => a - b);
    return hours.map(h => h.toString().padStart(2, '0') + ':00');
  }, [freq, startHour]);

  return (
    <div className="space-y-5">

      {/* ── Otomasyon Aktif/Pasif ─────────────────────────────────────── */}
      <div
        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
          schedule.enabled
            ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-400 dark:border-emerald-500/60'
            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all ${
              schedule.enabled
                ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                : 'bg-slate-200 dark:bg-slate-700'
            }`}
          >
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {schedule.enabled ? 'Otomasyon Aktif' : 'Otomasyon Kapalı'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {schedule.enabled
                ? `Belirlenen zamanda otomatik çalışır`
                : 'Açmak için sağdaki düğmeye bas'}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={schedule.enabled}
          onClick={() => update('enabled', !schedule.enabled)}
          className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            schedule.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
              schedule.enabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* ── Aktif olduğunda frekans + saat ayarları ───────────────────── */}
      {schedule.enabled && (
        <>
          {/* Frekans */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Günlük Çalışma Sıklığı
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCY_OPTIONS.map(opt => {
                const isSelected = freq === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleFreqChange(opt.value)}
                    className={`flex flex-col items-center justify-center py-2.5 rounded-xl border-2 text-center transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-600'
                        : 'border-slate-200 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-700/50'
                    }`}
                  >
                    <span className={`text-sm font-bold ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                      {opt.label}
                    </span>
                    <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Başlangıç Saati */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Başlangıç Saati
              <span className="ml-1 text-slate-400 font-normal">(ilk çalışma bu saatte başlar)</span>
            </label>
            <div className="flex items-center gap-3">
              <select
                value={startHour}
                onChange={e => handleStartHourChange(parseInt(e.target.value, 10))}
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400/40 text-slate-800 dark:text-slate-100"
              >
                {START_HOURS.map(h => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>

              {/* Çalışma saatlerini göster */}
              <div className="flex-1 flex flex-wrap gap-1">
                {runTimes.map(t => (
                  <span
                    key={t}
                    className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold rounded-lg"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Zaman Dilimi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              Zaman Dilimi
            </label>
            <select
              value={schedule.timezone}
              onChange={e => update('timezone', e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-slate-800 dark:text-slate-100"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>
                  {tz.flag} {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Her Çalışmada Kaç Listing */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Her Çalışmada Üretilecek Listing
            </label>
            <div className="flex gap-2">
              {LISTINGS_OPTIONS.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update('listingsPerRun', n)}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                    schedule.listingsPerRun === n
                      ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Yayın Modu */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              Yayın Modu
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: 'draft',
                  label: '📝 Taslak',
                  desc: 'Etsy\'de taslak listing oluşturur. Güvenli.',
                  selected: 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
                },
                {
                  value: 'active',
                  label: '🚀 Direkt Yayınla',
                  desc: 'Oluşturulunca otomatik yayına alır.',
                  selected: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
                },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('publishMode', opt.value as 'draft' | 'active')}
                  className={`flex flex-col p-3 rounded-xl border-2 text-left transition-all ${
                    schedule.publishMode === opt.value
                      ? opt.selected
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className="text-[10px] mt-1 opacity-80 leading-tight">{opt.desc}</span>
                </button>
              ))}
            </div>

            {schedule.publishMode === 'active' && (
              <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Her aktif listing için Etsy $0.20 ücret alır.</span>
              </div>
            )}
          </div>

          {/* Özet Kutusu */}
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-700/40 rounded-xl">
            <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-1.5">
              📋 Zamanlama Özeti
            </p>
            <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
              Günde <strong>{freq}×</strong> çalışacak — {
                freq > 1 ? `her ${24 / freq} saatte bir` : '24 saatte bir'
              } — saat <strong>{runTimes.join(', ')}</strong>{' '}
              ({schedule.timezone.split('/')[1]?.replace('_', ' ')})
              {' '}· Her çalışmada <strong>{schedule.listingsPerRun}</strong> listing
              {' '}· <strong>{schedule.publishMode === 'active' ? 'Direkt Yayın' : 'Taslak'}</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
