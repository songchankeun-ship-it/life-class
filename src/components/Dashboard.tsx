import { useMemo } from 'react';
import type { AppData, Entry } from '../types';
import { ENTRY_CATEGORY_LABEL } from '../types';
import { dDayLabel, todayISO } from '../utils/date';
import { moveInfo } from '../data/defaultData';

interface DashboardProps {
  data: AppData;
  onGoChat: () => void;
}

export function Dashboard({ data, onGoChat }: DashboardProps) {
  const today = todayISO();

  const monthlySubsTotal = useMemo(
    () =>
      data.subscriptions
        .filter((s) => s.usage !== 'cancelled')
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [data.subscriptions],
  );

  const thisMonthPurchases = useMemo(() => {
    const now = new Date();
    return data.purchases.filter((p) => {
      if (p.status === 'returned') return false;
      const d = new Date(p.orderDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }, [data.purchases]);
  const purchaseTotal = thisMonthPurchases.reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0,
  );

  // Entry 분포
  const entryStats = useMemo(() => {
    const open = data.entries.filter((e) => !e.done && !e.archived);
    const todayItems = open.filter((e) => e.date === today);
    const overdue = open.filter((e) => e.date && e.date < today);
    return { total: open.length, today: todayItems, overdue };
  }, [data.entries, today]);

  const upcomingEntries = useMemo(() => {
    return data.entries
      .filter(
        (e) =>
          !e.done && !e.archived && e.date && e.date > today && e.needsReminder,
      )
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      .slice(0, 5);
  }, [data.entries, today]);

  return (
    <div className="space-y-4">
      {/* 핵심 요약 — 4-stat 그리드 */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="이사 (반출)"
          value={dDayLabel(moveInfo.oldOutDate)}
          hint={moveInfo.oldOutDate}
        />
        <StatTile
          label="이사 (입주)"
          value={dDayLabel(moveInfo.newInDate)}
          hint={moveInfo.newInDate}
        />
        <StatTile
          label="이번달 구매"
          value={purchaseTotal.toLocaleString() + '원'}
          hint={thisMonthPurchases.length + '건'}
        />
        <StatTile
          label="월 구독비"
          value={monthlySubsTotal.toLocaleString() + '원'}
          hint="해지 완료 제외"
        />
      </div>

      {/* 오늘의 알림 */}
      {(entryStats.today.length > 0 ||
        entryStats.overdue.length > 0 ||
        upcomingEntries.length > 0) && (
        <div className="lc-card p-4">
          <div className="text-[11px] tracking-wider uppercase lc-text-mute font-semibold mb-2">
            알림
          </div>

          {entryStats.overdue.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] lc-text-mute mb-1.5">
                지난 날짜인데 아직 미완료 ({entryStats.overdue.length})
              </div>
              <div className="space-y-1.5">
                {entryStats.overdue.slice(0, 3).map((e: Entry) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-danger-soft)]"
                  >
                    <span className="text-[11px] text-[var(--color-danger)] font-semibold flex-shrink-0">
                      {e.date}
                    </span>
                    <span className="text-[13px] lc-text-deep flex-1 min-w-0 truncate">
                      {e.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entryStats.today.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] lc-text-mute mb-1.5">
                오늘 ({entryStats.today.length})
              </div>
              <div className="space-y-1.5">
                {entryStats.today.map((e: Entry) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-accent-soft)]"
                  >
                    <span className="text-[11px] lc-text-blue font-semibold flex-shrink-0">
                      {e.time ?? '오늘'}
                    </span>
                    <span className="text-[13px] lc-text-deep flex-1 min-w-0 truncate">
                      {e.title}
                    </span>
                    <span className="text-[10px] lc-text-mute flex-shrink-0">
                      {ENTRY_CATEGORY_LABEL[e.category]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingEntries.length > 0 && (
            <div>
              <div className="text-[11px] lc-text-mute mb-1.5">
                곧 다가오는 알림
              </div>
              <div className="space-y-1">
                {upcomingEntries.map((e: Entry) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 text-[12px] lc-text-soft"
                  >
                    <span className="font-medium flex-shrink-0">
                      {e.date}
                      {e.time ? ' ' + e.time : ''}
                    </span>
                    <span className="truncate">{e.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Entry 분포 */}
      <div className="lc-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] tracking-wider uppercase lc-text-mute font-semibold">
            정리된 항목
          </div>
          <button type="button" className="text-[12px] lc-text-blue" onClick={onGoChat}>
            Aide 열기 →
          </button>
        </div>
        {entryStats.total === 0 ? (
          <div className="text-[13px] lc-text-soft">
            아직 정리된 게 없어요. Aide 에서 머릿속을 던져보세요.
          </div>
        ) : (
          <div>
            <div className="text-2xl font-semibold lc-text-deep">{entryStats.total}</div>
            <div className="text-[12px] lc-text-soft mt-0.5">미완료 항목</div>
            <CategoryDistribution data={data} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="lc-card p-3.5">
      <div className="text-[11px] lc-text-mute font-medium">{label}</div>
      <div className="text-[18px] font-semibold lc-text-deep mt-1 leading-tight">
        {value}
      </div>
      {hint && <div className="text-[11px] lc-text-soft mt-0.5">{hint}</div>}
    </div>
  );
}

function CategoryDistribution({ data }: { data: AppData }) {
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    data.entries
      .filter((e) => !e.done && !e.archived)
      .forEach((e) => {
        m[e.category] = (m[e.category] ?? 0) + 1;
      });
    return m;
  }, [data.entries]);

  const cats = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (cats.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {cats.map(([cat, n]) => (
        <span
          key={cat}
          className="text-[11px] px-2 py-1 rounded-full bg-[var(--color-bg-soft)] lc-text-soft"
        >
          {ENTRY_CATEGORY_LABEL[cat as keyof typeof ENTRY_CATEGORY_LABEL]} {n}
        </span>
      ))}
    </div>
  );
}
