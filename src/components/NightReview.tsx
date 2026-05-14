import { useEffect, useMemo, useState } from 'react';
import type {
  AppData,
  Condition,
  DailyPlan,
  NightReview as NightReviewType,
} from '../types';
import { CONDITION_LABEL } from '../types';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { computeNightReview } from '../utils/planner';
import { todayISO, formatKoreanDate } from '../utils/date';

interface NightReviewProps {
  data: AppData;
  onSave: (review: NightReviewType) => void;
}

const splitLines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export function NightReviewView({ data, onSave }: NightReviewProps) {
  const today = todayISO();
  const existing = data.reviews[today];
  const plan: DailyPlan | undefined = data.dailyPlans[today];

  const defaultDone = useMemo(
    () =>
      plan?.blocks.filter((b) => b.status === 'done').map((b) => b.action) ?? [],
    [plan],
  );
  const defaultUndone = useMemo(
    () =>
      plan?.blocks.filter((b) => b.status !== 'done').map((b) => b.action) ?? [],
    [plan],
  );

  const [doneText, setDoneText] = useState(
    existing?.doneList.join('\n') ?? defaultDone.join('\n'),
  );
  const [undoneText, setUndoneText] = useState(
    existing?.undoneList.join('\n') ?? defaultUndone.join('\n'),
  );
  const [pushText, setPushText] = useState(
    existing?.pushToTomorrow.join('\n') ?? '',
  );
  const [condition, setCondition] = useState<Condition>(
    existing?.condition ?? 'normal',
  );
  const [oneLine, setOneLine] = useState(existing?.oneLine ?? '');

  useEffect(() => {
    if (existing) return;
    setDoneText(defaultDone.join('\n'));
    setUndoneText(defaultUndone.join('\n'));
  }, [defaultDone, defaultUndone, existing]);

  const computed = useMemo(
    () =>
      computeNightReview(
        splitLines(doneText),
        splitLines(undoneText),
        splitLines(pushText),
        condition,
      ),
    [doneText, undoneText, pushText, condition],
  );

  const save = () => {
    const review: NightReviewType = {
      date: today,
      doneList: splitLines(doneText),
      undoneList: splitLines(undoneText),
      pushToTomorrow: splitLines(pushText),
      condition,
      oneLine: oneLine.trim(),
      computed,
      createdAt: new Date().toISOString(),
    };
    onSave(review);
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title={`${formatKoreanDate(today)} · 밤 정산`}
        subtitle="오늘 하루를 닫고 내일을 가볍게 만들기."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="lc-section-title">오늘 완료한 일</div>
            <textarea
              className="lc-input min-h-[110px]"
              placeholder="줄바꿈으로 여러 개"
              value={doneText}
              onChange={(e) => setDoneText(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="lc-section-title">오늘 못 한 일</div>
            <textarea
              className="lc-input min-h-[110px]"
              placeholder="줄바꿈으로 여러 개"
              value={undoneText}
              onChange={(e) => setUndoneText(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div className="space-y-2">
            <div className="lc-section-title">내일로 넘길 일</div>
            <textarea
              className="lc-input min-h-[80px]"
              placeholder="다시 판 위에 올릴 항목"
              value={pushText}
              onChange={(e) => setPushText(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="lc-section-title">오늘 컨디션</div>
            <div className="flex gap-2">
              {(['good', 'normal', 'bad'] as Condition[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={
                    'flex-1 py-2 rounded-xl text-sm font-medium border ' +
                    (c === condition
                      ? 'bg-[var(--color-blue-mid)] text-white border-transparent'
                      : 'bg-white lc-text-soft border-[rgba(60,72,90,0.14)]')
                  }
                >
                  {CONDITION_LABEL[c]}
                </button>
              ))}
            </div>
            <input
              className="lc-input"
              placeholder="한 줄 회고 (선택)"
              value={oneLine}
              onChange={(e) => setOneLine(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button type="button" className="lc-btn-primary" onClick={save}>
            오늘 정산 저장
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="자동 정리"
        subtitle="입력한 내용을 바탕으로 내일을 가볍게 정리해드릴게요."
      >
        {splitLines(doneText).length + splitLines(undoneText).length === 0 ? (
          <EmptyState title="아직 정산 내용이 비어있어요" />
        ) : (
          <div className="space-y-4">
            <Card title="오늘 잘한 점">{computed.didWell}</Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="내일 꼭 해야 할 3개">
                {computed.tomorrowMust.length > 0 ? (
                  <ul className="space-y-1.5">
                    {computed.tomorrowMust.map((t, i) => (
                      <li key={i} className="text-sm lc-text-deep flex gap-2">
                        <span className="lc-text-blue font-semibold">·</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-sm lc-text-soft">없음</span>
                )}
              </Card>
              <Card title="내일 미뤄도 되는 것">
                {computed.tomorrowCanDelay.length > 0 ? (
                  <ul className="space-y-1.5">
                    {computed.tomorrowCanDelay.map((t, i) => (
                      <li key={i} className="text-sm lc-text-soft flex gap-2">
                        <span>·</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-sm lc-text-soft">없음</span>
                )}
              </Card>
            </div>

            <Card title="내일 아침 첫 행동">
              <span className="text-sm font-medium lc-text-deep">
                {computed.tomorrowFirstAction}
              </span>
            </Card>

            <Card title="자책하지 않아도 되는 이유">
              <span className="text-sm lc-text-soft">{computed.kindNote}</span>
            </Card>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="lc-card p-4 flex flex-col gap-2 bg-gradient-to-br from-white to-[var(--color-ivory-50)]">
      <div className="lc-section-title">{title}</div>
      <div>{children}</div>
    </div>
  );
}
