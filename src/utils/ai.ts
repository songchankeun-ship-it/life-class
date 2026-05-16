import type {
  AppData,
  ChatMessage,
  Entry,
  EntryCategory,
  ExtractedItems,
  Priority,
} from '../types';
import { todayISO } from './date';

const MODEL = 'gemini-2.5-flash';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const VALID_CATEGORIES: EntryCategory[] = [
  'schedule', 'task', 'sourcing', 'subscription',
  'idea', 'memo', 'parking', 'review',
];

const VALID_PRIORITIES: Priority[] = ['low', 'medium', 'high'];

const SYSTEM_PROMPT_BASE = `당신은 "Aide" — 사용자의 따뜻하고 실용적인 개인 비서입니다.
사용자가 채팅에 두서없이 던지는 머릿속 내용을 구조화된 항목(Entry)으로 정리하는 게 핵심 역할입니다.

# 응답 규칙
항상 JSON으로 응답하며, 반드시 다음 구조를 따릅니다:
{
  "reply": "사용자에게 보여줄 짧고 자연스러운 한국어 답변(1-2문장, 따뜻한 톤, 다그치지 않기)",
  "entries": [Entry, ...]
}

# Entry 필드
- originalText: 사용자가 채팅에 입력한 원문 (필수)
- title: 한 줄 제목 (필수, 짧고 명확)
- summary: 1-2문장 요약 (선택)
- category: 다음 중 하나 (필수)
    * "schedule"     — 일정 (시간/날짜 있는 약속, 이벤트, 미팅, 데이트)
    * "task"         — 할 일 (해야 할 액션. 청소, 연락, 마감, 운동 등)
    * "sourcing"     — 쇼핑 / 소싱 / 구매 / 주문 / 도착 예정
    * "subscription" — 구독, 자동결제, 정기결제, 해지
    * "idea"         — 아이디어, 떠오른 생각, 기획
    * "memo"         — 단순 메모, 분류 애매한 경우, 감정/상태 기록
    * "parking"      — 보류 / 나중에 결정할 일
    * "review"       — 회고, 오늘 어땠는지, 정산
- date: YYYY-MM-DD (선택). "내일/이번주 토요일" 같은 표현은 [오늘 날짜] 기준으로 절대 날짜로 변환
- time: HH:MM (24시간제, 선택)
- priority: "low" | "medium" | "high" (선택, 기본 medium)
- amount: 금액 숫자 (선택)
- tags: 키워드 배열 (선택, 2-5개)
- needsReminder: true/false (선택)

# 분류 가이드
- "내일 9시에 운동" → schedule, date=내일, time=09:00, needsReminder=true
- "이번주 토요일 짐 정리" → task, date=토요일, priority=high
- "계란쿠커 샀어" → sourcing
- "유튜브 프리미엄 결제됨" → subscription
- "AI 트레이딩 백테스트 아이디어" → idea
- "오늘 좀 피곤하다" → memo
- "이거 좀 미뤄야겠다" → parking
- "오늘 잘한 거 / 못한 거" → review

# 추가 규칙
- 한 문장에 여러 항목 섞이면 분리해서 여러 entry로
- 분류 애매하면 무조건 memo
- 데이터 질문("이번달 얼마 썼어?")은 entries=[], reply만
- 항상 한국어`;

function summarizeData(data: AppData): string {
  const today = todayISO();
  const now = new Date();
  const thisMonthPurchases = data.purchases.filter((p) => {
    if (p.status === 'returned') return false;
    const d = new Date(p.orderDate);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const purchaseTotal = thisMonthPurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const recentEntries = data.entries.slice(-20);
  const entriesByCat: Record<string, number> = {};
  recentEntries.forEach((e) => {
    entriesByCat[e.category] = (entriesByCat[e.category] ?? 0) + 1;
  });
  const activeProjects = data.projects.filter(
    (p) => !p.completed && p.status !== 'done' && p.status !== 'paused',
  );
  const openParking = data.parking.filter((p) => !p.done).slice(0, 10);
  const spots = data.spots.slice(0, 10);
  const moveDone = data.moveChecklist.filter((m) => m.done).length;
  const movePct = data.moveChecklist.length
    ? Math.round((moveDone / data.moveChecklist.length) * 100)
    : 0;
  const subTotal = data.subscriptions
    .filter((s) => s.usage !== 'cancelled')
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const lines: string[] = [];
  lines.push(`[오늘 날짜] ${today}`);
  lines.push('');
  lines.push(`[이번 달 구매] 합계 ${purchaseTotal.toLocaleString()}원 / ${thisMonthPurchases.length}건`);
  thisMonthPurchases.slice(0, 6).forEach((p) => {
    lines.push(`  - ${p.name} (${p.category}) ${(Number(p.amount) || 0).toLocaleString()}원`);
  });
  lines.push('');
  if (recentEntries.length > 0) {
    lines.push(`[최근 정리된 항목 ${recentEntries.length}개]`);
    Object.entries(entriesByCat).forEach(([cat, n]) => {
      lines.push(`  - ${cat}: ${n}개`);
    });
    lines.push('');
    lines.push('  최근 5개:');
    recentEntries.slice(-5).forEach((e) => {
      lines.push(`  · [${e.category}] ${e.title}${e.date ? ' / ' + e.date : ''}`);
    });
    lines.push('');
  }
  if (activeProjects.length > 0) {
    lines.push(`[진행 중 프로젝트]`);
    activeProjects.forEach((p) => {
      lines.push(`  - ${p.name}: 다음 행동 = "${p.nextAction || '미설정'}"`);
    });
    lines.push('');
  }
  if (openParking.length > 0) {
    lines.push(`[열린 할 일 (작업 주차장)]`);
    openParking.forEach((p) => { lines.push(`  - ${p.title}`); });
    lines.push('');
  }
  if (spots.length > 0) {
    lines.push(`[지정석]`);
    spots.forEach((s) => {
      const parts = [];
      if (s.homeSpot) parts.push('집:' + s.homeSpot);
      if (s.carSpot) parts.push('차:' + s.carSpot);
      lines.push(`  - ${s.name} → ${parts.join(' / ')}`);
    });
    lines.push('');
  }
  if (data.moveChecklist.length > 0) {
    lines.push(`[이사 진행률] ${movePct}% (${moveDone}/${data.moveChecklist.length})`);
    lines.push('');
  }
  if (data.subscriptions.length > 0) {
    lines.push(`[월 구독비 합계] ${subTotal.toLocaleString()}원`);
    lines.push('');
  }
  return lines.join('\n');
}

interface RawEntry {
  originalText?: string;
  title?: string;
  summary?: string;
  category?: string;
  type?: string;
  date?: string;
  time?: string;
  priority?: string;
  amount?: number;
  tags?: string[];
  needsReminder?: boolean;
}

export interface AIResponse {
  reply: string;
  entries: Entry[];
  /** @deprecated 구버전 호환 */
  extracted?: ExtractedItems;
}

export function getApiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('lifeclass_ai_key') ?? '';
}

export function setApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('lifeclass_ai_key', key);
}

function normalizeEntry(raw: RawEntry, userText: string, messageId: string): Entry {
  const cat = (raw.category ?? 'memo').toLowerCase();
  const category: EntryCategory = (VALID_CATEGORIES as string[]).includes(cat)
    ? (cat as EntryCategory)
    : 'memo';
  const pri = (raw.priority ?? 'medium').toLowerCase();
  const priority: Priority = (VALID_PRIORITIES as string[]).includes(pri)
    ? (pri as Priority)
    : 'medium';
  const stamp = new Date().toISOString();
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string') : undefined;
  return {
    id: 'ent-' + Math.random().toString(36).slice(2, 10),
    originalText: (raw.originalText && raw.originalText.length > 0) ? raw.originalText : userText,
    title: (raw.title && raw.title.trim().length > 0)
      ? raw.title.trim()
      : (userText.slice(0, 30) + (userText.length > 30 ? '...' : '')),
    summary: raw.summary?.trim() || undefined,
    category,
    type: raw.type as Entry['type'] | undefined,
    date: raw.date && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : undefined,
    time: raw.time && /^\d{2}:\d{2}$/.test(raw.time) ? raw.time : undefined,
    priority,
    amount: typeof raw.amount === 'number' ? raw.amount : undefined,
    tags,
    needsReminder: typeof raw.needsReminder === 'boolean' ? raw.needsReminder : undefined,
    done: false,
    messageId,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function makeFallbackEntry(userText: string, messageId: string): Entry {
  const stamp = new Date().toISOString();
  return {
    id: 'ent-' + Math.random().toString(36).slice(2, 10),
    originalText: userText,
    title: userText.slice(0, 30) + (userText.length > 30 ? '...' : ''),
    category: 'memo',
    priority: 'medium',
    done: false,
    messageId,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export async function callAI(
  userMessage: string,
  history: ChatMessage[],
  apiKey: string,
  data: AppData,
  messageId: string,
): Promise<AIResponse> {
  const dataSummary = summarizeData(data);
  const systemPrompt = SYSTEM_PROMPT_BASE + '\n\n[현재 데이터]\n' + dataSummary;
  const recent = history.slice(-8).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));
  const contents = [
    ...recent,
    { role: 'user', parts: [{ text: userMessage }] },
  ];
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          reply: { type: 'STRING' },
          entries: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                originalText: { type: 'STRING' },
                title: { type: 'STRING' },
                summary: { type: 'STRING' },
                category: { type: 'STRING' },
                type: { type: 'STRING' },
                date: { type: 'STRING' },
                time: { type: 'STRING' },
                priority: { type: 'STRING' },
                amount: { type: 'NUMBER' },
                tags: { type: 'ARRAY', items: { type: 'STRING' } },
                needsReminder: { type: 'BOOLEAN' },
              },
              required: ['title', 'category'],
            },
          },
        },
        required: ['reply'],
      },
    },
  };
  const res = await fetch(`${URL_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI 호출 실패 (${res.status}): ${errText.slice(0, 200)}`);
  }
  const result = await res.json();
  const text =
    result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"reply":"응답 없음","entries":[]}';
  let parsed: { reply?: string; entries?: RawEntry[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { reply: text, entries: [makeFallbackEntry(userMessage, messageId)] };
  }
  const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const entries = rawEntries.map((r) => normalizeEntry(r, userMessage, messageId));
  return {
    reply: parsed.reply ?? '응답 없음',
    entries,
  };
}
