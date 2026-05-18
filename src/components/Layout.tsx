import type { ReactNode } from 'react';

export type TabKey = 'chat' | 'dashboard' | 'settings';

interface Tab {
  key: TabKey;
  label: string;
}

const TABS: Tab[] = [
  { key: 'chat', label: 'Aide' },
  { key: 'dashboard', label: '대시보드' },
  { key: 'settings', label: '설정' },
];

interface LayoutProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  children: ReactNode;
}

export function Layout({ active, onChange, children }: LayoutProps) {
  return (
    <div className="lc-bg-app min-h-screen w-full flex flex-col">
      {/* 상단 헤더 + 탭바 (sticky) */}
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

        {/* 탭바 (3개) */}
        <nav className="px-3 sm:px-6 pb-2 max-w-screen-lg mx-auto w-full">
          <div className="grid grid-cols-3 gap-1.5">
            {TABS.map((t) => {
              const isActive = t.key === active;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onChange(t.key)}
                  className={
                    'py-2.5 rounded-xl text-[13px] font-medium transition-colors ' +
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
      </div>

      <main className="px-4 sm:px-6 pt-3 sm:pt-4 pb-10 max-w-screen-lg mx-auto w-full flex-1">
        {children}
      </main>
    </div>
  );
}
