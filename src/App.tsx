import { useCallback, useEffect, useState } from 'react';
import type { TabKey } from './components/Layout';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { DailyCheckIn } from './components/DailyCheckIn';
import { ClassSchedule } from './components/ClassSchedule';
import { ProjectBoard } from './components/ProjectBoard';
import { ParkingLot } from './components/ParkingLot';
import { MoveChecklistView } from './components/MoveChecklist';
import { SubscriptionManager } from './components/SubscriptionManager';
import { NightReviewView } from './components/NightReview';
import { Settings } from './components/Settings';
import { SpotBoard } from './components/SpotBoard';
import { PurchaseLog } from './components/PurchaseLog';
import { Journal } from './components/Journal';
import { Chat } from './components/Chat';
import type {
  AppData,
  DailyCheckIn as DailyCheckInType,
  DailyPlan,
  MoveChecklistItem,
  NightReview as NightReviewType,
  ParkingItem,
  Project,
  Purchase,
  JournalEntry,
  ChatMessage,
  SpotItem,
  SubscriptionItem,
} from './types';
import { initializeDefaultData, loadAllData, saveAllData } from './utils/storage';
import { todayISO } from './utils/date';

export default function App() {
  const [tab, setTab] = useState<TabKey>('chat');
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    const fresh = initializeDefaultData();
    setData(fresh);
  }, []);

  useEffect(() => {
    if (data) saveAllData(data);
  }, [data]);

  const reload = useCallback(() => {
    const fresh = loadAllData();
    setData(fresh);
  }, []);

  const goto = useCallback((k: TabKey) => {
    setTab(k);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  if (!data) {
    return (
      <div className="lc-bg-app min-h-screen flex items-center justify-center text-sm lc-text-soft">
        오늘의 교시를 불러오는 중...
      </div>
    );
  }

  const saveCheckIn = (checkIn: DailyCheckInType, plan: DailyPlan) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checkIns: { ...prev.checkIns, [checkIn.date]: checkIn },
        dailyPlans: { ...prev.dailyPlans, [plan.date]: plan },
      };
    });
  };

  const updatePlan = (plan: DailyPlan) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, dailyPlans: { ...prev.dailyPlans, [plan.date]: plan } };
    });
  };

  const updateProjects = (projects: Project[]) => {
    setData((prev) => (prev ? { ...prev, projects } : prev));
  };

  const updateParking = (parking: ParkingItem[]) => {
    setData((prev) => (prev ? { ...prev, parking } : prev));
  };

  const moveParkingToToday = (item: ParkingItem) => {
    setData((prev) => {
      if (!prev) return prev;
      const today = todayISO();
      const existingPlan = prev.dailyPlans[today];
      const order: Array<DailyPlan['blocks'][number]['period']> = ['period1', 'period2', 'period3', 'optional'];
      const used = new Set(existingPlan?.blocks.map((b) => b.period) ?? []);
      const period = order.find((p) => !used.has(p)) ?? 'optional';
      const labelMap = {
        period1: { label: '오전', cat: '돈 / 미래 / 중요한 프로젝트' },
        period2: { label: '오후', cat: '마감 / 연락 / 이사 / 미루면 문제되는 일' },
        period3: { label: '저녁', cat: '공간 / 몸 / 생활 정리' },
        optional: { label: '자유', cat: '취미 / 관계 / 가벼운 프로젝트' },
      };
      const newBlock = {
        id: 'block-' + period + '-' + Math.random().toString(36).slice(2, 8),
        period,
        periodLabel: labelMap[period].label,
        categoryLabel: labelMap[period].cat,
        action: item.title,
        estimatedMinutes: 30,
        status: 'planned' as const,
        memo: '',
      };
      const plan: DailyPlan = existingPlan
        ? { ...existingPlan, blocks: [...existingPlan.blocks, newBlock] }
        : {
            date: today,
            blocks: [newBlock],
            mustDoToday: [item.title],
            canDelay: [],
            headline: '주차장에서 가져온 항목으로 시간표가 시작됐어요.',
            generatedAt: new Date().toISOString(),
          };
      return { ...prev, dailyPlans: { ...prev.dailyPlans, [today]: plan } };
    });
  };

  const updateMoveChecklist = (moveChecklist: MoveChecklistItem[]) => {
    setData((prev) => (prev ? { ...prev, moveChecklist } : prev));
  };

  const updateSubscriptions = (subscriptions: SubscriptionItem[]) => {
    setData((prev) => (prev ? { ...prev, subscriptions } : prev));
  };

  const updateSpots = (spots: SpotItem[]) => {
    setData((prev) => (prev ? { ...prev, spots } : prev));
  };

  const updatePurchases = (purchases: Purchase[]) => {
    setData((prev) => (prev ? { ...prev, purchases } : prev));
  };
  const saveJournal = (entry: JournalEntry) => {
    setData((prev) => {
      if (!prev) return prev;
      const others = prev.journals.filter((j) => j.id !== entry.id);
      return { ...prev, journals: [entry, ...others] };
    });
  };

  const addParkings = (items: ParkingItem[]) => {
    setData((prev) => (prev ? { ...prev, parking: [...items, ...prev.parking] } : prev));
  };

  const addPurchases = (items: Purchase[]) => {
    setData((prev) => (prev ? { ...prev, purchases: [...items, ...prev.purchases] } : prev));
  };
  const appendChatMessages = (msgs: ChatMessage[]) => {
    setData((prev) => (prev ? { ...prev, chatMessages: [...prev.chatMessages, ...msgs] } : prev));
  };



  const saveReview = (review: NightReviewType) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, reviews: { ...prev.reviews, [review.date]: review } };
    });
  };

  return (
    <Layout active={tab} onChange={goto}>
      {tab === 'dashboard' && (
        <Dashboard
          data={data}
          onGoCheckIn={() => goto('checkin')}
          onGoClasses={() => goto('classes')}
          onGoParking={() => goto('parking')}
          onGoProjects={() => goto('projects')}
          onGoMove={() => goto('move')}
          onGoSubs={() => goto('subs')}
          onGoSpots={() => goto('spots')}
          onGoPurchase={() => goto('purchase')}
        />
      )}
      {tab === 'checkin' && (
        <DailyCheckIn data={data} onSave={saveCheckIn} onDone={() => goto('classes')} />
      )}
      {tab === 'classes' && (
        <ClassSchedule data={data} onUpdatePlan={updatePlan} onGoCheckIn={() => goto('checkin')} />
      )}
      {tab === 'projects' && <ProjectBoard data={data} onUpdateProjects={updateProjects} />}
      {tab === 'parking' && (
        <ParkingLot data={data} onUpdateParking={updateParking} onMoveToToday={moveParkingToToday} />
      )}
      {tab === 'spots' && <SpotBoard data={data} onUpdate={updateSpots} />}
      {tab === 'purchase' && <PurchaseLog data={data} onUpdate={updatePurchases} />}
      {tab === 'chat' && (
        <Chat
          data={data}
          onAppendMessages={appendChatMessages}
          onAddParking={addParkings}
          onAddPurchases={addPurchases}
        />
      )}
      {tab === 'journal' && (
        <Journal
          data={data}
          onSaveJournal={saveJournal}
          onAddParking={addParkings}
          onAddPurchases={addPurchases}
        />
      )}
      {tab === 'move' && <MoveChecklistView data={data} onUpdate={updateMoveChecklist} />}
      {tab === 'subs' && <SubscriptionManager data={data} onUpdate={updateSubscriptions} />}
      {tab === 'night' && <NightReviewView data={data} onSave={saveReview} />}
      {tab === 'settings' && <Settings data={data} onReload={reload} />}
    </Layout>
  );
}
