import type { ReactNode } from 'react';

export type TabKey =
  | 'dashboard'
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

const TABS: Tab[] = [
  { key: 'dashboard', label: '대시보드', short: '홈' },
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

interface LayoutProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  children: ReactNode;
}

export function Layout({ active, onChange, children }: LayoutProps) {
  return (
    <div className="lc-bg-app min-h-screen w-full flex flex-col">
      <header className="px-4 sm:px-6 pt-6 pb-2 max-w-screen-lg mx-auto w-full">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest uppercase lc-text-soft">
              Life Class
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold lc-text-deep">
              오늘의 교시
            </h1>
          </div>
          <div className="hidden sm:block text-xs lc-text-soft text-right max-w-[260px] leading-relaxed">
            오늘을 한 번에 다 바꾸지 말고,
            <br />한 교시씩 정리하세요.
          </div>
        </div>
      </header>

      <nav className="px-4 sm:px-6 max-w-screen-lg mx-auto w-full hidden md:block">
        <div className="lc-card p-1.5 flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className={
                  'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ' +
                  (isActive
                    ? 'bg-[var(--color-blue-mid)] text-white shadow'
                    : 'lc-text-soft hover:bg-[var(--color-ivory-100)]')
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="px-4 sm:px-6 pt-4 pb-28 md:pb-10 max-w-screen-lg mx-auto w-full flex-1">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[rgba(60,72,90,0.08)] z-50">
        <div className="flex overflow-x-auto">
          {TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className={
                  'shrink-0 px-3 py-2.5 text-xs font-medium whitespace-nowrap ' +
                  (isActive
                    ? 'text-[var(--color-blue-mid)] border-t-2 border-[var(--color-blue-mid)] -mt-[2px]'
                    : 'lc-text-soft')
                }
              >
                {t.short ?? t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

