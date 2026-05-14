import { useState } from 'react';
import type {
  AppData,
  Importance,
  ParkingItem,
  TaskCategory,
} from '../types';
import { CATEGORY_LABEL, IMPORTANCE_LABEL } from '../types';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { classifyCategory } from '../utils/planner';

const PARKING_CATEGORIES: TaskCategory[] = [
  'move',
  'money',
  'work',
  'project',
  'life',
  'couple',
  'trading',
  'etc',
];

interface ParkingLotProps {
  data: AppData;
  onUpdateParking: (items: ParkingItem[]) => void;
  onMoveToToday?: (item: ParkingItem) => void;
}

export function ParkingLot({
  data,
  onUpdateParking,
  onMoveToToday,
}: ParkingLotProps) {
  const items = data.parking;

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('etc');
  const [importance, setImportance] = useState<Importance>('mid');
  const [memo, setMemo] = useState('');

  const onTitleChange = (v: string) => {
    setTitle(v);
    const guess = classifyCategory(v);
    if (guess !== 'etc') setCategory(guess);
  };

  const add = () => {
    if (!title.trim()) return;
    const item: ParkingItem = {
      id: `park-${Math.random().toString(36).slice(2, 10)}`,
      title: title.trim(),
      category,
      importance,
      memo: memo.trim(),
      createdAt: new Date().toISOString(),
    };
    onUpdateParking([item, ...items]);
    setTitle('');
    setMemo('');
    setImportance('mid');
    setCategory('etc');
  };

  const toggleDone = (id: string) =>
    onUpdateParking(
      items.map((p) => (p.id === id ? { ...p, done: !p.done } : p)),
    );

  const remove = (id: string) =>
    onUpdateParking(items.filter((p) => p.id !== id));

  const moveTo = (item: ParkingItem) => {
    onUpdateParking(
      items.map((p) =>
        p.id === item.id ? { ...p, movedToToday: true } : p,
      ),
    );
    onMoveToToday?.(item);
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="작업 주차장"
        subtitle="떠오른 일을 바로 하지 말고, 여기에 잠깐 세워두세요."
      >
        <div className="space-y-3">
          <input
            className="lc-input"
            placeholder="예: 보관이사 업체 후보 더 알아보기"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select
              className="lc-input"
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
            >
              {PARKING_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <select
              className="lc-input"
              value={importance}
              onChange={(e) => setImportance(e.target.value as Importance)}
            >
              {(Object.keys(IMPORTANCE_LABEL) as Importance[]).map((i) => (
                <option key={i} value={i}>
                  중요도: {IMPORTANCE_LABEL[i]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="lc-btn-primary col-span-2 sm:col-span-1"
              onClick={add}
            >
              주차하기
            </button>
          </div>
          <textarea
            className="lc-input min-h-[64px]"
            placeholder="메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
      </SectionCard>

      <SectionCard
        title={`주차된 항목 ${items.filter((p) => !p.done).length}개`}
        subtitle="필요할 때만 오늘 일정으로 옮기세요."
      >
        {items.length === 0 ? (
          <EmptyState
            title="아직 비어있어요"
            description="머릿속에서 자꾸 떠오르는 일이 있다면 여기에 세워두세요."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((p) => (
              <li
                key={p.id}
                className={
                  'lc-card p-4 flex flex-col gap-2 ' +
                  (p.done ? 'opacity-50' : '')
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div
                      className={
                        'text-sm font-medium ' +
                        (p.done ? 'line-through lc-text-soft' : 'lc-text-deep')
                      }
                    >
                      {p.title}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="lc-chip bg-[var(--color-ivory-100)] lc-text-soft">
                        {CATEGORY_LABEL[p.category]}
                      </span>
                      <span className="lc-chip bg-[#e9f0f8] lc-text-blue">
                        중요 {IMPORTANCE_LABEL[p.importance]}
                      </span>
                      {p.movedToToday && (
                        <span className="lc-chip bg-[#e8efe5] text-[var(--color-success)]">
                          오늘로 이동
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] lc-text-soft text-right shrink-0">
                    {new Date(p.createdAt).toLocaleString('ko-KR', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                {p.memo && (
                  <div className="text-xs lc-text-soft whitespace-pre-line">
                    📝 {p.memo}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {!p.done && !p.movedToToday && (
                    <button
                      type="button"
                      className="lc-btn-ghost"
                      onClick={() => moveTo(p)}
                    >
                      오늘로 옮기기
                    </button>
                  )}
                  <button
                    type="button"
                    className="lc-btn-ghost"
                    onClick={() => toggleDone(p.id)}
                  >
                    {p.done ? '되살리기' : '완료'}
                  </button>
                  <button
                    type="button"
                    className="lc-btn-danger"
                    onClick={() => remove(p.id)}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
