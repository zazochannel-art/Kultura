'use client';

import { forwardRef } from 'react';
import { CURRENCY_SYMBOLS } from '@/lib/format';
import type { CurrencyCode } from '@/lib/types/database';
import { cn } from '@/lib/utils';

/**
 * An amount field, sized like the thing it is: the number people came here to
 * type. `inputMode="decimal"` gets the numeric keypad on a phone without the
 * spinner arrows a `number` input drags along.
 */
export const MoneyInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'> & {
  currency?: CurrencyCode;
  large?: boolean;
}>(function MoneyInput({ className, currency = 'MDL', large = false, ...props }, ref) {
  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(
          'mf-tabular w-full rounded-lg border border-input bg-background pr-14 transition-colors',
          'placeholder:text-muted-foreground/60',
          'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none',
          'aria-invalid:border-danger aria-invalid:ring-danger/25',
          large ? 'h-16 px-4 text-3xl font-semibold tracking-tight' : 'h-10 px-3 text-base md:text-sm',
          className,
        )}
        {...props}
      />
      <span
        className={cn(
          'pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-medium text-muted-foreground',
          large ? 'text-lg' : 'text-sm',
        )}
      >
        {CURRENCY_SYMBOLS[currency] ?? currency}
      </span>
    </div>
  );
});
