import { useMemo, useState } from 'react';
import type {
  AppData,
  SubscriptionCategory,
  SubscriptionItem,
  SubscriptionUsage,
} from '../types';
import { SUB_CATEGORY_LABEL, SUB_USAGE_LABEL } from '../types';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { StatCard } from './StatCard';

interface SubscriptionManagerProps {
  data: AppData;
  onUpdate: (items: SubscriptionItem[]) => void;
}

type FilterKey = 'all' | 'rare' | 'cancel-planned';

const blankSub = (): SubscriptionItem => ({
  id: `sub-${Math.random().toString(36).slice(2, 10)}`,
  name: '',
  amount: 0,
  payDay: 1,
  usage: 'using',
  category: 'ott',
  memo: '',
});

export function SubscriptionManager({
  data,
  onUpdate,
}: SubscriptionManagerProps) {
  const items = data.subscriptions;
  const [filter, setFilter] = useState<FilterKey>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SubscriptionItem | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'rare') return items.filter((s) => s.usage === 'rare');
    if (filter === 'cancel-planned')
      return items.filter((s) => s.usage === 'cancel-planned');
    return items;
  }, [items, filter]);

  const monthlyTotal = useMemo(
    () =>
      items
        .filter((s) => s.usage !== 'cancelled')
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [items],
  );

  const cancelTotal = useMemo(
    () =>
      items
        .filter((s) => s.usage === 'cancel-planned' || s.usage === 'rare')
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [items],
  );

  const startNew = () => {
    const s = blankSub();
    setEditingId(s.id);
    setDraft(s);
  };

  const startEdit = (s: SubscriptionItem) => {
    setEditingId(s.id);
    setDraft({ ...s });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      cancelEdit();
      return;
    }
    const exists = items.some((s) => s.id === draft.id);
    const next = exists
      ? items.map((s) => (s.id === draft.id ? draft : s))
      : [...items, draft];
    onUpdate(next);
    cancelEdit();
  };

  const remove = (id: string) => {
    if (!confirm('이 구독을 삭제할까요?')) return;
    onUpdate(items.filter((s) => s.id !== id));
  };

  const setUsage = (id: string, usage: SubscriptionUsage) =>
    onUpdate(items.map((s) => (s.id === id ? { ...s, usage } : s)));

  return (
    <div className="space-y-5">
      <SectionCard
        title="구독 / 자동결제"
        subtitle="안 쓰는 구독부터 하나씩 정리해보세요."
        right={
          <button type="button" className="lc-btn-primary" onClick={startNew}>
            구독 추가
          </button>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="월 예상 결제 합계"
            value={`${monthlyTotal.toLocaleString()}원`}
            hint="해지 완료 제외"
            tone="blue"
          />
          <StatCard
            label="정리 가능 금액"
            value={`${cancelTotal.toLocaleString()}원`}
            hint="거의 안 씀 + 해지 예정"
            tone="warm"
          />
          <StatCard
            label="사용 중"
            value={`${items.filter((s) => s.usage === 'using').length}개`}
            tone="default"
          />
          <StatCard
            label="해지 완료"
            value={`${items.filter((s) => s.usage === 'cancelled').length}개`}
            tone="soft"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <FilterBtn label="전체" active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterBtn label="거의 안 씀" active={filter === 'rare'} onClick={() => setFilter('rare')} />
          <FilterBtn label="해지 예정" active={filter === 'cancel-planned'} onClick={() => setFilter('cancel-planned')} />
        </div>
      </SectionCard>

      {editingId && draft && !items.some((s) => s.id === editingId) && (
        <SectionCard title="새 구독">
          <SubEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={cancelEdit} />
        </SectionCard>
      )}

      <SectionCard
        title={`구독 목록 (${filtered.length})`}
        subtitle="결제일/카테고리/사용 여부를 한 번에 보여줘요."
      >
        {filtered.length === 0 ? (
          <EmptyState title="조건에 맞는 구독이 없어요" />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((s) => (
              <li key={s.id} className="lc-card p-4 flex flex-col gap-2">
                {editingId === s.id && draft ? (
                  <SubEditor
                    draft={draft}
                    setDraft={setDraft}
                    onSave={save}
                    onCancel={cancelEdit}
                  />
                ) : (
                  <SubRow
                    item={s}
                    onEdit={() => startEdit(s)}
                    onRemove={() => remove(s.id)}
                    onSetUsage={(u) => setUsage(s.id, u)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function FilterBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-3 py-1.5 rounded-full text-xs font-medium ' +
        (active
          ? 'bg-[var(--color-blue-mid)] text-white'
          : 'bg-[var(--color-ivory-100)] lc-text-soft')
      }
    >
      {label}
    </button>
  );
}

interface SubRowProps {
  item: SubscriptionItem;
  onEdit: () => void;
  onRemove: () => void;
  onSetUsage: (u: SubscriptionUsage) => void;
}

function SubRow({ item, onEdit, onRemove, onSetUsage }: SubRowProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={
              'text-base font-semibold ' +
              (item.usage === 'cancelled'
                ? 'line-through lc-text-soft'
                : 'lc-text-deep')
            }
          >
            {item.name}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className="lc-chip bg-[var(--color-ivory-100)] lc-text-soft">
              {SUB_CATEGORY_LABEL[item.category]}
            </span>
            <span className="lc-chip bg-[#e9f0f8] lc-text-blue">
              매월 {item.payDay}일
            </span>
            <span
              className={
                'lc-chip ' +
                (item.usage === 'using'
                  ? 'bg-[#e8efe5] text-[var(--color-success)]'
                  : item.usage === 'rare'
                    ? 'bg-[#f5ece0] text-[var(--color-accent-warm)]'
                    : item.usage === 'cancel-planned'
                      ? 'bg-[#f1e8e8] text-[var(--color-danger)]'
                      : 'bg-[var(--color-ivory-100)] lc-text-soft')
              }
            >
              {SUB_USAGE_LABEL[item.usage]}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold lc-text-deep">
            {item.amount.toLocaleString()}원
          </div>
        </div>
      </div>

      {item.memo && (
        <p className="text-xs lc-text-soft whitespace-pre-line">📝 {item.memo}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <select
          className="lc-input max-w-[160px]"
          value={item.usage}
          onChange={(e) => onSetUsage(e.target.value as SubscriptionUsage)}
        >
          {(Object.keys(SUB_USAGE_LABEL) as SubscriptionUsage[]).map((u) => (
            <option key={u} value={u}>
              {SUB_USAGE_LABEL[u]}
            </option>
          ))}
        </select>
        <button type="button" className="lc-btn-ghost" onClick={onEdit}>
          수정
        </button>
        <button type="button" className="lc-btn-danger" onClick={onRemove}>
          삭제
        </button>
      </div>
    </>
  );
}

interface SubEditorProps {
  draft: SubscriptionItem;
  setDraft: (s: SubscriptionItem) => void;
  onSave: () => void;
  onCancel: () => void;
}

function SubEditor({ draft, setDraft, onSave, onCancel }: SubEditorProps) {
  const set = <K extends keyof SubscriptionItem>(key: K, v: SubscriptionItem[K]) =>
    setDraft({ ...draft, [key]: v });

  return (
    <div className="space-y-3">
      <input
        className="lc-input"
        placeholder="서비스명"
        value={draft.name}
        onChange={(e) => set('name', e.target.value)}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="lc-input"
          type="number"
          min={0}
          placeholder="월 결제금액"
          value={draft.amount}
          onChange={(e) => set('amount', Number(e.target.value) || 0)}
        />
        <input
          className="lc-input"
          type="number"
          min={1}
          max={31}
          placeholder="결제일 (1~31)"
          value={draft.payDay}
          onChange={(e) =>
            set('payDay', Math.max(1, Math.min(31, Number(e.target.value) || 1)))
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          className="lc-input"
          value={draft.category}
          onChange={(e) =>
            set('category', e.target.value as SubscriptionCategory)
          }
        >
          {(Object.keys(SUB_CATEGORY_LABEL) as SubscriptionCategory[]).map((c) => (
            <option key={c} value={c}>
              {SUB_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select
          className="lc-input"
          value={draft.usage}
          onChange={(e) => set('usage', e.target.value as SubscriptionUsage)}
        >
          {(Object.keys(SUB_USAGE_LABEL) as SubscriptionUsage[]).map((u) => (
            <option key={u} value={u}>
              {SUB_USAGE_LABEL[u]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="lc-input min-h-[60px]"
        placeholder="메모"
        value={draft.memo}
        onChange={(e) => set('memo', e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button type="button" className="lc-btn-ghost" onClick={onCancel}>
          취소
        </button>
        <button type="button" className="lc-btn-primary" onClick={onSave}>
          저장
        </button>
      </div>
    </div>
  );
}
