// =============================================================
// 자동 분류 / 우선순위 / 오늘의 교시 생성 로직 (rule-based)
// =============================================================
import type {
  ClassBlock,
  ClassPeriod,
  Condition,
  DailyCheckIn,
  DailyPlan,
  Importance,
  Project,
  Task,
  TaskCategory,
  TimeAvailability,
  Urgency,
} from '../types';
import { PERIOD_BASE } from '../types';
import { todayISO } from './date';

// ---------- 키워드 사전 ----------
const KEYWORDS: Record<TaskCategory, string[]> = {
  move: [
    '이사', '견적', '계약', '전입', '확정일자', '보관', '사다리차',
    '퇴거', '입주', '업체', '짐', '포장',
  ],
  money: [
    '돈', '카드', '결제', '자동결제', '구독', 'OTT', '넷플릭스', '티빙',
    '웨이브', '디즈니', '유튜브', 'AI툴', '고정비',
  ],
  work: [
    '스마트스토어', '상품', '상품등록', '리뷰', 'CS', '상세페이지',
    '이미지', '배송', '고객', '행사', '매출',
  ],
  trading: [
    '트레이딩', '봇', '매매', '백테스트', '리스크', '손절', '수익',
    '투자', '자동매매',
  ],
  couple: ['커플앱', '여자친구', '비트윈', '데이트', '관계'],
  life: [
    '운동', '방정리', '청소', '쓰레기', '옷', '빨래', '정리',
    '공간', '몸',
  ],
  project: ['프로젝트'],
  etc: [],
};

const URGENCY_HOT_WORDS = [
  '오늘', '마감', '반드시', '예약', '계약', '전화', '확인', '회신',
  '연락', '제출', 'D-Day',
];

const IMPORTANT_CATEGORIES: TaskCategory[] = ['money', 'work', 'trading', 'move'];

// ---------- 분류 ----------
export function classifyCategory(text: string): TaskCategory {
  const lower = text.toLowerCase();
  let bestCat: TaskCategory = 'etc';
  let bestScore = 0;
  (Object.keys(KEYWORDS) as TaskCategory[]).forEach((cat) => {
    let score = 0;
    KEYWORDS[cat].forEach((kw) => {
      if (lower.includes(kw.toLowerCase())) score += 1;
    });
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  });
  return bestCat;
}

// ---------- 우선순위 점수 ----------
export interface ScoredTask {
  text: string;
  category: TaskCategory;
  importance: Importance;
  urgency: Urgency;
  score: number;
  isMustFinish: boolean;
  isMustDo: boolean;
}

const importanceFromCategory = (cat: TaskCategory): Importance =>
  IMPORTANT_CATEGORIES.includes(cat) ? 'high' : cat === 'life' ? 'mid' : 'mid';

const urgencyFromText = (text: string): Urgency => {
  const lower = text.toLowerCase();
  if (URGENCY_HOT_WORDS.some((w) => lower.includes(w.toLowerCase()))) {
    return 'high';
  }
  return 'mid';
};

const importanceScore = (imp: Importance): number =>
  ({ low: 1, mid: 2, high: 3, critical: 4 }[imp]);
const urgencyScore = (urg: Urgency): number =>
  ({ low: 1, mid: 2, high: 3, critical: 4 }[urg]);

export function scoreTexts(
  texts: string[],
  checkIn: DailyCheckIn,
): ScoredTask[] {
  const trimmed = texts.map((t) => t.trim()).filter(Boolean);

  return trimmed.map((text) => {
    const cat = classifyCategory(text);
    let importance = importanceFromCategory(cat);
    let urgency = urgencyFromText(text);

    const isMustFinish =
      !!checkIn.oneToFinish && text === checkIn.oneToFinish.trim();
    const isMustDo =
      !!checkIn.mustDo && text === checkIn.mustDo.trim();

    if (isMustFinish) {
      importance = 'critical';
      urgency = 'high';
    } else if (isMustDo) {
      importance = 'high';
      urgency = 'critical';
    }

    let score = importanceScore(importance) * 2 + urgencyScore(urgency);
    if (cat === 'couple' || cat === 'etc') score -= 1;

    return {
      text,
      category: cat,
      importance,
      urgency,
      score,
      isMustFinish,
      isMustDo,
    };
  });
}

// ---------- 오늘 행동 1개로 정제 ----------
const ACTION_HINTS: Array<{ cat: TaskCategory; replace: (t: string) => string }> = [
  {
    cat: 'trading',
    replace: () => '오늘은 트레이딩 봇 손실 제한 기준 3개만 적기',
  },
  {
    cat: 'move',
    replace: (t) => {
      if (t.includes('이사')) return '이사업체 견적 금액과 포함사항 비교표 한 줄 채우기';
      if (t.includes('짐')) return '버릴 짐 1박스만 만들기';
      return t;
    },
  },
  {
    cat: 'life',
    replace: (t) => {
      if (t.includes('방')) return '쓰레기 1봉투만 만들기';
      if (t.includes('옷')) return '안 입는 옷 5벌만 골라내기';
      return t;
    },
  },
  {
    cat: 'money',
    replace: (t) => {
      if (t.includes('구독')) return '안 쓰는 구독 1개만 해지 클릭';
      return t;
    },
  },
];

export function refineActionLine(text: string, cat: TaskCategory): string {
  const lower = text.toLowerCase();
  // 너무 큰 덩어리(프로젝트명만 있는 경우)면 작은 행동으로 치환
  if (text.length <= 14) {
    const hit = ACTION_HINTS.find((h) => h.cat === cat);
    if (hit) {
      const replaced = hit.replace(text);
      if (replaced !== text) return replaced;
    }
  }
  // "만들기/하기"로 끝나는 너무 모호한 문장은 보정
  if (/^.{1,10}하기$/.test(text) || /^.{1,10}만들기$/.test(text)) {
    if (lower.includes('정리')) return text.replace('정리하기', '정리 1군데만 손대기');
  }
  return text;
}

// ---------- 교시 배정 ----------
const periodForCategory = (cat: TaskCategory): ClassPeriod => {
  if (cat === 'money' || cat === 'trading' || cat === 'work') return 'period1';
  if (cat === 'move') return 'period2';
  if (cat === 'life') return 'period3';
  if (cat === 'couple') return 'optional';
  return 'period2';
};

// ---------- 예상 소요시간 추정 ----------
const estimateMinutes = (cat: TaskCategory, text: string): number => {
  const lower = text.toLowerCase();
  if (lower.includes('전화') || lower.includes('확인') || lower.includes('연락')) {
    return 15;
  }
  if (cat === 'life') return 40;
  if (cat === 'work' || cat === 'project') return 50;
  if (cat === 'trading') return 60;
  if (cat === 'move') return 30;
  if (cat === 'couple') return 30;
  if (cat === 'money') return 20;
  return 30;
};

// ---------- 핵심 교시 결정 ----------
const maxBlocksFor = (
  condition: Condition,
  time: TimeAvailability,
): number => {
  if (condition === 'bad') return 2;
  if (condition === 'good' && time === 'much') return 4; // 선택교시 포함
  return 3;
};

const headlineFor = (
  condition: Condition,
  tooMany: boolean,
): string => {
  if (tooMany) return '오늘은 너무 많이 열려 있어요. 3개만 골라도 충분합니다.';
  if (condition === 'good')
    return '좋아요. 그래도 한 번에 너무 많이 열지 말고, 3교시부터 끝내봅시다.';
  if (condition === 'normal')
    return '오늘은 딱 3개만 제대로 해도 충분합니다.';
  return '오늘은 최소 모드로 갑니다. 무너지지 않는 게 목표예요.';
};

// 프로젝트의 nextAction을 풀에 합쳐서 추천하는 기능
export function collectProjectNextActions(projects: Project[]): string[] {
  return projects
    .filter((p) => !p.completed && p.status !== 'done')
    .map((p) => p.nextAction)
    .filter(Boolean);
}

// ---------- 메인: 오늘의 교시 생성 ----------
export function generateDailyPlan(
  checkIn: DailyCheckIn,
  projects: Project[],
): DailyPlan {
  const rawLines = [
    ...(checkIn.oneToFinish ? [checkIn.oneToFinish] : []),
    ...(checkIn.mustDo ? [checkIn.mustDo] : []),
    ...checkIn.taskList,
    ...collectProjectNextActions(projects),
  ];

  // 중복 제거 (앞에 등장한 것 우선)
  const dedup: string[] = [];
  const seen = new Set<string>();
  rawLines.forEach((l) => {
    const key = l.trim();
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    dedup.push(key);
  });

  const scored = scoreTexts(dedup, checkIn).sort((a, b) => b.score - a.score);

  const maxBlocks = maxBlocksFor(checkIn.condition, checkIn.timeAvailability);
  const tooMany = dedup.length >= 6;

  // 교시별로 1개씩 배정 (같은 교시 두 번 안 들어가게)
  const usedPeriods = new Set<ClassPeriod>();
  const blocks: ClassBlock[] = [];
  const pickedTexts = new Set<string>();

  // 1) 오늘 꼭 끝내고 싶은 일 -> 1교시 강제
  const finishItem = scored.find((s) => s.isMustFinish);
  if (finishItem) {
    blocks.push(buildBlock('period1', finishItem));
    usedPeriods.add('period1');
    pickedTexts.add(finishItem.text);
  }

  // 2) 미루면 안 되는 일 -> 2교시
  const mustItem = scored.find(
    (s) => s.isMustDo && !pickedTexts.has(s.text),
  );
  if (mustItem) {
    const targetPeriod: ClassPeriod = usedPeriods.has('period2') ? 'period1' : 'period2';
    if (!usedPeriods.has(targetPeriod)) {
      blocks.push(buildBlock(targetPeriod, mustItem));
      usedPeriods.add(targetPeriod);
      pickedTexts.add(mustItem.text);
    }
  }

  // 3) 나머지를 카테고리 기반 교시에 배정
  for (const item of scored) {
    if (blocks.length >= maxBlocks) break;
    if (pickedTexts.has(item.text)) continue;
    let period = periodForCategory(item.category);
    if (usedPeriods.has(period)) {
      const fallback: ClassPeriod[] = ['period1', 'period2', 'period3', 'optional'];
      const free = fallback.find((p) => !usedPeriods.has(p));
      if (!free) break;
      period = free;
    }
    if (period === 'optional' && checkIn.condition === 'bad') continue;
    if (period === 'optional' && checkIn.timeAvailability === 'little') continue;

    blocks.push(buildBlock(period, item));
    usedPeriods.add(period);
    pickedTexts.add(item.text);
  }

  // 교시 정렬 (1교시 -> 2교시 -> 3교시 -> 선택교시)
  const order: ClassPeriod[] = ['period1', 'period2', 'period3', 'optional'];
  blocks.sort((a, b) => order.indexOf(a.period) - order.indexOf(b.period));

  const mustDoToday = scored
    .filter((s) => s.isMustFinish || s.isMustDo || s.urgency === 'critical' || s.urgency === 'high')
    .map((s) => s.text)
    .slice(0, 4);

  const canDelay = scored
    .filter((s) => !mustDoToday.includes(s.text))
    .map((s) => s.text)
    .slice(0, 5);

  const headline = headlineFor(checkIn.condition, tooMany);

  return {
    date: checkIn.date || todayISO(),
    blocks,
    mustDoToday,
    canDelay,
    headline,
    generatedAt: new Date().toISOString(),
  };
}

function buildBlock(period: ClassPeriod, item: ScoredTask): ClassBlock {
  const meta = PERIOD_BASE[period];
  const action = refineActionLine(item.text, item.category);
  return {
    id: `block-${period}-${Math.random().toString(36).slice(2, 8)}`,
    period,
    periodLabel: meta.label,
    categoryLabel: meta.categoryLabel,
    action,
    estimatedMinutes: estimateMinutes(item.category, action),
    status: 'planned',
    memo: '',
  };
}

// ---------- 밤 정산 자동 출력 ----------
export interface NightComputed {
  didWell: string;
  tomorrowMust: string[];
  tomorrowCanDelay: string[];
  tomorrowFirstAction: string;
  kindNote: string;
}

export function computeNightReview(
  doneList: string[],
  undoneList: string[],
  pushToTomorrow: string[],
  condition: Condition,
): NightComputed {
  const didWell =
    doneList.length === 0
      ? '오늘은 끝낸 일이 없지만, 하루를 닫으려고 앉은 것 자체가 잘한 일입니다.'
      : `오늘 ${doneList.length}개를 닫았어요. 그 중 가장 큰 건 “${doneList[0]}”입니다.`;

  const tomorrowMust: string[] = [];
  pushToTomorrow.forEach((t) => {
    if (!tomorrowMust.includes(t)) tomorrowMust.push(t);
  });
  undoneList.forEach((t) => {
    if (tomorrowMust.length < 3 && !tomorrowMust.includes(t)) {
      tomorrowMust.push(t);
    }
  });

  const tomorrowCanDelay = undoneList
    .filter((t) => !tomorrowMust.includes(t))
    .slice(0, 3);

  const tomorrowFirstAction =
    tomorrowMust[0] ?? '내일은 5분짜리 작은 행동 1개부터 시작하기';

  const kindNote =
    condition === 'bad'
      ? '오늘 못 한 일이 있어도 괜찮습니다. 컨디션이 나쁠 땐 멈추는 것도 전략이에요.'
      : '오늘 못 한 일이 있어도 괜찮습니다. 중요한 건 다시 판 위에 올리는 것입니다.';

  return {
    didWell,
    tomorrowMust,
    tomorrowCanDelay,
    tomorrowFirstAction,
    kindNote,
  };
}
