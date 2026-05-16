import { useMemo } from 'react';
import type { AppData, DailyCheckIn, DailyPlan, Entry, ParkingItem, Project, SubscriptionItem } from '../types';
import { CONDITION_LABEL, ENTRY_CATEGORY_LABEL } from '../types';
import { StatCard } from './StatCard';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { dDayLabel, formatKoreanDate, todayISO } from '../utils/date';
import { moveInfo } from '../data/defaultData';

interface DashboardProps {
  data: AppData;
  onGoCheckIn: () => void;
  onGoClasses: () => void;
  onGoParking: () => void;
  onGoProjects: () => void;
  onGoMove: () => void;
  onGoSubs: () => void;
  onGoSpots: () => void;
  onGoPurchase: () => void;
}

export function Dashboard({
  data,
  onGoCheckIn,
  onGoClasses,
  onGoParking,
  onGoProjects,
  onGoMove,
  onGoSubs,
  onGoSpots,
  onGoPurchase,
}: DashboardProps) {
  const today = todayISO();
  const checkIn: DailyCheckIn | undefined = data.checkIns[today];
  const plan: DailyPlan | undefined = data.dailyPlans[today];

  const monthlySubsTotal = useMemo(
    () =>
      data.subscriptions
        .filter((s: SubscriptionItem) => s.usage !== 'cancelled')
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [data.subscriptions],
  );

  const activeProjects = useMemo(
    () =>
      data.projects.filter(
        (p) => !p.completed && p.status !== 'done' && p.status !== 'paused',
      ),
    [data.projects],
  );

  const recentParking = useMemo(
    () =>
      [...data.parking]
        .filter((p) => !p.done)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4),
    [data.parking],
  );

  const importantSpots = useMemo(
    () => data.spots.filter((s) => s.important).slice(0, 4),
    [data.spots],
  );


  const thisMonthPurchases = useMemo(() => {
    const now = new Date();
    return data.purchases.filter((p) => {
      if (p.status === 'returned') return false;
      const d = new Date(p.orderDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }, [data.purchases]);
  const purchaseTotal = thisMonthPurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const moveDoneCount = data.moveChecklist.filter((m) => m.done).length;
  const movePercent = data.moveChecklist.length
    ? Math.round((moveDoneCount / data.moveChecklist.length) * 100)
    : 0;

  // 오늘 / 내일 / 미완료 알림 Entry
  const todayEntries = useMemo(() => {
    return data.entries
      .filter((e) => !e.done && !e.archived && e.date === today)
      .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  }, [data.entries, today]);

  const upcomingEntries = useMemo(() => {
    return data.entries
      .filter((e) => !e.done && !e.archived && e.date && e.date > today && e.needsReminder)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      .slice(0, 3);
  }, [data.entries, today]);

  return (
    <div className="space-y-5">
      {(todayEntries.length > 0 || upcomingEntries.length > 0) && (
        <SectionCard title="오늘의 알림" subtitle="채팅에서 던진 항목 중 오늘 처리할 것">
          {todayEntries.length > 0 && (
            <div className="space-y-2 mb-3">
              {todayEntries.map((e: Entry) => (
                <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--color-accent-soft)]">
                  <span className="text-[11px] lc-text-blue font-semibold flex-shrink-0">
                    {e.time ?? '오늘'}
                  </span>
                  <span className="text-sm lc-text-deep flex-1 min-w-0 truncate">{e.title}</span>
                  <span className="text-[10px] lc-text-mute flex-shrink-0">
                    {ENTRY_CATEGORY_LABEL[e.category]}
                  </span>
                </div>
              ))}
            </div>
          )}
          {upcomingEntries.length > 0 && (
            <div>
              <div className="text-[11px] lc-text-mute mb-1.5">곧 다가오는 알림</div>
              <div className="space-y-1.5">
                {upcomingEntries.map((e: Entry) => (
                  <div key={e.id} className="flex items-center gap-2 text-[12px] lc-text-soft">
                    <span className="font-medium">{e.date}{e.time ? ' ' + e.time : ''}</span>
                    <span className="truncate">{e.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard
        title={formatKoreanDate(today)}
        subtitle={plan?.headline ?? defaultHeadline(checkIn)}
        right={
          <div className="flex gap-2">
            <button type="button" className="lc-btn-ghost" onClick={onGoCheckIn}>
              아침 체크인
            </button>
            <button type="button" className="lc-btn-primary" onClick={onGoClasses}>
              오늘의 교시
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="오늘 컨디션"
            value={checkIn ? CONDITION_LABEL[checkIn.condition] : '미입력'}
            hint={checkIn ? '아침 체크인 완료' : '아침 체크인을 먼저 해보세요'}
            tone="soft"
          />
          <StatCard
            label="오늘 교시 수"
            value={plan ? plan.blocks.length + '교시' : '0교시'}
            hint={plan ? '교시 카드에서 진행 상황을 표시하세요' : '체크인 후 자동 생성'}
            tone="blue"
          />
          <StatCard
            label="이사 진행률"
            value={movePercent + '%'}
            hint={moveDoneCount + ' / ' + data.moveChecklist.length + ' 항목 완료'}
            tone="warm"
          />
          <StatCard
            label="월 예상 구독비"
            value={monthlySubsTotal.toLocaleString() + '원'}
            hint="해지 완료 제외"
            tone="default"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="오늘의 3교시 요약"
        subtitle="한 교시에는 다음 행동 1개만 들어갑니다."
        right={
          <button type="button" className="lc-btn-ghost" onClick={onGoClasses}>
            전체 보기
          </button>
        }
      >
        {plan && plan.blocks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plan.blocks.slice(0, 4).map((b) => (
              <div
                key={b.id}
                className="lc-card p-4 flex flex-col gap-2 bg-gradient-to-br from-white to-[var(--color-ivory-50)]"
              >
                <div className="flex items-center justify-between text-xs lc-text-soft">
                  <span className="font-semibold lc-text-blue">{b.periodLabel}</span>
                  <span>{b.estimatedMinutes}분</span>
                </div>
                <div className="text-sm lc-text-deep font-medium leading-snug">{b.action}</div>
                <div className="text-[11px] lc-text-soft">{b.categoryLabel}</div>
                <div className="mt-1">
                  <StatusChip status={b.status} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="아직 오늘의 교시가 없어요"
            description={'아침 체크인에서 떠오르는 할 일을 적으면\n자동으로 1~3교시가 만들어집니다.'}
            action={
              <button type="button" className="lc-btn-primary" onClick={onGoCheckIn}>
                아침 체크인 시작
              </button>
            }
          />
        )}
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard title="오늘 꼭 해야 할 일" subtitle="이것만 닫혀도 오늘은 잘 굴러간 날입니다.">
          {plan && plan.mustDoToday.length > 0 ? (
            <ul className="space-y-2">
              {plan.mustDoToday.map((t, i) => (
                <li key={t + '-' + i} className="flex gap-2 text-sm lc-text-deep">
                  <span className="lc-text-blue font-semibold mt-0.5">·</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="아직 항목이 없어요" />
          )}
        </SectionCard>

        <SectionCard title="오늘 미뤄도 되는 일" subtitle="기억은 해두되, 오늘 손대지 않아도 됩니다.">
          {plan && plan.canDelay.length > 0 ? (
            <ul className="space-y-2">
              {plan.canDelay.map((t, i) => (
                <li key={t + '-' + i} className="flex gap-2 text-sm lc-text-soft">
                  <span className="mt-0.5">·</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="자랑할 만큼 깔끔합니다" description="현재 미루기 후보가 없어요." />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard
          title="작업 주차장 최근"
          subtitle="떠오른 일을 바로 하지 말고 여기에 세워두세요."
          right={
            <button type="button" className="lc-btn-ghost" onClick={onGoParking}>
              주차장 열기
            </button>
          }
        >
          {recentParking.length > 0 ? (
            <ul className="space-y-2">
              {recentParking.map((p: ParkingItem) => (
                <li key={p.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="lc-text-deep">{p.title}</span>
                  <span className="lc-chip bg-[var(--color-ivory-100)] lc-text-soft">{p.category}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="주차된 항목 없음" description="머릿속에 맴도는 일이 있으면 주차장에 잠깐 세워두세요." />
          )}
        </SectionCard>

        <SectionCard
          title="진행 중인 프로젝트"
          subtitle={'총 ' + activeProjects.length + '개 진행 중'}
          right={
            <button type="button" className="lc-btn-ghost" onClick={onGoProjects}>
              프로젝트 보기
            </button>
          }
        >
          {activeProjects.length > 0 ? (
            <ul className="space-y-3">
              {activeProjects.slice(0, 4).map((p: Project) => (
                <li key={p.id} className="flex flex-col gap-1 border-l-2 border-[var(--color-blue-soft)] pl-3">
                  <div className="text-sm font-medium lc-text-deep">{p.name}</div>
                  <div className="text-xs lc-text-soft">다음 행동: {p.nextAction || '미설정'}</div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="진행 중인 프로젝트가 없어요" />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="이번 달 구매"
        subtitle={"중복 구매 방지 + 카드값 추적용."}
        right={
          <button type="button" className="lc-btn-ghost" onClick={onGoPurchase}>
            구매 기록
          </button>
        }
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-3xl font-semibold lc-text-deep">
              {purchaseTotal.toLocaleString()}원
            </div>
            <div className="text-xs lc-text-soft mt-1">
              이번 달 {thisMonthPurchases.length}건 · 반품 제외
            </div>
          </div>
          {thisMonthPurchases.slice(0, 3).length > 0 && (
            <ul className="text-right space-y-0.5 max-w-[60%]">
              {thisMonthPurchases.slice(0, 3).map((p) => (
                <li key={p.id} className="text-xs lc-text-soft truncate">
                  {p.name} · {(Number(p.amount) || 0).toLocaleString()}원
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="자주 찾는 물건의 자리"
        subtitle={'"어디 갔지?" 싶을 때 여기서 바로 확인하세요.'}
        right={
          <button type="button" className="lc-btn-ghost" onClick={onGoSpots}>
            전체 지정석
          </button>
        }
      >
        {importantSpots.length > 0 ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {importantSpots.map((s) => (
              <li
                key={s.id}
                className="lc-card p-3 flex flex-col gap-1.5 bg-gradient-to-br from-white to-[var(--color-ivory-50)]"
              >
                <div className="text-sm font-semibold lc-text-deep">{s.name}</div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="lc-chip bg-[#e9f0f8] lc-text-blue shrink-0">집</span>
                  <span className="lc-text-deep">
                    {s.homeSpot || <span className="lc-text-soft">자리 미설정</span>}
                  </span>
                </div>
                {s.carSpot && (
                  <div className="flex items-start gap-2 text-xs">
                    <span className="lc-chip bg-[#f1ece4] text-[var(--color-accent-warm)] shrink-0">차</span>
                    <span className="lc-text-deep">{s.carSpot}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="자주 찾는 물건이 등록되지 않았어요"
            description={'지정석 화면에서 "자주 찾음"으로 표시하면 여기 떠요.'}
            action={
              <button type="button" className="lc-btn-primary" onClick={onGoSpots}>
                지정석 열기
              </button>
            }
          />
        )}
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard
          title="이사 D-Day"
          subtitle={'퇴거 ' + moveInfo.oldOutDate + ' · 입주 ' + moveInfo.newInDate}
          right={
            <button type="button" className="lc-btn-ghost" onClick={onGoMove}>
              체크리스트
            </button>
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs lc-text-soft">기존 집 퇴거</div>
              <div className="text-lg font-semibold lc-text-deep">{dDayLabel(moveInfo.oldOutDate)}</div>
            </div>
            <div className="lc-divider w-px h-12 mx-1 self-stretch" />
            <div className="space-y-1">
              <div className="text-xs lc-text-soft">새 집 입주</div>
              <div className="text-lg font-semibold lc-text-deep">{dDayLabel(moveInfo.newInDate)}</div>
            </div>
            <div className="lc-divider w-px h-12 mx-1 self-stretch" />
            <div className="space-y-1">
              <div className="text-xs lc-text-soft">보관 기간</div>
              <div className="text-lg font-semibold lc-text-deep">약 {moveInfo.storageDays}일</div>
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-[var(--color-ivory-100)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-blue-mid)] transition-all"
              style={{ width: movePercent + '%' }}
            />
          </div>
          <div className="mt-1 text-xs lc-text-soft">이사 준비 {movePercent}% 완료</div>
        </SectionCard>

        <SectionCard
          title="구독 월 예상 비용"
          subtitle="해지 완료 제외 합계"
          right={
            <button type="button" className="lc-btn-ghost" onClick={onGoSubs}>
              구독 관리
            </button>
          }
        >
          <div className="flex items-end justify-between">
            <div className="text-3xl font-semibold lc-text-deep">
              {monthlySubsTotal.toLocaleString()}원
            </div>
            <div className="text-xs lc-text-soft text-right">
              사용 중 {data.subscriptions.filter((s) => s.usage === 'using').length} ·
              거의 안 씀 {data.subscriptions.filter((s) => s.usage === 'rare').length} ·
              해지 예정 {data.subscriptions.filter((s) => s.usage === 'cancel-planned').length}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function defaultHeadline(checkIn?: DailyCheckIn): string {
  if (!checkIn) return '아침 체크인을 하면 오늘 핵심 문장이 여기에 나타납니다.';
  if (checkIn.condition === 'good')
    return '좋아요. 그래도 한 번에 너무 많이 열지 말고, 3교시부터 끝내봅시다.';
  if (checkIn.condition === 'normal') return '오늘은 딱 3개만 제대로 해도 충분합니다.';
  return '오늘은 최소 모드로 갑니다. 무너지지 않는 게 목표예요.';
}

function StatusChip({ status }: { status: 'planned' | 'inProgress' | 'done' }) {
  if (status === 'done') {
    return <span className="lc-chip bg-[#e8efe5] text-[var(--color-success)]">완료</span>;
  }
  if (status === 'inProgress') {
    return <span className="lc-chip bg-[#f1ece4] text-[var(--color-accent-warm)]">진행 중</span>;
  }
  return <span className="lc-chip bg-[var(--color-ivory-100)] lc-text-soft">예정</span>;
}
