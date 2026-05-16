import type { AppData, ChatMessage, ExtractedItems } from '../types';
import { todayISO } from './date';

const MODEL = 'gemini-2.5-flash';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT_BASE = `당신은 "Aide" — 사용자의 따뜻하고 실용적인 개인 비서입니다.
사용자는 두서없이 머릿속에 있는 걸 던지거나, 자신의 데이터에 대해 질문할 수 있습니다.

당신의 역할 두 가지:

A. 머릿속을 받아 정리
- 사용자가 말한 내용에서 todos / purchases / events / notes 추출
- reply에는 1-2문장의 짧고 자연스러운 답 (한국어, 따뜻하되 사무적이지 않게)

B. 데이터에 대해 답하기
- 사용자가 "이번달 얼마 썼어?", "오늘 뭐 해야 해?", "차키 어디 두기로 했더라?" 같이 물으면
- 아래 [현재 데이터]를 보고 정확하게 답변
- 이 경우 extracted는 비워두고 reply만 채움

규칙:
- 추출할 게 없고 질문도 아니면 그냥 짧게 답변
- 항상 한국어로
- 너무 길게 답하지 않기 (2-3문장 이내)
- 사용자를 다그치지 말고 함께하는 톤`;

function summarizeData(data: AppData): string {
  const today = todayISO();
  const now = new Date();

  // 이번 달 구매
  const thisMonthPurchases = data.purchases.filter((p) => {
    if (p.status === 'returned') return false;
    const d = new Date(p.orderDate);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const purchaseTotal = thisMonthPurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  // 진행 중 프로젝트
  const activeProjects = data.projects.filter(
    (p) => !p.completed && p.status !== 'done' && p.status !== 'paused',
  );

  // 작업 주차장 진행 중
  const openParking = data.parking.filter((p) => !p.done).slice(0, 10);

  // 지정석
  const spots = data.spots.slice(0, 10);

  // 이사 진행률
  const moveDone = data.moveChecklist.filter((m) => m.done).length;
  const movePct = data.moveChecklist.length
    ? Math.round((moveDone / data.moveChecklist.length) * 100)
    : 0;

  // 구독 합계
  const subTotal = data.subscriptions
    .filter((s) => s.usage !== 'cancelled')
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  // 오늘 plan
  const plan = data.dailyPlans[today];

  const lines: string[] = [];
  lines.push(`[오늘 날짜] ${today}`);
  lines.push('');

  lines.push(`[이번 달 구매] 합계 ${purchaseTotal.toLocaleString()}원 / ${thisMonthPurchases.length}건`);
  if (thisMonthPurchases.length > 0) {
    thisMonthPurchases.slice(0, 8).forEach((p) => {
      lines.push(`  - ${p.name} (${p.category}) ${(Number(p.amount) || 0).toLocaleString()}원`);
    });
  }
  lines.push('');

  if (activeProjects.length > 0) {
    lines.push(`[진행 중 프로젝트 ${activeProjects.length}]`);
    activeProjects.forEach((p) => {
      lines.push(`  - ${p.name}: 다음 행동 = "${p.nextAction || '미설정'}"`);
    });
    lines.push('');
  }

  if (openParking.length > 0) {
    lines.push(`[열린 할 일 (작업 주차장)]`);
    openParking.forEach((p) => {
      lines.push(`  - ${p.title}`);
    });
    lines.push('');
  }

  if (spots.length > 0) {
    lines.push(`[지정석 (물건이 사는 곳)]`);
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

  if (plan && plan.blocks.length > 0) {
    lines.push(`[오늘 일정]`);
    plan.blocks.forEach((b) => {
      lines.push(`  - ${b.periodLabel}: ${b.action} (${b.status})`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

interface AIResponse {
  reply: string;
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

export async function callAI(
  userMessage: string,
  history: ChatMessage[],
  apiKey: string,
  data: AppData,
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
          extracted: {
            type: 'OBJECT',
            properties: {
              todos: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING' },
                    category: { type: 'STRING' },
                  },
                },
              },
              purchases: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    category: { type: 'STRING' },
                    amount: { type: 'NUMBER' },
                  },
                },
              },
              events: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING' },
                    date: { type: 'STRING' },
                  },
                },
              },
              notes: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
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
    result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"reply":"응답 없음"}';
  try {
    return JSON.parse(text) as AIResponse;
  } catch {
    return { reply: text };
  }
}
