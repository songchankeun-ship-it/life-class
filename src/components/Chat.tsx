import { useEffect, useRef, useState } from 'react';
import type {
  AppData,
  ChatMessage,
  ExtractedItems,
  ParkingItem,
  Purchase,
  PurchaseCategory,
  TaskCategory,
} from '../types';
import { callAI, getApiKey, setApiKey } from '../utils/ai';
import { todayISO } from '../utils/date';
import { SectionCard } from './SectionCard';

interface ChatProps {
  data: AppData;
  onAppendMessages: (msgs: ChatMessage[]) => void;
  onAddParking: (items: ParkingItem[]) => void;
  onAddPurchases: (items: Purchase[]) => void;
}

const PURCHASE_CAT_MAP: Record<string, PurchaseCategory> = {
  옷: 'clothes', 의류: 'clothes', 패션: 'clothes',
  음식: 'food', 식료품: 'food', 식품: 'food',
  전자: 'tech', 디지털: 'tech', 가전: 'tech',
  생활: 'home', 주방: 'home', 가구: 'home',
  뷰티: 'beauty', 화장품: 'beauty', 스킨케어: 'beauty',
  취미: 'hobby', 게임: 'hobby',
};

const TODO_CAT_MAP: Record<string, TaskCategory> = {
  이사: 'move', 마감: 'move',
  돈: 'money', 구독: 'money', 결제: 'money',
  업무: 'work', 스토어: 'work', 일: 'work',
  트레이딩: 'trading',
  커플앱: 'couple', 데이트: 'couple', 관계: 'couple',
  생활: 'life', 운동: 'life', 몸: 'life', 청소: 'life',
  프로젝트: 'project',
};

function mapPurchaseCat(label?: string): PurchaseCategory {
  if (!label) return 'etc';
  for (const k of Object.keys(PURCHASE_CAT_MAP)) {
    if (label.includes(k)) return PURCHASE_CAT_MAP[k];
  }
  return 'etc';
}

function mapTodoCat(label?: string): TaskCategory {
  if (!label) return 'etc';
  for (const k of Object.keys(TODO_CAT_MAP)) {
    if (label.includes(k)) return TODO_CAT_MAP[k];
  }
  return 'etc';
}

export function Chat({ data, onAppendMessages, onAddParking, onAddPurchases }: ChatProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKeyLocal] = useState(getApiKey());
  const [showKeyInput, setShowKeyInput] = useState(!getApiKey());
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = data.chatMessages;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, loading]);

  const saveKey = () => {
    setApiKey(apiKey.trim());
    setShowKeyInput(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const key = getApiKey();
    if (!key) {
      setShowKeyInput(true);
      return;
    }

    const stamp = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: 'msg-' + Math.random().toString(36).slice(2, 10),
      role: 'user',
      text,
      createdAt: stamp,
    };

    onAppendMessages([userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await callAI(text, messages, key, data);

      const aiMsg: ChatMessage = {
        id: 'msg-' + Math.random().toString(36).slice(2, 10),
        role: 'assistant',
        text: res.reply,
        extracted: res.extracted,
        createdAt: new Date().toISOString(),
      };
      onAppendMessages([aiMsg]);

      // 추출된 항목 자동 저장
      const ext = res.extracted;
      if (ext) {
        applyExtracted(ext);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const applyExtracted = (ext: ExtractedItems) => {
    const stamp = new Date().toISOString();
    const today = todayISO();

    const parkings: ParkingItem[] = [];
    if (ext.todos && ext.todos.length > 0) {
      ext.todos.forEach((t) => {
        parkings.push({
          id: 'park-' + Math.random().toString(36).slice(2, 10),
          title: t.title,
          category: mapTodoCat(t.category),
          importance: 'mid',
          memo: 'AI 비서가 추출',
          createdAt: stamp,
        });
      });
    }
    if (ext.events && ext.events.length > 0) {
      ext.events.forEach((e) => {
        const dateNote = e.date ? `[${e.date}] ` : '';
        parkings.push({
          id: 'park-' + Math.random().toString(36).slice(2, 10),
          title: dateNote + e.title,
          category: 'etc',
          importance: 'mid',
          memo: 'AI 비서가 추출 (이벤트)',
          createdAt: stamp,
        });
      });
    }
    if (parkings.length > 0) onAddParking(parkings);

    if (ext.purchases && ext.purchases.length > 0) {
      const purchases: Purchase[] = ext.purchases.map((p) => ({
        id: 'pur-' + Math.random().toString(36).slice(2, 10),
        name: p.name,
        store: '',
        amount: Number(p.amount) || 0,
        category: mapPurchaseCat(p.category),
        orderDate: today,
        status: 'ordered',
        memo: 'AI 비서가 추출',
        createdAt: stamp,
        updatedAt: stamp,
      }));
      onAddPurchases(purchases);
    }
  };

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
          <button
            type="button"
            className="lc-btn-primary"
            onClick={saveKey}
            disabled={!apiKey.trim()}
          >
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
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 200px)' }}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pb-2"
      >
        {messages.length === 0 && (
          <div className="lc-card p-5 text-center">
            <div className="text-base font-medium lc-text-deep mb-1">안녕하세요</div>
            <div className="text-sm lc-text-soft leading-relaxed">
              머릿속에 있는 거 그대로 던지세요.<br />
              "오늘 계란쿠커 샀고 토요일 짐 정리해야돼" 같이.<br />
              알아서 분류해서 정리해드릴게요.
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={
                'max-w-[85%] rounded-2xl px-4 py-3 ' +
                (m.role === 'user'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'lc-card')
              }
            >
              <div className="text-sm whitespace-pre-line leading-relaxed">{m.text}</div>
              {m.extracted && hasItems(m.extracted) && (
                <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.2)] flex flex-wrap gap-1.5">
                  {(m.extracted.todos?.length ?? 0) > 0 && (
                    <span className="lc-chip bg-white/20 text-white text-[11px]">
                      할 일 {m.extracted.todos!.length}
                    </span>
                  )}
                  {(m.extracted.purchases?.length ?? 0) > 0 && (
                    <span className="lc-chip bg-white/20 text-white text-[11px]">
                      구매 {m.extracted.purchases!.length}
                    </span>
                  )}
                  {(m.extracted.events?.length ?? 0) > 0 && (
                    <span className="lc-chip bg-white/20 text-white text-[11px]">
                      이벤트 {m.extracted.events!.length}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="lc-card px-4 py-3">
              <div className="text-sm lc-text-soft">생각 중...</div>
            </div>
          </div>
        )}

        {error && (
          <div className="lc-card p-3 border-l-4 border-[var(--color-danger)] bg-[var(--color-danger-soft)]">
            <div className="text-xs text-[var(--color-danger)] font-medium">에러</div>
            <div className="text-xs lc-text-deep mt-1">{error}</div>
            <button
              type="button"
              className="text-[11px] lc-text-blue mt-2 underline"
              onClick={() => setShowKeyInput(true)}
            >
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
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          disabled={loading}
        />
        <button
          type="button"
          className="lc-btn-primary"
          onClick={send}
          disabled={!input.trim() || loading}
        >
          보내기
        </button>
      </div>
    </div>
  );
}

function hasItems(ext: ExtractedItems): boolean {
  return (
    (ext.todos?.length ?? 0) > 0 ||
    (ext.purchases?.length ?? 0) > 0 ||
    (ext.events?.length ?? 0) > 0 ||
    (ext.notes?.length ?? 0) > 0
  );
}
