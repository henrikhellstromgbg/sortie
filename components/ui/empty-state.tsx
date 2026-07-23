import * as React from 'react';
import { cn } from '@/lib/cn';

// Empty states are an invitation to act: icon, one-line explanation, one action.
// Copy rules: sentence case, plain verbs, no mood-only messaging (A11).

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-[var(--space-3)] p-[var(--space-12)] text-center',
        className
      )}
      {...props}
    >
      {icon && <div aria-hidden="true" className="text-[var(--color-text-tertiary)]">{icon}</div>}
      <p className="text-[length:var(--text-lg)] font-semibold text-[var(--color-text-primary)]">{title}</p>
      {description && (
        <p className="max-w-sm text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">{description}</p>
      )}
      {action && <div className="mt-[var(--space-2)]">{action}</div>}
    </div>
  );
}

export { EmptyState };
