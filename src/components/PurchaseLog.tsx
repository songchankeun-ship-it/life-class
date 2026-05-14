import { useMemo, useState } from 'react';
import type { AppData, Purchase, PurchaseCategory, PurchaseStatus } from '../types';
import { PURCHASE_CATEGORY_LABEL, PURCHASE_STATUS_LABEL } from '../types';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { StatCard } from './StatCard';
import { todayISO } from '../utils/date';

interface PurchaseLogProps {
  data: AppData;
  onUpdate: (items: Purchase[]) => void;
}

const CATEGORY_KEYWORDS: Record<PurchaseCategory, string[]> = {
  clothes: ['옷', '셔츠', '바지', '자켓', '코트', '후드', '맨투맨', '티셔츠', '신발', '운동화', '구두', '양말', '속옷', '청바지', '슬랙스', '니트', '카디건', '점퍼', '패딩'],
  food: ['음식', '식료품', '라면', '커피', '과자', '음료', '술', '맥주', '와인', '쿠팡프레시', '컬리', '마켓', '배달', '치킨', '피자', '간식'],
  tech: ['노트북', '키보드', '마우스', '폰', '아이폰', '갤럭시', '충전기', '케이블', '이어폰', '에어팟', '모니터', '카메라', '태블릿', '아이패드', 'SSD', '메모리'],
  home: ['청소', '컵', '그릇', '수건', '이불', '매트', '침대', '의자', '책상', '세제', '휴지', '정리함', '수납', '러그', '커튼', '램프'],
  beauty: ['화장', '로션', '향수', '스킨', '세럼', '마스크팩', '쉐이버', '면도', '샴푸', '바디로션', '선크림'],
  hobby: ['게임', '책', '만화', '레고', '굿즈', '피규어', '키링', '플레이', '닌텐도', '플스'],
  etc: [],
};

function guessCategory(name: string): PurchaseCategory {
  const lower = name.toLowerCase();
  let best: PurchaseCategory = 'etc';
  let bestScore = 0;
  (Object.keys(CATEGORY_KEYWORDS) as PurchaseCategory[]).forEach((c) => {
    let s = 0;
    CATEGORY_KEYWORDS[c].forEach((kw) => {
      if (lower.includes(kw.toLowerCase())) s += 1;
    });
    if (s > bestScore) { bestScore = s; best = c; }
  });
  return best;
}

function similarTo(name: string, items: Purchase[]): Purchase[] {
  const q = name.trim().toLowerCase();
  if (!q || q.length < 2) return [];
  return items.filter((p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()));
}

function isThisMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function isLastMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  const lm = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
}

const blank = (): Purchase => ({
  id: 'pur-' + Math.random().toString(36).slice(2, 10),
  name: '',
  store: '',
  amount: 0,
  category: 'etc',
  orderDate: todayISO(),
  status: 'ordered',
  memo: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function PurchaseLog({ data, onUpdate }: PurchaseLogProps) {
  const items = data.purchases;
  const [draft, setDraft] = useState<Purchase>(blank());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Purchase | null>(null);
  const [query, setQuery] = useState('');

  const now = new Date();

  const duplicates = useMemo(() => similarTo(draft.name, items), [draft.name, items]);

  const thisMonth = useMemo(
    () => items.filter((p) => isThisMonth(p.orderDate, now) && p.status !== 'returned'),
    [items, now],
  );
  const lastMonth = useMemo(
    () => items.filter((p) => isLastMonth(p.orderDate, now) && p.status !== 'returned'),
    [items, now],
  );

  const thisMonthTotal = thisMonth.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const lastMonthTotal = lastMonth.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const byCategory = useMemo(() => {
    const map: Partial<Record<PurchaseCategory, number>> = {};
    thisMonth.forEach((p) => {
      map[p.category] = (map[p.category] ?? 0) + (Number(p.amount) || 0);
    });
    return Object.entries(map).sort((a, b) => (b[1] as number) - (a[1] as number));
  }, [thisMonth]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...items].sort((a, b) => b.orderDate.localeCompare(a.orderDate));
    if (!q) return sorted;
    return sorted.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.store.toLowerCase().includes(q) ||
        p.memo.toLowerCase().includes(q),
    );
  }, [items, query]);

  const setField = <K extends keyof Purchase>(k: K, v: Purchase[K]) => {
    setDraft((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'name' && typeof v === 'string' && v.length >= 2) {
        const guessed = guessCategory(v);
        if (prev.category === 'etc' && guessed !== 'etc') next.category = guessed;
      }
      return next;
    });
  };

  const addPurchase = () => {
    if (!draft.name.trim()) return;
    const next: Purchase = {
      ...draft,
      name: draft.name.trim(),
      store: draft.store.trim(),
      memo: draft.memo.trim(),
      amount: Number(draft.amount) || 0,
      updatedAt: new Date().toISOString(),
    };
    onUpdate([next, ...items]);
    setDraft(blank());
  };

  const startEdit = (p: Purchase) => {
    setEditingId(p.id);
    setEditDraft({ ...p });
  };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };
  const saveEdit = () => {
    if (!editDraft) return;
    if (!editDraft.name.trim()) { cancelEdit(); return; }
    const stamp = new Date().toISOString();
    onUpdate(items.map((p) => (p.id === editDraft.id ? { ...editDraft, updatedAt: stamp } : p)));
    cancelEdit();
  };

  const setStatus = (id: string, s: PurchaseStatus) =>
    onUpdate(items.map((p) => (p.id === id ? { ...p, status: s, updatedAt: new Date().toISOString() } : p)));

  const remove = (id: string) => {
    if (!confirm('이 구매 기록을 삭제할까요?')) return;
    onUpdate(items.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-5">
      <SectionCard title="이번 달 소비" subtitle="해지 완료 / 반품 제외 합계.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="이번 달 합계"
            value={thisMonthTotal.toLocaleString() + '원'}
            hint={thisMonth.length + '건'}
            tone="blue"
          />
          <StatCard
            label="지난 달 합계"
            value={lastMonthTotal.toLocaleString() + '원'}
            hint={lastMonth.length + '건'}
            tone="soft"
          />
          <StatCard
            label="이번 달 차이"
            value={
              (thisMonthTotal - lastMonthTotal >= 0 ? '+' : '') +
              (thisMonthTotal - lastMonthTotal).toLocaleString() + '원'
            }
            hint={
              thisMonthTotal - lastMonthTotal === 0
                ? '같아요'
                : thisMonthTotal - lastMonthTotal > 0
                  ? '더 썼어요'
                  : '덜 썼어요'
            }
            tone={thisMonthTotal - lastMonthTotal > 0 ? 'warm' : 'default'}
          />
          <StatCard
            label="가장 많이 쓴 카테고리"
            value={
              byCategory.length > 0
                ? PURCHASE_CATEGORY_LABEL[byCategory[0][0] as PurchaseCategory]
                : '-'
            }
            hint={
              byCategory.length > 0
                ? (byCategory[0][1] as number).toLocaleString() + '원'
                : '아직 없음'
            }
            tone="default"
          />
        </div>

        {byCategory.length > 0 && (
          <div className="mt-5 space-y-2">
            <div className="lc-section-title">카테고리별 (이번 달)</div>
            {byCategory.map(([cat, amt]) => {
              const pct = thisMonthTotal > 0 ? Math.round(((amt as number) / thisMonthTotal) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="lc-text-deep">
                      {PURCHASE_CATEGORY_LABEL[cat as PurchaseCategory]}
                    </span>
                    <span className="lc-text-soft">
                      {(amt as number).toLocaleString()}원 · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[var(--color-ivory-100)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-blue-mid)]"
                      style={{ width: pct + '%' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="새 구매 기록"
        subtitle='상품명을 적으면 이미 산 게 있는지 자동으로 알려드려요.'
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="lc-input"
            placeholder="상품명 (예: 나이키 후드)"
            value={draft.name}
            onChange={(e) => setField('name', e.target.value)}
          />
          <input
            className="lc-input"
            placeholder="어디서 (예: 무신사, 쿠팡)"
            value={draft.store}
            onChange={(e) => setField('store', e.target.value)}
          />
          <input
            className="lc-input"
            type="number"
            min={0}
            placeholder="가격 (원)"
            value={draft.amount || ''}
            onChange={(e) => setField('amount', Number(e.target.value) || 0)}
          />
          <input
            className="lc-input"
            type="date"
            value={draft.orderDate}
            onChange={(e) => setField('orderDate', e.target.value)}
          />
          <select
            className="lc-input"
            value={draft.category}
            onChange={(e) => setField('category', e.target.value as PurchaseCategory)}
          >
            {(Object.keys(PURCHASE_CATEGORY_LABEL) as PurchaseCategory[]).map((c) => (
              <option key={c} value={c}>{PURCHASE_CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <select
            className="lc-input"
            value={draft.status}
            onChange={(e) => setField('status', e.target.value as PurchaseStatus)}
          >
            {(Object.keys(PURCHASE_STATUS_LABEL) as PurchaseStatus[]).map((s) => (
              <option key={s} value={s}>{PURCHASE_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <textarea
          className="lc-input min-h-[60px] mt-2"
          placeholder="메모 (선택)"
          value={draft.memo}
          onChange={(e) => setField('memo', e.target.value)}
        />

        {duplicates.length > 0 && (
          <div className="mt-3 lc-card p-3 border-l-4 border-[var(--color-accent-warm)] bg-[#fbf4ec]">
            <div className="text-xs font-semibold text-[var(--color-accent-warm)] mb-1">
              ⚠ 비슷한 거 이미 샀어요 ({duplicates.length}건)
            </div>
            <ul className="space-y-1">
              {duplicates.slice(0, 3).map((d) => (
                <li key={d.id} className="text-xs lc-text-deep">
                  · {d.name} · {d.orderDate} · {(Number(d.amount) || 0).toLocaleString()}원
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end pt-3">
          <button type="button" className="lc-btn-primary" onClick={addPurchase}>
            기록 추가
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title={'구매 기록 (' + items.length + ')'}
        subtitle="중복 구매 확인하고 싶으면 검색하세요."
      >
        <input
          className="lc-input mb-3"
          placeholder="상품명 / 쇼핑몰로 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {filtered.length === 0 ? (
          <EmptyState
            title={query ? '일치하는 기록이 없어요' : '아직 기록이 없어요'}
            description={query ? '다른 키워드로 찾아보세요.' : '위에서 첫 구매를 기록해보세요.'}
          />
        ) : (
          <ul className="space-y-2">
            {filtered.slice(0, 50).map((p) => (
              <li key={p.id} className="lc-card p-3">
                {editingId === p.id && editDraft ? (
                  <PurchaseEditor
                    draft={editDraft}
                    setDraft={setEditDraft}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                  />
                ) : (
                  <PurchaseRow
                    item={p}
                    onEdit={() => startEdit(p)}
                    onRemove={() => remove(p.id)}
                    onSetStatus={(s) => setStatus(p.id, s)}
                  />
                )}
              </li>
            ))}
            {filtered.length > 50 && (
              <li className="text-xs lc-text-soft text-center pt-2">
                상위 50건만 표시. 검색해서 찾아주세요.
              </li>
            )}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

interface PurchaseRowProps {
  item: Purchase;
  onEdit: () => void;
  onRemove: () => void;
  onSetStatus: (s: PurchaseStatus) => void;
}

function PurchaseRow({ item, onEdit, onRemove, onSetStatus }: PurchaseRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={'text-sm font-semibold ' + (item.status === 'returned' ? 'line-through lc-text-soft' : 'lc-text-deep')}>
            {item.name}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className="lc-chip bg-[var(--color-ivory-100)] lc-text-soft">
              {PURCHASE_CATEGORY_LABEL[item.category]}
            </span>
            {item.store && (
              <span className="lc-chip bg-[#e9f0f8] lc-text-blue">{item.store}</span>
            )}
            <span className="lc-chip bg-[#e9f0f8] lc-text-soft">{item.orderDate}</span>
            <span
              className={
                'lc-chip ' +
                (item.status === 'ordered'
                  ? 'bg-[#e9f0f8] lc-text-blue'
                  : item.status === 'arrived'
                    ? 'bg-[#e8efe5] text-[var(--color-success)]'
                    : 'bg-[#f1e8e8] text-[var(--color-danger)]')
              }
            >
              {PURCHASE_STATUS_LABEL[item.status]}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold lc-text-deep">
            {(Number(item.amount) || 0).toLocaleString()}원
          </div>
        </div>
      </div>
      {item.memo && (
        <div className="text-xs lc-text-soft whitespace-pre-line">📝 {item.memo}</div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <select
          className="lc-input max-w-[120px]"
          value={item.status}
          onChange={(e) => onSetStatus(e.target.value as PurchaseStatus)}
        >
          {(Object.keys(PURCHASE_STATUS_LABEL) as PurchaseStatus[]).map((s) => (
            <option key={s} value={s}>{PURCHASE_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button type="button" className="lc-btn-ghost" onClick={onEdit}>수정</button>
        <button type="button" className="lc-btn-danger" onClick={onRemove}>삭제</button>
      </div>
    </div>
  );
}

interface PurchaseEditorProps {
  draft: Purchase;
  setDraft: (p: Purchase) => void;
  onSave: () => void;
  onCancel: () => void;
}

function PurchaseEditor({ draft, setDraft, onSave, onCancel }: PurchaseEditorProps) {
  const set = <K extends keyof Purchase>(k: K, v: Purchase[K]) =>
    setDraft({ ...draft, [k]: v });
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input className="lc-input" placeholder="상품명" value={draft.name} onChange={(e) => set('name', e.target.value)} />
        <input className="lc-input" placeholder="어디서" value={draft.store} onChange={(e) => set('store', e.target.value)} />
        <input
          className="lc-input"
          type="number"
          min={0}
          value={draft.amount || ''}
          onChange={(e) => set('amount', Number(e.target.value) || 0)}
        />
        <input
          className="lc-input"
          type="date"
          value={draft.orderDate}
          onChange={(e) => set('orderDate', e.target.value)}
        />
        <select
          className="lc-input"
          value={draft.category}
          onChange={(e) => set('category', e.target.value as PurchaseCategory)}
        >
          {(Object.keys(PURCHASE_CATEGORY_LABEL) as PurchaseCategory[]).map((c) => (
            <option key={c} value={c}>{PURCHASE_CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <select
          className="lc-input"
          value={draft.status}
          onChange={(e) => set('status', e.target.value as PurchaseStatus)}
        >
          {(Object.keys(PURCHASE_STATUS_LABEL) as PurchaseStatus[]).map((s) => (
            <option key={s} value={s}>{PURCHASE_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>
      <textarea
        className="lc-input min-h-[50px]"
        placeholder="메모"
        value={draft.memo}
        onChange={(e) => set('memo', e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button type="button" className="lc-btn-ghost" onClick={onCancel}>취소</button>
        <button type="button" className="lc-btn-primary" onClick={onSave}>저장</button>
      </div>
    </div>
  );
}
