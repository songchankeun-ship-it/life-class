// =============================================================
// Life Class - 도메인 타입 정의
// =============================================================

export type Condition = 'good' | 'normal' | 'bad';
export type TimeAvailability = 'much' | 'normal' | 'little';

export type Importance = 'low' | 'mid' | 'high' | 'critical';
export type Urgency = 'low' | 'mid' | 'high' | 'critical';

export type ProjectStatus = 'active' | 'done' | 'paused' | 'hobby' | 'urgent';

export type TaskCategory =
  | 'move'
  | 'money'
  | 'work'
  | 'trading'
  | 'couple'
  | 'life'
  | 'project'
  | 'etc';

export type ClassPeriod = 'period1' | 'period2' | 'period3' | 'optional';
export type ClassStatus = 'planned' | 'inProgress' | 'done';

// ----- Task (할 일 단위) -----
export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  importance: Importance;
  urgency: Urgency;
  estimatedMinutes?: number;
  memo?: string;
  createdAt: string;
  source?: 'checkin' | 'parking' | 'manual';
  projectId?: string;
  done?: boolean;
}

// ----- Project (프로젝트) -----
export interface Project {
  id: string;
  name: string;
  category: TaskCategory;
  status: ProjectStatus;
  importance: Importance;
  urgency: Urgency;
  description: string;
  nextAction: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
  completed?: boolean;
}

// ----- 아침 체크인 -----
export interface DailyCheckIn {
  date: string;
  condition: Condition;
  timeAvailability: TimeAvailability;
  taskList: string[];
  worry: string;
  mustDo: string;
  oneToFinish: string;
  willExercise: boolean;
  note: string;
  createdAt: string;
}

// ----- 교시 블록 -----
export interface ClassBlock {
  id: string;
  period: ClassPeriod;
  periodLabel: string;
  categoryLabel: string;
  action: string;
  estimatedMinutes: number;
  status: ClassStatus;
  memo: string;
  taskId?: string;
  projectId?: string;
}

// ----- 하루 계획 -----
export interface DailyPlan {
  date: string;
  blocks: ClassBlock[];
  mustDoToday: string[];
  canDelay: string[];
  headline: string;
  generatedAt: string;
}

// ----- 작업 주차장 -----
export interface ParkingItem {
  id: string;
  title: string;
  category: TaskCategory;
  importance: Importance;
  memo: string;
  createdAt: string;
  done?: boolean;
  movedToToday?: boolean;
}

// ----- 이사 체크리스트 -----
export type MoveSection = 'contract' | 'schedule' | 'pack' | 'after';

export interface MoveChecklistItem {
  id: string;
  section: MoveSection;
  title: string;
  done: boolean;
  memo: string;
}

// ----- 구독 -----
export type SubscriptionUsage = 'using' | 'rare' | 'cancel-planned' | 'cancelled';
export type SubscriptionCategory =
  | 'ott' | 'ai' | 'music' | 'cloud' | 'shopping' | 'etc';

export interface SubscriptionItem {
  id: string;
  name: string;
  amount: number;
  payDay: number;
  usage: SubscriptionUsage;
  category: SubscriptionCategory;
  memo: string;
}

// ----- 밤 정산 -----
export interface NightReview {
  date: string;
  doneList: string[];
  undoneList: string[];
  pushToTomorrow: string[];
  condition: Condition;
  oneLine: string;
  computed?: {
    didWell: string;
    tomorrowMust: string[];
    tomorrowCanDelay: string[];
    tomorrowFirstAction: string;
    kindNote: string;
  };
  createdAt: string;
}

// ----- 지정석 (물건이 사는 곳) -----
export interface SpotItem {
  id: string;
  name: string;
  homeSpot: string;
  carSpot: string;
  important: boolean;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

// ----- 구매 기록 -----
export type PurchaseCategory =
  | 'clothes' | 'food' | 'tech' | 'home' | 'beauty' | 'hobby' | 'etc';
export type PurchaseStatus = 'ordered' | 'arrived' | 'returned';

export interface Purchase {
  id: string;
  name: string;
  store: string;
  amount: number;
  category: PurchaseCategory;
  orderDate: string;
  status: PurchaseStatus;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

// ----- 일기 -----
export interface JournalEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  body: string;          // 자유 입력 본문
  extracted?: {
    todos: string[];
    purchases: string[];
    events: string[];
    notes: string[];
  };
  createdAt: string;
  updatedAt: string;
}

// ----- 채팅 메시지 -----
export interface ExtractedItems {
  todos?: Array<{ title: string; category?: string }>;
  purchases?: Array<{ name: string; category?: string; amount?: number }>;
  events?: Array<{ title: string; date?: string }>;
  notes?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  extracted?: ExtractedItems;
  createdAt: string;
}

// ----- 앱 설정 -----
export interface AppSettings {
  version: string;
  appName: string;
  lastBackupAt?: string;
}

// ----- 전체 저장 형태 -----
export interface AppData {
  tasks: Task[];
  projects: Project[];
  dailyPlans: Record<string, DailyPlan>;
  checkIns: Record<string, DailyCheckIn>;
  parking: ParkingItem[];
  moveChecklist: MoveChecklistItem[];
  subscriptions: SubscriptionItem[];
  reviews: Record<string, NightReview>;
  spots: SpotItem[];
  purchases: Purchase[];
  journals: JournalEntry[];
  chatMessages: ChatMessage[];
  settings: AppSettings;
}

// ----- 카테고리 라벨 -----
export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  move: '이사 / 마감',
  money: '돈 / 구독',
  work: '업무 / 스토어',
  trading: 'AI 트레이딩',
  couple: '커플앱',
  life: '생활 / 몸 / 공간',
  project: '프로젝트',
  etc: '기타',
};

export const CONDITION_LABEL: Record<Condition, string> = {
  good: '좋음',
  normal: '보통',
  bad: '나쁨',
};

export const TIME_LABEL: Record<TimeAvailability, string> = {
  much: '많음',
  normal: '보통',
  little: '적음',
};

export const PERIOD_BASE: Record<ClassPeriod, { label: string; categoryLabel: string }> = {
  period1: { label: '오전', categoryLabel: '돈 / 미래 / 중요한 프로젝트' },
  period2: { label: '오후', categoryLabel: '마감 / 연락 / 이사 / 미루면 문제되는 일' },
  period3: { label: '저녁', categoryLabel: '공간 / 몸 / 생활 정리' },
  optional: { label: '자유', categoryLabel: '취미 / 관계 / 가벼운 프로젝트' },
};

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  low: '낮음',
  mid: '중간',
  high: '높음',
  critical: '매우 높음',
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  low: '낮음',
  mid: '중간',
  high: '높음',
  critical: '매우 높음',
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: '진행 중',
  done: '완료',
  paused: '보류',
  hobby: '취미',
  urgent: '긴급',
};

export const SUB_USAGE_LABEL: Record<SubscriptionUsage, string> = {
  using: '사용 중',
  rare: '거의 안 씀',
  'cancel-planned': '해지 예정',
  cancelled: '해지 완료',
};

export const SUB_CATEGORY_LABEL: Record<SubscriptionCategory, string> = {
  ott: 'OTT',
  ai: 'AI툴',
  music: '음악',
  cloud: '클라우드',
  shopping: '쇼핑',
  etc: '기타',
};

export const MOVE_SECTION_LABEL: Record<MoveSection, string> = {
  contract: '업체 / 계약',
  schedule: '일정',
  pack: '짐 정리',
  after: '입주 후',
};

export const PURCHASE_CATEGORY_LABEL: Record<PurchaseCategory, string> = {
  clothes: '옷',
  food: '음식 / 식료품',
  tech: '전자 / 디지털',
  home: '생활 / 가전',
  beauty: '뷰티',
  hobby: '취미',
  etc: '기타',
};

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  ordered: '주문',
  arrived: '도착',
  returned: '반품',
};
