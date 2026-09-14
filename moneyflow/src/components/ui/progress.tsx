'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.ComponentProps<'div'> {
  /** 0-100. Values above 100 fill the bar and are surfaced by `overflow`. */
  value: number;
  indicatorClassName?: string;
  /** For a colour that comes from user data rather than the theme. */
  indicatorStyle?: React.CSSProperties;
}

function Progress({ value, className, indicatorClassName, indicatorStyle, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-accent', className)}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-500 ease-out',
          indicatorClassName,
        )}
        style={{ width: `${clamped}%`, ...indicatorStyle }}
      />
    </div>
  );
}

export { Progress };
