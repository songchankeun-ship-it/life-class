import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  subtitle,
  right,
  children,
  className,
}: SectionCardProps) {
  return (
    <section className={`lc-card-pad space-y-4 ${className ?? ''}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-semibold lc-text-deep">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm lc-text-soft">{subtitle}</p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}
