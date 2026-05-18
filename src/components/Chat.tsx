import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppData,
  ChatMessage,
  Entry,
  EntryCategory,
  Priority,
} from '../types';
import { ENTRY_CATEGORY_LABEL, PRIORITY_LABEL } from '../types';
import { callAI, getApiKey, makeFallbackEntry, setApiKey } from '../utils/ai';
import { SectionCard } from './SectionCard';
import { dDayLabel, todayISO } from '../utils/date';
import { moveInfo } from '../data/defaultData';

interface ChatProps {
  data: AppData;
  onAppendMessages: (msgs: ChatMessage[]) => void;
  onAppendEntries: (entries: Entry[]) => void;
  onUpdateEntry: (entry: Entry) => void;
  onDeleteEntry: (id: string) => void;
}

// 5개로 축소된 탭 키
type TabKey = 'all' | 'schedule' | 'task' | 'sourcing' | 'other';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'schedule', label: '일정' },
  { key: 'task', label: '할 일' },
  { key: 'sourcing', label: '쇼핑' },
  { key: 'other', label: '그 외' },
];

// 어떤 EntryCategory 가 어떤 탭에 속하는지
const TAB_OF_CATEGORY: Record<EntryCategory, TabKey> = {
  schedule: 'schedule',
  task: 'task',
  sourcing: 'sourcing',
  subscription: 'other',
  idea: 'other',
  memo: 'other',
  parking: 'other',
  review: 'other',
};

const CATEGORY_STYLE: Record<EntryCategory, { bg: string; fg: string }> = {
  schedule: { bg: '#eef1fb', fg: '#3a5bbf' },
  task: { bg: '#ecf2eb', fg: '#456a45' },
  sourcing: { bg: '#f7ede4', fg: '#a35c3f' },
  subscription: { bg: '#f5e8e8', fg: '#94484a' },
  idea: { bg: '#f0eaf7', fg: '#664a8a' },
  memo: { bg: '#f3f1ea', fg: '#6b6862' },
  parking: { bg: '#ece9e2', fg: '#5a564e' },
  review: { bg: '#eaf2f5', fg: '#3a6171' },
};

const PRIORITY_DOT: Record<Priority, string> = {
  low: '#b8b6af',
  medium: '#c47a5b',
  high: '#b76a6a',
};

export function Chat({
  data,
  onAppendMessages,
  onAppendEntries,
  onUpdateEntry,
  onDeleteEntry,
}: ChatProps) {
  const [input, setInput] = useState('');
  const [inflight, setInflight] = useState(0); // 동시 진행 중인 AI 호출 수
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKeyLocal] = useState(getApiKey());
  const [showKeyInput, setShowKeyInput] = useState(!getApiKey());
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [editing, setEditing] = useState<Entry | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryMenuId, setCategoryMenuId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = data.chatMessages;
  const entries = data.entries;

  // 입력창 자동 높이 조절
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [input]);

  useEffect(() => {
    if (activeTab === 'all' && scrollRef.current && !searchQuery) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, inflight, activeTab, searchQuery]);

  const saveKey = () => {
    setApiKey(apiKey.trim());
    setShowKeyInput(false);
  };

  // 낙관적 UI — 메시지 즉시 추가, AI 호출은 백그라운드
  const send = () => {
    const text = input.trim();
    if (!text) return;
    const key = getApiKey();
    if (!key) { setShowKeyInput(true); return; }

    const stamp = new Date().toISOString();
    const userMsgId = 'msg-' + Math.random().toString(36).slice(2, 10);
    const userMsg: ChatMessage = { id: userMsgId, role: 'user', text, createdAt: stamp };
    onAppendMessages([userMsg]);
    setInput('');
    setError(null);
    setInflight((n) => n + 1);

    (async () => {
      try {
        const res = await callAI(text, messages, key, data, userMsgId);
        const aiMsgId = 'msg-' + Math.random().toString(36).slice(2, 10);
        const aiMsg: ChatMessage = {
          id: aiMsgId,
          role: 'assistant',
          text: res.reply,
          entryIds: res.entries.map((e) => e.id),
          createdAt: new Date().toISOString(),
        };
        onAppendMessages([aiMsg]);
        if (res.entries.length > 0) onAppendEntries(res.entries);
      } catch (err) {
        const fallback = makeFallbackEntry(text, userMsgId);
        onAppendEntries([fallback]);
        const failMsg: ChatMessage = {
          id: 'msg-' + Math.random().toString(36).slice(2, 10),
          role: 'assistant',
          text: '(잠깐 정신이 없네요. 일단 메모로 저장해뒀어요)',
          entryIds: [fallback.id],
          createdAt: new Date().toISOString(),
        };
        onAppendMessages([failMsg]);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setInflight((n) => Math.max(0, n - 1));
      }
    })();
  };

  const q = searchQuery.trim().toLowerCase();
  const matchesQuery = (e: Entry) => {
    if (!q) return true;
    return (
      e.title.toLowerCase().includes(q) ||
      (e.summary?.toLowerCase().includes(q) ?? false) ||
      (e.originalText?.toLowerCase().includes(q) ?? false) ||
      (e.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
    );
  };

  const entryInTab = (e: Entry, tab: TabKey) => {
    if (tab === 'all') return true;
    return TAB_OF_CATEGORY[e.category] === tab;
  };

  const filteredEntries = useMemo(() => {
    if (activeTab === 'all') {
      if (q) return entries.filter((e) => !e.archived && matchesQuery(e));
      return entries;
    }
    return entries
      .filter((e) => entryInTab(e, activeTab) && !e.archived && matchesQuery(e))
      .sort((a, b) => {
        if ((a.done ?? false) !== (b.done ?? false)) return a.done ? 1 : -1;
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, activeTab, q]);

  const timelineItems = useMemo(() => {
    if (activeTab !== 'all') return [];
    if (q) return [];
    type Item =
      | { kind: 'msg'; msg: ChatMessage }
      | { kind: 'entry'; entry: Entry };
    const items: Item[] = [];
    messages.forEach((m) => {
      items.push({ kind: 'msg', msg: m });
      if (m.role === 'assistant' && m.entryIds && m.entryIds.length > 0) {
        m.entryIds.forEach((eid) => {
          const e = entries.find((x) => x.id === eid);
          if (e) items.push({ kind: 'entry', entry: e });
        });
      }
    });
    return items;
  }, [activeTab, messages, entries, q]);

  const handleCategoryChange = (entry: Entry, newCat: EntryCategory) => {
    onUpdateEntry({ ...entry, category: newCat, updatedAt: new Date().toISOString() });
    setCategoryMenuId(null);
  };

  // Stat banner 데이터
  const today = todayISO();
  const purchaseTotal = useMemo(() => {
    const now = new Date();
    return data.purchases
      .filter((p) => {
        if (p.status === 'returned') return false;
        const d = new Date(p.orderDate);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [data.purchases]);
  const subsTotal = useMemo(
    () =>
      data.subscriptions
        .filter((s) => s.usage !== 'cancelled')
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [data.subscriptions],
  );
  const todayAlerts = useMemo(
    () => entries.filter((e) => !e.done && !e.archived && e.date === today).length,
    [entries, today],
  );

  // 카테고리 카운트 (탭 배지)
  const tabCounts = useMemo(() => {
    const m: Record<TabKey, number> = { all: 0, schedule: 0, task: 0, sourcing: 0, other: 0 };
    entries.forEach((e) => {
      if (e.archived) return;
      m.all += 1;
      const t = TAB_OF_CATEGORY[e.category];
      m[t] = (m[t] ?? 0) + 1;
    });
    return m;
  }, [entries]);

  if (showKeyInput) {
    return (
      <SectionCard
        title="AI 비서 시작하기"
        subtitle="Gemini API 키를 한 번만 입력하면 이 폰에 저장돼요."
      >
        <p className="text-sm lc-text-soft mb-3 leading-relaxed">
          1. https://aistudio.google.com/apikey 에서 키 발급 (무료)<br />
          2. 아래에 붙여넣고 저장
        </p>
        <input
          className="lc-input"
          type="password"
          placeholder="AIza..."
          value={apiKey}
          onChange={(e) => setApiKeyLocal(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="lc-btn-primary" onClick={saveKey} disabled={!apiKey.trim()}>
            저장
          </button>
        </div>
        <p className="text-[11px] lc-text-mute mt-3">
          키는 이 폰의 브라우저에만 저장되고 어디로도 전송되지 않습니다.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-2.5" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Stat 배너 한 줄 */}
      <div className="lc-card px-3 py-2 flex items-center gap-3 overflow-x-auto whitespace-nowrap text-[12px]">
        <BannerStat label="이사 반출" value={dDayLabel(moveInfo.oldOutDate)} />
        <BannerDivider />
        <BannerStat label="이사 입주" value={dDayLabel(moveInfo.newInDate)} />
        <BannerDivider />
        <BannerStat label="이번달 구매" value={(purchaseTotal / 10000).toFixed(0) + '만원'} />
        <BannerDivider />
        <BannerStat label="월 구독" value={(subsTotal / 10000).toFixed(0) + '만원'} />
        {todayAlerts > 0 && (
          <>
            <BannerDivider />
            <BannerStat label="오늘 알림" value={todayAlerts + '건'} highlight />
          </>
        )}
      </div>

      {/* 카테고리 탭바 + 검색 아이콘 */}
      <div className="flex items-center gap-2">
        <div className="lc-card p-1 flex items-center gap-0.5 flex-1 overflow-x-auto whitespace-nowrap">
          {TABS.map((t) => {
            const isActive = t.key === activeTab;
            const count = tabCounts[t.key];
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={
                  'px-3 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 ' +
                  (isActive
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'lc-text-soft hover:bg-[var(--color-bg-soft)]')
                }
              >
                {t.label}
                {count > 0 && (
                  <span
                    className={
                      'text-[10px] px-1.5 py-0.5 rounded-full ' +
                      (isActive ? 'bg-white/25 text-white' : 'bg-[var(--color-bg-soft)] lc-text-mute')
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setSearchQuery('');
          }}
          aria-label="검색"
          className={
            'lc-card w-10 h-10 flex items-center justify-center flex-shrink-0 ' +
            (searchOpen || searchQuery ? 'lc-text-blue' : 'lc-text-soft')
          }
        >
          {searchOpen ? '✕' : '🔍'}
        </button>
      </div>

      {searchOpen && (
        <input
          type="text"
          className="lc-input"
          placeholder="제목·내용·태그로 검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pb-2">
        {activeTab === 'all' && !q && timelineItems.length === 0 && (
          <div className="lc-card p-6 text-center">
            <div className="text-lg font-semibold lc-text-deep mb-2">안녕하세요</div>
            <div className="text-[15px] lc-text-soft leading-[1.75]">
              머릿속에 있는 거 그대로 던지세요.<br />
              알아서 분류해서 정리해드릴게요.
            </div>
          </div>
        )}

        {activeTab === 'all' && !q && timelineItems.map((item, idx) => {
          if (item.kind === 'msg') {
            const m = item.msg;
            return (
              <div key={'msg-' + m.id + '-' + idx} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={'max-w-[85%] rounded-[22px] px-5 py-3.5 ' + (m.role === 'user' ? 'bg-[var(--color-accent)] text-white' : 'lc-card')}>
                  <div className="text-[15px] whitespace-pre-line leading-[1.65] font-normal">{m.text}</div>
                </div>
              </div>
            );
          } else {
            return (
              <EntryCard
                key={'entry-' + item.entry.id + '-' + idx}
                entry={item.entry}
                expanded={expandedId === item.entry.id}
                onToggleExpand={() => setExpandedId(expandedId === item.entry.id ? null : item.entry.id)}
                onToggleDone={() => onUpdateEntry({ ...item.entry, done: !item.entry.done, updatedAt: new Date().toISOString() })}
                onEdit={() => setEditing(item.entry)}
                onDelete={() => { if (confirm('이 항목을 삭제할까요?')) onDeleteEntry(item.entry.id); }}
                categoryMenuOpen={categoryMenuId === item.entry.id}
                onToggleCategoryMenu={() => setCategoryMenuId(categoryMenuId === item.entry.id ? null : item.entry.id)}
                onChangeCategory={(c) => handleCategoryChange(item.entry, c)}
              />
            );
          }
        })}

        {(activeTab !== 'all' || q) && filteredEntries.length === 0 && (
          <div className="lc-card p-6 text-center">
            <div className="text-sm lc-text-soft">
              {q ? '검색 결과가 없어요.' : '아직 이 카테고리에 정리된 게 없어요.'}
            </div>
          </div>
        )}
        {(activeTab !== 'all' || q) && filteredEntries.map((e) => (
          <EntryCard
            key={e.id}
            entry={e}
            expanded={expandedId === e.id}
            onToggleExpand={() => setExpandedId(expandedId === e.id ? null : e.id)}
            onToggleDone={() => onUpdateEntry({ ...e, done: !e.done, updatedAt: new Date().toISOString() })}
            onEdit={() => setEditing(e)}
            onDelete={() => { if (confirm('이 항목을 삭제할까요?')) onDeleteEntry(e.id); }}
            categoryMenuOpen={categoryMenuId === e.id}
            onToggleCategoryMenu={() => setCategoryMenuId(categoryMenuId === e.id ? null : e.id)}
            onChangeCategory={(c) => handleCategoryChange(e, c)}
          />
        ))}

        {inflight > 0 && (
          <div className="flex justify-start">
            <div className="lc-card px-4 py-2.5">
              <div className="text-[12px] lc-text-soft">
                정리 중{inflight > 1 ? ` (${inflight})` : ''}...
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="lc-card p-3 border-l-4 border-[var(--color-danger)] bg-[var(--color-danger-soft)]">
            <div className="text-xs text-[var(--color-danger)] font-medium">AI 오류</div>
            <div className="text-xs lc-text-deep mt-1 break-words">{error}</div>
            <button type="button" className="text-[11px] lc-text-blue mt-2 underline" onClick={() => setShowKeyInput(true)}>
              API 키 다시 입력
            </button>
          </div>
        )}
      </div>

      {/* 입력창 — 1줄 시작, 자동 확장 */}
      <div className="flex gap-2 items-end sticky bottom-0">
        <textarea
          ref={inputRef}
          className="lc-input flex-1 resize-none"
          placeholder="머릿속에 있는 거 던지세요..."
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          style={{ minHeight: 52, maxHeight: 140 }}
        />
        <button
          type="button"
          className="lc-btn-primary"
          onClick={send}
          disabled={!input.trim()}
        >
          보내기
        </button>
      </div>

      {editing && (
        <EditEntryModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={(e) => { onUpdateEntry(e); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Stat banner 헬퍼
// ============================================================
function BannerStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col flex-shrink-0">
      <span className="text-[10px] lc-text-mute leading-tight">{label}</span>
      <span
        className={
          'text-[13px] font-semibold leading-tight ' +
          (highlight ? 'text-[var(--color-warm)]' : 'lc-text-deep')
        }
      >
        {value}
      </span>
    </div>
  );
}
function BannerDivider() {
  return <div className="w-px h-7 bg-[var(--color-border)] flex-shrink-0" />;
}

// ============================================================
// Entry 카드 (미니멀: 한 줄 → 펼치면 상세)
// ============================================================
interface EntryCardProps {
  entry: Entry;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  categoryMenuOpen: boolean;
  onToggleCategoryMenu: () => void;
  onChangeCategory: (c: EntryCategory) => void;
}

function EntryCard({
  entry,
  expanded,
  onToggleExpand,
  onToggleDone,
  onEdit,
  onDelete,
  categoryMenuOpen,
  onToggleCategoryMenu,
  onChangeCategory,
}: EntryCardProps) {
  const catStyle = CATEGORY_STYLE[entry.category];
  const dateTimeText = entry.date
    ? entry.date + (entry.time ? ' ' + entry.time : '')
    : entry.time ?? null;

  return (
    <div className="lc-card" style={{ opacity: entry.done ? 0.55 : 1 }}>
      <button
        type="button"
        className="w-full flex items-center gap-2.5 p-3 text-left"
        onClick={onToggleExpand}
      >
        <span
          role="button"
          aria-label={entry.done ? '완료 취소' : '완료'}
          onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
          className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 cursor-pointer"
          style={{
            borderColor: entry.done ? 'var(--color-accent)' : 'var(--color-border)',
            background: entry.done ? 'var(--color-accent)' : 'transparent',
            color: '#fff',
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          {entry.done ? '✓' : ''}
        </span>
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: catStyle.fg }}
          title={ENTRY_CATEGORY_LABEL[entry.category]}
        />
        <span
          className="text-[14px] lc-text-deep flex-1 min-w-0 truncate"
          style={{ textDecoration: entry.done ? 'line-through' : 'none' }}
        >
          {entry.title}
        </span>
        {entry.priority === 'high' && (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: PRIORITY_DOT.high }}
            title="높음"
          />
        )}
        {dateTimeText && (
          <span className="text-[11px] lc-text-mute flex-shrink-0 ml-1">
            {dateTimeText}
          </span>
        )}
        <span className="text-[10px] lc-text-mute flex-shrink-0">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--color-border-soft)] space-y-2">
          <div className="flex items-center gap-2 flex-wrap relative">
            <button
              type="button"
              onClick={onToggleCategoryMenu}
              className="lc-chip text-[11px] inline-flex items-center gap-1"
              style={{ background: catStyle.bg, color: catStyle.fg }}
              aria-label="카테고리 변경"
            >
              {ENTRY_CATEGORY_LABEL[entry.category]}
              <span className="text-[9px] opacity-60">▾</span>
            </button>
            {categoryMenuOpen && (
              <div className="absolute z-10 top-full left-0 mt-1 bg-white border border-[var(--color-border)] rounded-xl shadow-lg p-1 flex flex-col min-w-[140px]">
                {(Object.keys(ENTRY_CATEGORY_LABEL) as EntryCategory[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChangeCategory(c)}
                    className={
                      'text-left text-[12px] px-3 py-1.5 rounded-lg ' +
                      (c === entry.category
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold'
                        : 'lc-text-deep hover:bg-[var(--color-bg-soft)]')
                    }
                  >
                    {ENTRY_CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
            )}
            {entry.priority && entry.priority !== 'medium' && (
              <span className="inline-flex items-center gap-1 text-[11px] lc-text-mute">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_DOT[entry.priority] }} />
                {PRIORITY_LABEL[entry.priority]}
              </span>
            )}
            {entry.needsReminder && (
              <span className="text-[11px] lc-text-mute">알림</span>
            )}
          </div>

          {entry.amount != null && entry.amount > 0 && (
            <div className="text-[12px] lc-text-soft">{entry.amount.toLocaleString()}원</div>
          )}

          {entry.summary && (
            <div className="text-[13px] lc-text-soft leading-[1.55]">{entry.summary}</div>
          )}

          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.tags.map((t, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-bg-soft)] lc-text-soft">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {entry.originalText && entry.originalText !== entry.title && (
            <div className="pt-1.5">
              <div className="text-[10px] lc-text-mute mb-1">원문</div>
              <div className="text-[12px] lc-text-soft whitespace-pre-line leading-[1.5]">
                {entry.originalText}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1 text-[12px]">
            <button type="button" onClick={onEdit} className="lc-text-blue">수정</button>
            <button type="button" onClick={onDelete} className="text-[var(--color-danger)] ml-auto">삭제</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 편집 모달
// ============================================================
interface EditModalProps {
  entry: Entry;
  onClose: () => void;
  onSave: (e: Entry) => void;
}

function EditEntryModal({ entry, onClose, onSave }: EditModalProps) {
  const [title, setTitle] = useState(entry.title);
  const [category, setCategory] = useState<EntryCategory>(entry.category);
  const [date, setDate] = useState(entry.date ?? '');
  const [time, setTime] = useState(entry.time ?? '');
  const [priority, setPriority] = useState<Priority>(entry.priority ?? 'medium');
  const [summary, setSummary] = useState(entry.summary ?? '');
  const [amount, setAmount] = useState<string>(entry.amount != null ? String(entry.amount) : '');
  const [done, setDone] = useState<boolean>(entry.done ?? false);
  const [tagsText, setTagsText] = useState((entry.tags ?? []).join(', '));

  const handleSave = () => {
    const tags = tagsText.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    const cleaned: Entry = {
      ...entry,
      title: title.trim() || entry.title,
      category,
      date: date || undefined,
      time: time || undefined,
      priority,
      summary: summary.trim() || undefined,
      amount: amount.trim() ? Number(amount) : undefined,
      tags: tags.length > 0 ? tags : undefined,
      done,
      updatedAt: new Date().toISOString(),
    };
    onSave(cleaned);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-[var(--color-border)] shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-[var(--color-border-soft)]">
          <div className="text-base font-semibold lc-text-deep">항목 수정</div>
        </div>
        <div className="p-5 space-y-3">
          <label className="block">
            <span className="lc-section-title">제목</span>
            <input className="lc-input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block">
            <span className="lc-section-title">카테고리</span>
            <select className="lc-input mt-1" value={category} onChange={(e) => setCategory(e.target.value as EntryCategory)}>
              {(Object.keys(ENTRY_CATEGORY_LABEL) as EntryCategory[]).map((k) => (
                <option key={k} value={k}>{ENTRY_CATEGORY_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="lc-section-title">날짜</span>
              <input type="date" className="lc-input mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="lc-section-title">시간</span>
              <input type="time" className="lc-input mt-1" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="lc-section-title">우선순위</span>
            <select className="lc-input mt-1" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
            </select>
          </label>
          {(category === 'sourcing' || category === 'subscription') && (
            <label className="block">
              <span className="lc-section-title">금액</span>
              <input type="number" inputMode="numeric" className="lc-input mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </label>
          )}
          <label className="block">
            <span className="lc-section-title">메모 / 요약</span>
            <textarea className="lc-input mt-1" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </label>
          <label className="block">
            <span className="lc-section-title">태그 (쉼표 구분)</span>
            <input className="lc-input mt-1" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="예: 운동, 아침루틴" />
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm lc-text-deep">완료됨</span>
          </label>
        </div>
        <div className="px-5 py-4 border-t border-[var(--color-border-soft)] flex gap-2 justify-end">
          <button type="button" className="lc-btn-ghost" onClick={onClose}>취소</button>
          <button type="button" className="lc-btn-primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
