import { useCallback, useEffect, useRef, useState } from 'react';
import type { TabKey } from './components/Layout';
import { Layout } from './components/Layout';
import { Settings } from './components/Settings';
import { Chat } from './components/Chat';
import type { AppData, ChatMessage, Entry } from './types';
import { initializeDefaultData, loadAllData, saveAllData } from './utils/storage';
import { autoDailyDigest, scheduleEntryReminders } from './utils/notify';
import { scheduleSync } from './utils/cloudSync';
import { autoArchiveOldEntries } from './utils/archive';

export default function App() {
  const [tab, setTab] = useState<TabKey>('chat');
  const [data, setData] = useState<AppData | null>(null);

  // 최신 data 를 timer 안에서 읽기 위해 ref 로도 보관
  const dataRef = useRef<AppData | null>(null);
  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    const fresh = initializeDefaultData();
    // 90일 이상 지난 완료 항목 자동 아카이브
    const archivedEntries = autoArchiveOldEntries(fresh.entries);
    if (archivedEntries !== fresh.entries) {
      fresh.entries = archivedEntries;
    }
    setData(fresh);
  }, []);

  useEffect(() => {
    if (data) saveAllData(data);
  }, [data]);

  // 디지스트: 초기 1회 + 30분마다 재시도 (자정 넘어가도 다음날 자동 발송)
  useEffect(() => {
    const tryDigest = () => {
      const cur = dataRef.current;
      if (cur) autoDailyDigest(cur.entries).catch(() => {});
    };
    tryDigest();
    const id = window.setInterval(tryDigest, 30 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // entries 가 바뀔 때마다 임박한 알림 재스케줄 + 클라우드 sync
  useEffect(() => {
    if (!data) return;
    const cleanup = scheduleEntryReminders(data.entries);
    scheduleSync(data.entries);
    return cleanup;
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
        Aide를 불러오는 중...
      </div>
    );
  }

  const appendChatMessages = (msgs: ChatMessage[]) => {
    setData((prev) => (prev ? { ...prev, chatMessages: [...prev.chatMessages, ...msgs] } : prev));
  };

  const appendEntries = (newEntries: Entry[]) => {
    setData((prev) => (prev ? { ...prev, entries: [...prev.entries, ...newEntries] } : prev));
  };

  const updateEntry = (entry: Entry) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map((e) => (e.id === entry.id ? entry : e)),
      };
    });
  };

  const deleteEntry = (id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, entries: prev.entries.filter((e) => e.id !== id) };
    });
  };

  const setEntries = (next: Entry[]) => {
    setData((prev) => (prev ? { ...prev, entries: next } : prev));
  };

  return (
    <Layout active={tab} onChange={goto}>
      {/* Chat 은 항상 마운트 상태로 두고 display 만 토글 — 탭 전환 시 상태(검색어, 펼쳐둔 카드 등) 보존 */}
      <div style={{ display: tab === 'chat' ? 'block' : 'none' }}>
        <Chat
          data={data}
          onAppendMessages={appendChatMessages}
          onAppendEntries={appendEntries}
          onUpdateEntry={updateEntry}
          onDeleteEntry={deleteEntry}
        />
      </div>
      {tab === 'settings' && <Settings data={data} onReload={reload} onSetEntries={setEntries} />}
    </Layout>
  );
}
