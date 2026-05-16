import type { ChatMessage, ExtractedItems } from '../types';

const MODEL = 'gemini-2.5-flash';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = `당신은 사용자의 따뜻하고 실용적인 개인 비서입니다. 사용자는 두서없이 머릿속에 있는 걸 던질 거예요. 당신의 역할:

1. 사용자가 한 말에서 다음 항목을 추출하세요:
   - todos: 해야 할 일 (예: "토요일에 짐 정리", "전입신고")
   - purchases: 산 것 / 살 것 (예: "계란쿠커", "넷플릭스 구독")
   - events: 약속/이벤트 (예: "일요일 여친 픽업", "5/31 이사")
   - notes: 감상/생각/메모 (분류 안 되는 것)

2. reply에는 사용자에게 자연스럽고 짧게 답하세요 (1-2문장). 정리한 결과 요약 + 가끔 따뜻한 한 마디.

3. 추출할 게 없으면 빈 배열로 두고, 그냥 대화 답변만 reply에 넣으세요.

4. 한국어로 답하고, 너무 사무적이지 않게.`;

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
): Promise<AIResponse> {
  const recent = history.slice(-8).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));

  const contents = [
    ...recent,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
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

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"reply":"응답 없음"}';
  try {
    return JSON.parse(text) as AIResponse;
  } catch {
    return { reply: text };
  }
}
