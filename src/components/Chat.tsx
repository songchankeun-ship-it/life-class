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

interface ChatProps {
  data: AppData;
  onAppendMessages: (msgs: ChatMessage[]) => void;
  onAppendEntries: (entries: Entry[]) => void;
  onUpdateEntry: (entry: Entry) => void;
  onDeleteEntry: (id: string) => void;
}

type TabKey = 'all' | EntryCategory;

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'schedule', label: '일정' },
  { key: 'task', label: '할 일' },
  { key: 'sourcing', label: '쇼핑·소싱' },
  { key: 'subscription', label: '구독·결제' },
  { key: 'idea', label: '아이디어' },
  { key: 'memo', label: '메모' },
  { key: 'parking', label: '보류' },
];

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKeyLocal] = useState(getApiKey());
  const [showKeyInput, setShowKeyInput] = useState(!getApiKey());
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [editing, setEditing] = useState<Entry | null>(null);
  const [expandedOriginalId, setExpandedOriginalId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = data.chatMessages;
  const entries = data.entries;

  useEffect(() => {
    if (activeTab === 'all' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, loading, activeTab]);

  const saveKey = () => {
    setApiKey(apiKey.trim());
    setShowKeyInput(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const key = getApiKey();
    if (!key) { setShowKeyInput(true); return; }

    const stamp = new Date().toISOString();
    const userMsgId = 'msg-' + Math.random().toString(36).slice(2, 10);
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text,
      createdAt: stamp,
    };
    onAppendMessages([userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

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
        text: '(AI 응답 실패 — 일단 메모로 저장해뒀어요)',
        entryIds: [fallback.id],
        createdAt: new Date().toISOString(),
      };
      onAppendMessages([failMsg]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (activeTab === 'all') return entries;
    return entries
      .filter((e) => e.category === activeTab && !e.archived)
      .sort((a, b) => {
        if ((a.done ?? false) !== (b.done ?? false)) return a.done ? 1 : -1;
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [entries, activeTab]);

  const timelineItems = useMemo(() => {
    if (activeTab !== 'all') return [];
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
  }, [activeTab, messages, entries]);

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
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 180px)' }}>
      <div className="lc-card p-1.5 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
        {TABS.map((t) => {
          const isActive = t.key === activeTab;
          const count = t.key === 'all'
            ? entries.length
            : entries.filter((e) => e.category === t.key && !e.archived).length;
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-2">
        {activeTab === 'all' && timelineItems.length === 0 && (
          <div className="lc-card p-6 text-center">
            <div className="text-lg font-semibold lc-text-deep mb-2">안녕하세요</div>
            <div className="text-[15px] lc-text-soft leading-[1.75]">
              머릿속에 있는 거 그대로 던지세요.<br />
              "계란쿠커 샀고 토요일 짐 정리해야돼" 같이 막.<br />
              알아서 분류해서 정리해드릴게요.
            </div>
          </div>
        )}

        {activeTab === 'all' && timelineItems.map((item, idx) => {
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
                onEdit={() => setEditing(item.entry)}
                onToggleDone={() => onUpdateEntry({ ...item.entry, done: !item.entry.done, updatedAt: new Date().toISOString() })}
                onDelete={() => { if (confirm('이 항목을 삭제할까요?')) onDeleteEntry(item.entry.id); }}
                expanded={expandedOriginalId === item.entry.id}
                onToggleOriginal={() => setExpandedOriginalId(expandedOriginalId === item.entry.id ? null : item.entry.id)}
              />
            );
          }
        })}

        {activeTab !== 'all' && filteredEntries.length === 0 && (
          <div className="lc-card p-6 text-center">
            <div className="text-sm lc-text-soft">아직 이 카테고리에 정리된 게 없어요.</div>
          </div>
        )}
        {activeTab !== 'all' && filteredEntries.map((e) => (
          <EntryCard
            key={e.id}
            entry={e}
            onEdit={() => setEditing(e)}
            onToggleDone={() => onUpdateEntry({ ...e, done: !e.done, updatedAt: new Date().toISOString() })}
            onDelete={() => { if (confirm('이 항목을 삭제할까요?')) onDeleteEntry(e.id); }}
            expanded={expandedOriginalId === e.id}
            onToggleOriginal={() => setExpandedOriginalId(expandedOriginalId === e.id ? null : e.id)}
          />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="lc-card px-4 py-3">
              <div className="text-sm lc-text-soft">정리 중...</div>
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

      <div className="flex gap-2 sticky bottom-0">
        <textarea
          className="lc-input flex-1"
          placeholder="머릿속에 있는 거 던지세요..."
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          }}
          disabled={loading}
        />
        <button type="button" className="lc-btn-primary" onClick={send} disabled={!input.trim() || loading}>
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

interface EntryCardProps {
  entry: Entry;
  onEdit: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  expanded: boolean;
  onToggleOriginal: () => void;
}

function EntryCard({ entry, onEdit, onToggleDone, onDelete, expanded, onToggleOriginal }: EntryCardProps) {
  const catStyle = CATEGORY_STYLE[entry.category];
  return (
    <div className="lc-card p-4" style={{ opacity: entry.done ? 0.55 : 1 }}>
      <div className="flex items-start gap-2 mb-2">
        <button
          type="button"
          onClick={onToggleDone}
          aria-label={entry.done ? '완료 취소' : '완료'}
          className="mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0"
          style={{
            borderColor: entry.done ? 'var(--color-accent)' : 'var(--color-border)',
            background: entry.done ? 'var(--color-accent)' : 'transparent',
            color: '#fff',
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          {entry.done ? '✓' : ''}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="lc-chip text-[11px]" style={{ background: catStyle.bg, color: catStyle.fg }}>
              {ENTRY_CATEGORY_LABEL[entry.category]}
            </span>
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
          <div
            className="text-[15px] font-semibold lc-text-deep leading-[1.4]"
            style={{ textDecoration: entry.done ? 'line-through' : 'none' }}
          >
            {entry.title}
          </div>
          {(entry.date || entry.time) && (
            <div className="text-[12px] lc-text-soft mt-0.5">
              {entry.date}{entry.time && ' ' + entry.time}
            </div>
          )}
          {entry.amount != null && entry.amount > 0 && (
            <div className="text-[12px] lc-text-soft mt-0.5">
              {entry.amount.toLocaleString()}원
            </div>
          )}
          {entry.summary && (
            <div className="text-[13px] lc-text-soft leading-[1.55] mt-1.5">{entry.summary}</div>
          )}
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.tags.map((t, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-bg-soft)] lc-text-soft">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-[var(--color-border-soft)]">
          <div className="text-[11px] lc-text-mute mb-1">원문</div>
          <div className="text-[13px] lc-text-soft whitespace-pre-line leading-[1.55]">{entry.originalText}</div>
        </div>
      )}

      <div className="flex items-center gap-3 mt-3 text-[12px]">
        <button type="button" onClick={onToggleOriginal} className="lc-text-blue">
          {expanded ? '원문 닫기' : '원문 보기'}
        </button>
        <button type="button" onClick={onEdit} className="lc-text-soft">수정</button>
        <button type="button" onClick={onDelete} className="text-[var(--color-danger)] ml-auto">삭제</button>
      </div>
    </div>
  );
}

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
