import { useMemo, useState } from 'react';
import type { AppData, SpotItem } from '../types';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';

interface SpotBoardProps {
  data: AppData;
  onUpdate: (items: SpotItem[]) => void;
}

const blankSpot = (): SpotItem => ({
  id: `spot-${Math.random().toString(36).slice(2, 10)}`,
  name: '',
  homeSpot: '',
  carSpot: '',
  important: false,
  memo: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function SpotBoard({ data, onUpdate }: SpotBoardProps) {
  const items = data.spots;
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SpotItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.homeSpot.toLowerCase().includes(q) ||
        it.carSpot.toLowerCase().includes(q) ||
        it.memo.toLowerCase().includes(q),
    );
  }, [items, query]);

  const important = filtered.filter((it) => it.important);
  const others = filtered.filter((it) => !it.important);

  const startNew = () => {
    const s = blankSpot();
    setEditingId(s.id);
    setDraft(s);
  };

  const startEdit = (it: SpotItem) => {
    setEditingId(it.id);
    setDraft({ ...it });
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
    const stamp = new Date().toISOString();
    const next = items.some((it) => it.id === draft.id)
      ? items.map((it) =>
          it.id === draft.id ? { ...draft, updatedAt: stamp } : it,
        )
      : [...items, { ...draft, updatedAt: stamp }];
    onUpdate(next);
    cancelEdit();
  };

  const remove = (id: string) => {
    if (!confirm('이 지정석을 삭제할까요?')) return;
    onUpdate(items.filter((it) => it.id !== id));
  };

  const toggleImportant = (id: string) => {
    onUpdate(
      items.map((it) =>
        it.id === id
          ? { ...it, important: !it.important, updatedAt: new Date().toISOString() }
          : it,
      ),
    );
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="지정석"
        subtitle="물건이 어디 사는지 한 번만 정해두기. 찾을 때 여기서 검색."
        right={
          <button type="button" className="lc-btn-primary" onClick={startNew}>
            물건 추가
          </button>
        }
      >
        <input
          className="lc-input"
          placeholder="물건 이름으로 검색 (예: 차키)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </SectionCard>

      {editingId && draft && !items.some((it) => it.id === editingId) && (
        <SectionCard title="새 물건">
          <SpotEditor
            draft={draft}
            setDraft={setDraft}
            onSave={save}
            onCancel={cancelEdit}
          />
        </SectionCard>
      )}

      {filtered.length === 0 ? (
        <SectionCard title="검색 결과 없음">
          <EmptyState
            title={query ? '일치하는 물건이 없어요' : '지정석이 비어있어요'}
            description={
              query
                ? '다른 키워드로 찾거나, 새 물건을 추가해보세요.'
                : '자주 잃어버리는 것부터 한 개씩 등록해보세요.'
            }
          />
        </SectionCard>
      ) : (
        <div className="space-y-5">
          {important.length > 0 && (
            <SectionCard
              title={`자주 찾는 것 (${important.length})`}
              subtitle="가장 위에 고정해두는 물건들."
            >
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {important.map((it) => (
                  <li key={it.id}>
                    {editingId === it.id && draft ? (
                      <div className="lc-card p-4">
                        <SpotEditor
                          draft={draft}
                          setDraft={setDraft}
                          onSave={save}
                          onCancel={cancelEdit}
                        />
                      </div>
                    ) : (
                      <SpotCard
                        item={it}
                        onEdit={() => startEdit(it)}
                        onRemove={() => remove(it.id)}
                        onToggleImportant={() => toggleImportant(it.id)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {others.length > 0 && (
            <SectionCard
              title={
                important.length > 0
                  ? `그 외 (${others.length})`
                  : `등록된 물건 (${others.length})`
              }
            >
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {others.map((it) => (
                  <li key={it.id}>
                    {editingId === it.id && draft ? (
                      <div className="lc-card p-4">
                        <SpotEditor
                          draft={draft}
                          setDraft={setDraft}
                          onSave={save}
                          onCancel={cancelEdit}
                        />
                      </div>
                    ) : (
                      <SpotCard
                        item={it}
                        onEdit={() => startEdit(it)}
                        onRemove={() => remove(it.id)}
                        onToggleImportant={() => toggleImportant(it.id)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}

interface SpotCardProps {
  item: SpotItem;
  onEdit: () => void;
  onRemove: () => void;
  onToggleImportant: () => void;
}

function SpotCard({
  item,
  onEdit,
  onRemove,
  onToggleImportant,
}: SpotCardProps) {
  return (
    <div className="lc-card p-4 flex flex-col gap-3 bg-gradient-to-br from-white to-[var(--color-ivory-50)]">
      <header className="flex items-start justify-between gap-3">
        <div className="text-lg font-semibold lc-text-deep">{item.name}</div>
        <button
          type="button"
          onClick={onToggleImportant}
          className={
            'text-[11px] px-2 py-1 rounded-full font-medium ' +
            (item.important
              ? 'bg-[#f5ece0] text-[var(--color-accent-warm)]'
              : 'bg-[var(--color-ivory-100)] lc-text-soft')
          }
        >
          {item.important ? '★ 자주 찾음' : '☆ 보통'}
        </button>
      </header>

      <div className="grid grid-cols-1 gap-2">
        <div className="flex items-start gap-2 text-sm">
          <span className="lc-chip bg-[#e9f0f8] lc-text-blue shrink-0">집</span>
          <span className="lc-text-deep">
            {item.homeSpot || (
              <span className="lc-text-soft">자리 미설정</span>
            )}
          </span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <span className="lc-chip bg-[#f1ece4] text-[var(--color-accent-warm)] shrink-0">
            차
          </span>
          <span className="lc-text-deep">
            {item.carSpot || (
              <span className="lc-text-soft">차에는 안 둠</span>
            )}
          </span>
        </div>
      </div>

      {item.memo && (
        <div className="text-xs lc-text-soft whitespace-pre-line border-t border-[rgba(60,72,90,0.06)] pt-2">
          📝 {item.memo}
        </div>
      )}

      <footer className="flex gap-2 pt-1">
        <button type="button" className="lc-btn-ghost" onClick={onEdit}>
          수정
        </button>
        <button type="button" className="lc-btn-danger" onClick={onRemove}>
          삭제
        </button>
      </footer>
    </div>
  );
}

interface SpotEditorProps {
  draft: SpotItem;
  setDraft: (s: SpotItem) => void;
  onSave: () => void;
  onCancel: () => void;
}

function SpotEditor({ draft, setDraft, onSave, onCancel }: SpotEditorProps) {
  const set = <K extends keyof SpotItem>(key: K, v: SpotItem[K]) =>
    setDraft({ ...draft, [key]: v });

  return (
    <div className="space-y-3">
      <input
        className="lc-input"
        placeholder="물건 이름 (예: 차키)"
        value={draft.name}
        onChange={(e) => set('name', e.target.value)}
        autoFocus
      />
      <input
        className="lc-input"
        placeholder="집에서의 자리 (예: 현관 트레이)"
        value={draft.homeSpot}
        onChange={(e) => set('homeSpot', e.target.value)}
      />
      <input
        className="lc-input"
        placeholder="차에서의 자리 (예: 운전석 컵홀더 / 비워두면 차에 안 둠)"
        value={draft.carSpot}
        onChange={(e) => set('carSpot', e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm lc-text-deep">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-blue-mid)]"
          checked={draft.important}
          onChange={(e) => set('important', e.target.checked)}
        />
        자주 찾는 물건 (상단 고정)
      </label>
      <textarea
        className="lc-input min-h-[60px]"
        placeholder="메모 (예: 들어오면 무조건 트레이로)"
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
