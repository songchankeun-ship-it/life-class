import { useState } from 'react';
import type { ReactNode } from 'react';

export type TabKey =
  | 'dashboard'
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

// 모든 탭 (데스크탑 상단)
const ALL_TABS: Tab[] = [
  { key: 'dashboard', label: '대시보드', short: '홈' },
  { key: 'journal', label: '오늘 일기', short: '일기' },
  { key: 'checkin', label: '아침 체크인', short: '아침' },
  { key: 'classes', label: '오늘의 교시', short: '교시' },
  { key: 'projects', label: '프로젝트', short: '프로젝트' },
  { key: 'parking', label: '작업 주차장', short: '주차장' },
  { key: 'spots', label: '지정석', short: '지정석' },
  { key: 'purchase', label: '구매 기록', short: '구매' },
  { key: 'move', label: '이사 체크리스트', short: '이사' },
  { key: 'subs', label: '구독 / 자동결제', short: '구독' },
  { key: 'night', label: '밤 정산', short: '밤' },
  { key: 'settings', label: '설정 / 백업', short: '설정' },
];

// 모바일 하단 - 핵심 4개만 고정 + 더보기
const PRIMARY_MOBILE: TabKey[] = ['dashboard', 'journal', 'classes', 'purchase'];
const MORE_TABS: TabKey[] = ['spots', 'checkin', 'projects', 'parking', 'move', 'subs', 'night', 'settings'];

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
      {/* 헤더 - 모바일에서는 매우 슬림 */}
      <header className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 max-w-screen-lg mx-auto w-full">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] tracking-[0.18em] uppercase lc-text-mute font-medium">
              Life Class
            </div>
            <h1 className="text-lg sm:text-2xl font-semibold lc-text-deep tracking-tight">
              오늘의 교시
            </h1>
          </div>
        </div>
      </header>

      {/* 데스크탑: 상단 탭 */}
      <nav className="px-4 sm:px-6 max-w-screen-lg mx-auto w-full hidden md:block">
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

      <main className="px-4 sm:px-6 pt-3 sm:pt-4 pb-32 md:pb-10 max-w-screen-lg mx-auto w-full flex-1">
        {children}
      </main>

      {/* 모바일: 더보기 시트 */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-[68px] left-0 right-0 bg-white rounded-t-3xl border-t border-[var(--color-border)] p-3 pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--color-border)] rounded-full mx-auto mb-3" />
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
                      'flex flex-col items-center justify-center gap-1 py-4 rounded-2xl text-sm font-medium ' +
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

      {/* 모바일: 하단 탭 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[var(--color-border)] z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {PRIMARY_MOBILE.map((k) => {
            const tab = ALL_TABS.find((t) => t.key === k);
            if (!tab) return null;
            const isActive = tab.key === active && !moreOpen;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className={
                  'py-3 text-[13px] font-medium ' +
                  (isActive ? 'text-[var(--color-accent)]' : 'lc-text-mute')
                }
              >
                {tab.short ?? tab.label}
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={
              'py-3 text-[13px] font-medium ' +
              (moreOpen || MORE_TABS.includes(active) ? 'text-[var(--color-accent)]' : 'lc-text-mute')
            }
          >
            더보기
          </button>
        </div>
      </nav>
    </div>
  );
}
