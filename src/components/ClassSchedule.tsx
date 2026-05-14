import { useMemo } from 'react';
import type { AppData, ClassBlock, ClassStatus, DailyPlan } from '../types';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { todayISO } from '../utils/date';

interface ClassScheduleProps {
  data: AppData;
  onUpdatePlan: (plan: DailyPlan) => void;
  onGoCheckIn: () => void;
}

export function ClassSchedule({
  data,
  onUpdatePlan,
  onGoCheckIn,
}: ClassScheduleProps) {
  const today = todayISO();
  const plan = data.dailyPlans[today];

  const total = plan?.blocks.length ?? 0;
  const doneCount = useMemo(
    () => (plan?.blocks ?? []).filter((b) => b.status === 'done').length,
    [plan],
  );
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (!plan || plan.blocks.length === 0) {
    return (
      <SectionCard
        title="오늘의 교시"
        subtitle="아직 오늘 시간표가 만들어지지 않았어요."
      >
        <EmptyState
          title="먼저 아침 체크인을 해주세요"
          description={'할 일을 입력하면 자동으로\n1교시 / 2교시 / 3교시가 만들어집니다.'}
          action={
            <button type="button" className="lc-btn-primary" onClick={onGoCheckIn}>
              아침 체크인 시작
            </button>
          }
        />
      </SectionCard>
    );
  }

  const updateBlock = (id: string, patch: Partial<ClassBlock>) => {
    const updated: DailyPlan = {
      ...plan,
      blocks: plan.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    };
    onUpdatePlan(updated);
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="오늘의 교시"
        subtitle={plan.headline}
        right={
          <div className="text-right">
            <div className="text-xs lc-text-soft">진행률</div>
            <div className="text-lg font-semibold lc-text-deep">
              {progress}%
            </div>
          </div>
        }
      >
        <div className="h-2 w-full rounded-full bg-[var(--color-ivory-100)] overflow-hidden">
          <div
            className="h-full bg-[var(--color-blue-mid)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plan.blocks.map((b) => (
          <BlockCard
            key={b.id}
            block={b}
            onUpdate={(patch) => updateBlock(b.id, patch)}
          />
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="lc-btn-ghost" onClick={onGoCheckIn}>
          체크인 다시 하기
        </button>
      </div>
    </div>
  );
}

interface BlockCardProps {
  block: ClassBlock;
  onUpdate: (patch: Partial<ClassBlock>) => void;
}

function BlockCard({ block, onUpdate }: BlockCardProps) {
  const setStatus = (s: ClassStatus) => onUpdate({ status: s });

  const periodStyles =
    block.period === 'period1'
      ? 'from-[#e9f0f8] to-white'
      : block.period === 'period2'
        ? 'from-[#f5ece0] to-white'
        : block.period === 'period3'
          ? 'from-[#eef2ec] to-white'
          : 'from-[#f3edf6] to-white';

  return (
    <article
      className={`lc-card p-5 flex flex-col gap-3 bg-gradient-to-br ${periodStyles}`}
    >
      <header className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-xs lc-text-soft">{block.categoryLabel}</div>
          <div className="text-lg font-semibold lc-text-blue">
            {block.periodLabel}
          </div>
        </div>
        <div className="text-xs lc-text-soft">
          예상 {block.estimatedMinutes}분
        </div>
      </header>

      <div className="text-base lc-text-deep font-medium leading-snug">
        {block.action}
      </div>

      <textarea
        className="lc-input min-h-[64px]"
        placeholder="메모 (필요하면 한 줄)"
        value={block.memo}
        onChange={(e) => onUpdate({ memo: e.target.value })}
      />

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <StatusBar status={block.status} onChange={setStatus} />
        <div className="flex gap-2">
          {block.status !== 'done' ? (
            <>
              {block.status !== 'inProgress' && (
                <button
                  type="button"
                  className="lc-btn-ghost"
                  onClick={() => setStatus('inProgress')}
                >
                  시작
                </button>
              )}
              <button
                type="button"
                className="lc-btn-primary"
                onClick={() => setStatus('done')}
              >
                완료
              </button>
            </>
          ) : (
            <button
              type="button"
              className="lc-btn-ghost"
              onClick={() => setStatus('planned')}
            >
              되돌리기
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusBar({
  status,
  onChange,
}: {
  status: ClassStatus;
  onChange: (s: ClassStatus) => void;
}) {
  const cell = (s: ClassStatus, label: string) => {
    const active = s === status;
    return (
      <button
        key={s}
        type="button"
        onClick={() => onChange(s)}
        className={
          'px-2.5 py-1 rounded-full text-[11px] font-medium ' +
          (active
            ? 'bg-[var(--color-blue-mid)] text-white'
            : 'bg-[var(--color-ivory-100)] lc-text-soft')
        }
      >
        {label}
      </button>
    );
  };
  return (
    <div className="flex gap-1.5">
      {cell('planned', '예정')}
      {cell('inProgress', '진행 중')}
      {cell('done', '완료')}
    </div>
  );
}
