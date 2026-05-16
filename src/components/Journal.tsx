import { useMemo, useState } from 'react';
import type { AppData, JournalEntry, ParkingItem, Purchase, PurchaseCategory } from '../types';
import { PURCHASE_CATEGORY_LABEL } from '../types';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { todayISO } from '../utils/date';
import { extract } from '../utils/extractor';
import { classifyCategory } from '../utils/planner';

interface JournalProps {
  data: AppData;
  onSaveJournal: (entry: JournalEntry) => void;
  onAddParking: (items: ParkingItem[]) => void;
  onAddPurchases: (items: Purchase[]) => void;
}

function guessPurchaseCategory(name: string): PurchaseCategory {
  const lower = name.toLowerCase();
  const map: Record<PurchaseCategory, string[]> = {
    clothes: ['옷', '셔츠', '바지', '자켓', '코트', '후드', '신발', '운동화'],
    food: ['음식', '라면', '커피', '과자', '음료', '치킨', '피자', '계란', '쌀'],
    tech: ['노트북', '키보드', '마우스', '폰', '충전기', '이어폰', '시계', '카시오', '쿠커'],
    home: ['청소', '컵', '그릇', '수건', '이불', '주방', '쿠커'],
    beauty: ['스킨', '로션', '향수', '아벤느', '세럼', '마스크팩'],
    hobby: ['게임', '책', '만화', '레고', '굿즈', '피규어', '사우나'],
    etc: [],
  };
  let best: PurchaseCategory = 'etc';
  let bestScore = 0;
  (Object.keys(map) as PurchaseCategory[]).forEach((c) => {
    let s = 0;
    map[c].forEach((kw) => {
      if (lower.includes(kw.toLowerCase())) s += 1;
    });
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  });
  return best;
}

export function Journal({
  data,
  onSaveJournal,
  onAddParking,
  onAddPurchases,
}: JournalProps) {
  const today = todayISO();
  const existing = data.journals.find((j) => j.date === today);

  const [body, setBody] = useState(existing?.body ?? '');
  const [showPreview, setShowPreview] = useState(false);

  const result = useMemo(() => extract(body), [body]);

  const hasContent =
    result.todos.length + result.purchases.length + result.events.length + result.notes.length > 0;

  const save = () => {
    if (!body.trim()) return;

    const stamp = new Date().toISOString();
    const entry: JournalEntry = {
      id: existing?.id ?? 'jr-' + Math.random().toString(36).slice(2, 10),
      date: today,
      body: body.trim(),
      extracted: result,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
    };
    onSaveJournal(entry);

    // 추출된 항목들 각 영역에 자동 추가
    if (result.todos.length > 0) {
      const parking: ParkingItem[] = result.todos.map((t) => ({
        id: 'park-' + Math.random().toString(36).slice(2, 10),
        title: t,
        category: classifyCategory(t),
        importance: 'mid',
        memo: '일기에서 자동 추출',
        createdAt: stamp,
      }));
      onAddParking(parking);
    }

    if (result.purchases.length > 0) {
      const purchases: Purchase[] = result.purchases.map((name) => ({
        id: 'pur-' + Math.random().toString(36).slice(2, 10),
        name,
        store: '',
        amount: 0,
        category: guessPurchaseCategory(name),
        orderDate: today,
        status: 'ordered',
        memo: '일기에서 자동 추출',
        createdAt: stamp,
        updatedAt: stamp,
      }));
      onAddPurchases(purchases);
    }

    // 이벤트는 일단 주차장으로
    if (result.events.length > 0) {
      const eventParking: ParkingItem[] = result.events.map((t) => ({
        id: 'park-' + Math.random().toString(36).slice(2, 10),
        title: t,
        category: 'etc',
        importance: 'mid',
        memo: '일기에서 추출 (이벤트)',
        createdAt: stamp,
      }));
      onAddParking(eventParking);
    }

    setShowPreview(false);
  };

  const recent = [...data.journals]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <SectionCard
        title="오늘 일기"
        subtitle="머릿속 그대로 적기. 저장하면 알아서 분류해줘요."
      >
        <textarea
          className="lc-input min-h-[180px]"
          placeholder={'예시:\n오늘은 그냥 피곤함\n계란쿠커, 아벤느 스킨 샀고\n토요일에 짐 정리 해야됨\n일요일 여친 픽업'}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="lc-btn-ghost"
            onClick={() => setShowPreview((v) => !v)}
            disabled={!body.trim()}
          >
            {showPreview ? '미리보기 닫기' : '미리보기'}
          </button>
          <button
            type="button"
            className="lc-btn-primary"
            onClick={save}
            disabled={!body.trim()}
          >
            저장 + 자동 분류
          </button>
        </div>
      </SectionCard>

      {showPreview && hasContent && (
        <SectionCard
          title="이렇게 분류될 거예요"
          subtitle='저장 누르면 각 탭에 자동으로 추가됩니다.'
        >
          {result.purchases.length > 0 && (
            <div className="mb-4">
              <div className="lc-section-title mb-2">구매 {result.purchases.length}</div>
              <ul className="space-y-1.5">
                {result.purchases.map((p, i) => (
                  <li key={i} className="text-sm lc-text-deep flex items-center justify-between">
                    <span>{p}</span>
                    <span className="lc-chip bg-[var(--color-bg-soft)] lc-text-soft">
                      {PURCHASE_CATEGORY_LABEL[guessPurchaseCategory(p)]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.todos.length > 0 && (
            <div className="mb-4">
              <div className="lc-section-title mb-2">할 일 {result.todos.length}</div>
              <ul className="space-y-1.5">
                {result.todos.map((t, i) => (
                  <li key={i} className="text-sm lc-text-deep">· {t}</li>
                ))}
              </ul>
            </div>
          )}
          {result.events.length > 0 && (
            <div className="mb-4">
              <div className="lc-section-title mb-2">이벤트/약속 {result.events.length}</div>
              <ul className="space-y-1.5">
                {result.events.map((t, i) => (
                  <li key={i} className="text-sm lc-text-deep">· {t}</li>
                ))}
              </ul>
            </div>
          )}
          {result.notes.length > 0 && (
            <div>
              <div className="lc-section-title mb-2">메모/감상 {result.notes.length}</div>
              <ul className="space-y-1.5">
                {result.notes.map((t, i) => (
                  <li key={i} className="text-sm lc-text-soft">· {t}</li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title={'최근 일기 (' + recent.length + ')'}>
        {recent.length === 0 ? (
          <EmptyState
            title="아직 일기가 없어요"
            description="위에 자유롭게 적으세요. 분류는 알아서 합니다."
          />
        ) : (
          <ul className="space-y-3">
            {recent.map((j) => (
              <li key={j.id} className="lc-card p-4">
                <div className="text-xs lc-text-mute font-medium mb-1">{j.date}</div>
                <div className="text-sm lc-text-deep whitespace-pre-line">{j.body}</div>
                {j.extracted && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {j.extracted.todos.length > 0 && (
                      <span className="lc-chip bg-[var(--color-accent-soft)] lc-text-blue">
                        할 일 {j.extracted.todos.length}
                      </span>
                    )}
                    {j.extracted.purchases.length > 0 && (
                      <span className="lc-chip bg-[var(--color-warm-soft)] text-[var(--color-warm)]">
                        구매 {j.extracted.purchases.length}
                      </span>
                    )}
                    {j.extracted.events.length > 0 && (
                      <span className="lc-chip bg-[var(--color-success-soft)] text-[var(--color-success)]">
                        이벤트 {j.extracted.events.length}
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
