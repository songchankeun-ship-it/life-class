import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'blue' | 'warm' | 'soft';
}

const TONE_BG: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-white',
  blue: 'bg-gradient-to-br from-[#eef3f9] to-white',
  warm: 'bg-gradient-to-br from-[#fbf3eb] to-white',
  soft: 'bg-gradient-to-br from-[#f4f1ea] to-white',
};

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <div
      className={`lc-card p-4 sm:p-5 flex flex-col gap-2 ${TONE_BG[tone]}`}
    >
      <div className="lc-section-title">{label}</div>
      <div className="text-xl sm:text-2xl font-semibold lc-text-deep leading-tight">
        {value}
      </div>
      {hint && <div className="text-xs lc-text-soft">{hint}</div>}
    </div>
  );
}
