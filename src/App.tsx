import { useCallback, useEffect, useState } from 'react';
import type { TabKey } from './components/Layout';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { Chat } from './components/Chat';
import type {
  AppData,
  ChatMessage,
  Entry,
} from './types';
import { initializeDefaultData, loadAllData, saveAllData } from './utils/storage';

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

  return (
    <Layout active={tab} onChange={goto}>
      {tab === 'chat' && (
        <Chat
          data={data}
          onAppendMessages={appendChatMessages}
          onAppendEntries={appendEntries}
          onUpdateEntry={updateEntry}
          onDeleteEntry={deleteEntry}
        />
      )}
      {tab === 'dashboard' && (
        <Dashboard
          data={data}
          onGoChat={() => goto('chat')}
        />
      )}
      {tab === 'settings' && <Settings data={data} onReload={reload} />}
    </Layout>
  );
}
