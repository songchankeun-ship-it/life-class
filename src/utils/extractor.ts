// 자유 입력 텍스트 → 구조화된 항목 추출 (rule-based, AI 없이)

export interface ExtractResult {
  todos: string[];
  purchases: string[];
  events: string[];
  notes: string[];
}

const BUY_HINTS = ['샀', '구매', '주문', '시켰', '결제', '결제했', '쟁여', '시킴'];
const TODO_HINTS = ['해야', '하기', '하자', '할거', '할 거', '해얄', '챙기', '챙겨', '정리', '확인', '연락', '전화', '예약', '신청', '제출'];
const EVENT_HINTS = ['약속', '미팅', '저녁', '점심', '브런치', '데이트', '만남', '만나', '여행', '도착', '출발', '픽업', '결혼식', '병원'];

function looksLikePurchase(line: string): boolean {
  const l = line.toLowerCase();
  return BUY_HINTS.some((k) => l.includes(k));
}
function looksLikeTodo(line: string): boolean {
  const l = line.toLowerCase();
  return TODO_HINTS.some((k) => l.includes(k));
}
function looksLikeEvent(line: string): boolean {
  const l = line.toLowerCase();
  return EVENT_HINTS.some((k) => l.includes(k));
}

const PURCHASE_NOUN_RE = /([가-힣A-Za-z0-9·\-_/+]+(?:\s+[가-힣A-Za-z0-9·\-_/+]+)*)\s*(?:샀|구매|주문|시켰|시킴)/;

function extractPurchaseNames(line: string): string[] {
  // "산건 일단. 계란쿠커, 아벤느 스킨, 카시오 사우나시계" 같은 패턴 처리
  // 1) "샀/구매" 앞에 나열된 거 분리
  // 2) "산건" 뒤 콜론/점/구분자 처리
  const cleaned = line
    .replace(/^[\s.,·-]*/, '')
    .replace(/[.!?]+\s*/g, ' ');
  // "산건/샀어/구매" 단어 제거
  const stripped = cleaned
    .replace(/(산\s*건|샀\s*어|구매한\s*거|시킨\s*거|주문한\s*거)/g, '')
    .replace(/(일단|그냥|어제|오늘)/g, '')
    .replace(/[.:]+/g, '')
    .trim();
  // 콤마/슬래시/and 로 분리
  const parts = stripped
    .split(/[,、，\s+그리고\s+|및|/]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 30);
  return parts;
}

export function extract(text: string): ExtractResult {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const todos: string[] = [];
  const purchases: string[] = [];
  const events: string[] = [];
  const notes: string[] = [];

  for (const line of lines) {
    // Bullet/숫자 제거
    const clean = line.replace(/^[-•*+\d.)\s]+/, '').trim();
    if (!clean) continue;

    // 1) 구매 — 우선순위 높게
    if (looksLikePurchase(clean)) {
      const names = extractPurchaseNames(clean);
      if (names.length > 0) {
        purchases.push(...names);
      } else {
        purchases.push(clean);
      }
      continue;
    }

    // 2) 이벤트
    if (looksLikeEvent(clean)) {
      events.push(clean);
      continue;
    }

    // 3) 할 일
    if (looksLikeTodo(clean)) {
      todos.push(clean);
      continue;
    }

    // 4) 기타 메모
    notes.push(clean);
  }

  // dedup
  return {
    todos: [...new Set(todos)],
    purchases: [...new Set(purchases)],
    events: [...new Set(events)],
    notes: [...new Set(notes)],
  };
}
