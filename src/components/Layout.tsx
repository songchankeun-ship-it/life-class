import type { ReactNode } from 'react';

export type TabKey = 'chat' | 'settings';

interface LayoutProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  children: ReactNode;
}

export function Layout({ active, onChange, children }: LayoutProps) {
  return (
    <div className="lc-bg-app min-h-screen w-full flex flex-col">
      {/* 컴팩트 헤더 — 한 줄 */}
      <div className="sticky top-0 z-40 bg-[var(--color-bg)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
        <header className="px-4 sm:px-6 py-2 max-w-screen-lg mx-auto w-full flex items-center justify-between">
          <button
            type="button"
            onClick={() => onChange('chat')}
            className="text-[15px] font-semibold lc-text-deep tracking-tight"
          >
            Aide
          </button>
          <button
            type="button"
            onClick={() => onChange(active === 'settings' ? 'chat' : 'settings')}
            aria-label={active === 'settings' ? '닫기' : '설정'}
            className={
              'w-9 h-9 rounded-lg flex items-center justify-center transition-colors ' +
              (active === 'settings'
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                : 'lc-text-soft hover:bg-[var(--color-bg-soft)]')
            }
          >
            {active === 'settings' ? '✕' : '⚙'}
          </button>
        </header>
      </div>

      <main className="px-4 sm:px-6 pt-3 pb-6 max-w-screen-lg mx-auto w-full flex-1">
        {children}
      </main>
    </div>
  );
}
