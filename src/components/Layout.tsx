import { useState } from 'react';
import type { ReactNode } from 'react';

export type TabKey =
  | 'dashboard'
  | 'chat'
  | 'journal'
  | 'checkin'
  | 'classes'
  | 'projects'
  | 'parking'
  | 'spots'
  | 'purchase'
  | 'move'
  | 'subs'
  | 'night'
  | 'settings';

interface Tab {
  key: TabKey;
  label: string;
  short?: string;
}

const ALL_TABS: Tab[] = [
  { key: 'dashboard', label: '대시보드', short: '홈' },
  { key: 'chat', label: 'Aide', short: 'Aide' },
  { key: 'journal', label: '오늘 일기', short: '일기' },
  { key: 'checkin', label: '아침 체크인', short: '아침' },
  { key: 'classes', label: '오늘', short: '오늘' },
  { key: 'projects', label: '프로젝트', short: '프로젝트' },
  { key: 'parking', label: '작업 주차장', short: '주차장' },
  { key: 'spots', label: '지정석', short: '지정석' },
  { key: 'purchase', label: '구매 기록', short: '구매' },
  { key: 'move', label: '이사 체크리스트', short: '이사' },
  { key: 'subs', label: '구독 / 자동결제', short: '구독' },
  { key: 'night', label: '밤 정산', short: '밤' },
  { key: 'settings', label: '설정 / 백업', short: '설정' },
];

// 모바일 상단 핵심 4개 + 더보기
const PRIMARY_MOBILE: TabKey[] = ['chat', 'dashboard', 'classes', 'purchase'];
const MORE_TABS: TabKey[] = ['journal', 'spots', 'checkin', 'projects', 'parking', 'move', 'subs', 'night', 'settings'];

interface LayoutProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  children: ReactNode;
}

export function Layout({ active, onChange, children }: LayoutProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const handleTabClick = (k: TabKey) => {
    onChange(k);
    setMoreOpen(false);
  };

  return (
    <div className="lc-bg-app min-h-screen w-full flex flex-col">
      {/* 상단 헤더 + 모바일 탭바 (sticky) */}
      <div className="sticky top-0 z-40 bg-[var(--color-bg)]/90 backdrop-blur-md border-b border-[var(--color-border)] md:border-b-0">
        <header className="px-4 sm:px-6 pt-3 sm:pt-6 pb-2 max-w-screen-lg mx-auto w-full">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] tracking-[0.18em] uppercase lc-text-mute font-medium">
                YOUR AIDE
              </div>
              <h1 className="text-lg sm:text-2xl font-semibold lc-text-deep tracking-tight">
                Aide
              </h1>
            </div>
          </div>
        </header>

        {/* 데스크탑: 상단 풀 탭 */}
        <nav className="px-4 sm:px-6 pb-3 max-w-screen-lg mx-auto w-full hidden md:block">
          <div className="lc-card p-1.5 flex items-center gap-1 overflow-x-auto">
            {ALL_TABS.map((t) => {
              const isActive = t.key === active;
              return (
                <button
                  key={t.key}
                  onClick={() => handleTabClick(t.key)}
                  className={
                    'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ' +
                    (isActive
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'lc-text-soft hover:bg-[var(--color-bg-soft)]')
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* 모바일: 상단 탭바 (헤더 아래) */}
        <nav className="md:hidden px-3 pb-2 max-w-screen-lg mx-auto w-full">
          <div className="grid grid-cols-5 gap-1">
            {PRIMARY_MOBILE.map((k) => {
              const tab = ALL_TABS.find((t) => t.key === k);
              if (!tab) return null;
              const isActive = tab.key === active && !moreOpen;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabClick(tab.key)}
                  className={
                    'py-2.5 rounded-xl text-[13px] font-medium transition-colors ' +
                    (isActive
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'lc-text-soft hover:bg-[var(--color-bg-soft)]')
                  }
                >
                  {tab.short ?? tab.label}
                </button>
              );
            })}
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={
                'py-2.5 rounded-xl text-[13px] font-medium transition-colors ' +
                (moreOpen || MORE_TABS.includes(active)
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'lc-text-soft hover:bg-[var(--color-bg-soft)]')
              }
            >
              더보기
            </button>
          </div>
        </nav>
      </div>

      <main className="px-4 sm:px-6 pt-3 sm:pt-4 pb-10 max-w-screen-lg mx-auto w-full flex-1">
        {children}
      </main>

      {/* 모바일: 더보기 시트 (상단 탭바 아래로 드롭다운) */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-30"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute top-[120px] left-3 right-3 bg-white rounded-2xl border border-[var(--color-border)] p-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-2">
              {MORE_TABS.map((k) => {
                const tab = ALL_TABS.find((t) => t.key === k);
                if (!tab) return null;
                const isActive = tab.key === active;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabClick(tab.key)}
                    className={
                      'flex items-center justify-center py-3.5 rounded-xl text-sm font-medium ' +
                      (isActive
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                        : 'bg-[var(--color-bg-soft)] lc-text-deep')
                    }
                  >
                    {tab.short ?? tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
