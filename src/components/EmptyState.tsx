import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-[rgba(60,72,90,0.16)] bg-[var(--color-ivory-50)] space-y-2">
      <div className="text-sm font-medium lc-text-deep">{title}</div>
      {description && (
        <div className="text-xs lc-text-soft whitespace-pre-line">
          {description}
        </div>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
