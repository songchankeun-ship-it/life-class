import { useMemo, useState } from 'react';
import type {
  AppData,
  MoveChecklistItem,
  MoveSection,
} from '../types';
import { MOVE_SECTION_LABEL } from '../types';
import { SectionCard } from './SectionCard';
import { moveInfo } from '../data/defaultData';
import { dDayLabel } from '../utils/date';

interface MoveChecklistProps {
  data: AppData;
  onUpdate: (items: MoveChecklistItem[]) => void;
}

const SECTIONS: MoveSection[] = ['contract', 'schedule', 'pack', 'after'];

export function MoveChecklistView({ data, onUpdate }: MoveChecklistProps) {
  const items = data.moveChecklist;

  const grouped = useMemo(() => {
    const map: Record<MoveSection, MoveChecklistItem[]> = {
      contract: [],
      schedule: [],
      pack: [],
      after: [],
    };
    items.forEach((it) => map[it.section].push(it));
    return map;
  }, [items]);

  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  const toggle = (id: string) =>
    onUpdate(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));

  const updateMemo = (id: string, memo: string) =>
    onUpdate(items.map((it) => (it.id === id ? { ...it, memo } : it)));

  const remove = (id: string) =>
    onUpdate(items.filter((it) => it.id !== id));

  const addItem = (section: MoveSection, title: string) => {
    if (!title.trim()) return;
    const next: MoveChecklistItem = {
      id: `move-${section}-${Math.random().toString(36).slice(2, 9)}`,
      section,
      title: title.trim(),
      done: false,
      memo: '',
    };
    onUpdate([...items, next]);
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="이사 핵심 정보"
        subtitle="기본 일정과 조건을 한눈에 확인하세요."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoCell label="기존 집 퇴거" value={moveInfo.oldOutDate} hint={dDayLabel(moveInfo.oldOutDate)} />
          <InfoCell label="새 집 입주" value={moveInfo.newInDate} hint={dDayLabel(moveInfo.newInDate)} />
          <InfoCell label="보관 기간" value={`약 ${moveInfo.storageDays}일`} />
          <InfoCell label="사다리차" value={moveInfo.ladderTruck} />
          <InfoCell label="기존 집 층" value={moveInfo.oldFloor} />
          <InfoCell label="새 집 층" value={moveInfo.newFloor} />
          <InfoCell label="전입신고" value={moveInfo.movein} />
          <InfoCell label="확정일자" value={moveInfo.registration} />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm lc-text-soft">전체 진행률</div>
            <div className="text-sm font-semibold lc-text-deep">
              이사 준비 {percent}% 완료 ({done}/{total})
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--color-ivory-100)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-blue-mid)] transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SECTIONS.map((sec) => (
          <SectionBlock
            key={sec}
            section={sec}
            items={grouped[sec]}
            onToggle={toggle}
            onUpdateMemo={updateMemo}
            onRemove={remove}
            onAdd={(title) => addItem(sec, title)}
          />
        ))}
      </div>
    </div>
  );
}

function InfoCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="lc-card p-3 flex flex-col gap-1">
      <div className="text-[11px] lc-text-soft">{label}</div>
      <div className="text-sm font-semibold lc-text-deep">{value}</div>
      {hint && (
        <div className="text-[11px] lc-text-blue font-medium">{hint}</div>
      )}
    </div>
  );
}

interface SectionBlockProps {
  section: MoveSection;
  items: MoveChecklistItem[];
  onToggle: (id: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onRemove: (id: string) => void;
  onAdd: (title: string) => void;
}

function SectionBlock({
  section,
  items,
  onToggle,
  onUpdateMemo,
  onRemove,
  onAdd,
}: SectionBlockProps) {
  const [newTitle, setNewTitle] = useState('');

  const done = items.filter((i) => i.done).length;
  return (
    <SectionCard
      title={MOVE_SECTION_LABEL[section]}
      subtitle={`${done}/${items.length} 완료`}
    >
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id} className="flex flex-col gap-2 border-b border-[rgba(60,72,90,0.06)] pb-3 last:border-0 last:pb-0">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={it.done}
                onChange={() => onToggle(it.id)}
                className="mt-1 size-4 accent-[var(--color-blue-mid)]"
              />
              <span
                className={
                  'text-sm ' +
                  (it.done
                    ? 'line-through lc-text-soft'
                    : 'lc-text-deep')
                }
              >
                {it.title}
              </span>
            </label>
            <input
              className="lc-input text-xs"
              placeholder="메모 (예: 견적 250만원, 보관 포함)"
              value={it.memo}
              onChange={(e) => onUpdateMemo(it.id, e.target.value)}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="text-[11px] lc-text-soft hover:text-[var(--color-danger)]"
                onClick={() => onRemove(it.id)}
              >
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 pt-3">
        <input
          className="lc-input"
          placeholder="항목 추가"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onAdd(newTitle);
              setNewTitle('');
            }
          }}
        />
        <button
          type="button"
          className="lc-btn-ghost"
          onClick={() => {
            onAdd(newTitle);
            setNewTitle('');
          }}
        >
          추가
        </button>
      </div>
    </SectionCard>
  );
}
