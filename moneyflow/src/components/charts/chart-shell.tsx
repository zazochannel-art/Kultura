'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Every chart on the page sits in the same frame: a title, an optional headline
 * figure, the plot, and a legend underneath. Series identity is never carried by
 * colour alone — the legend is always present for two or more series, and the
 * category charts direct-label as well.
 */
export function ChartShell({
  title,
  headline,
  sub,
  legend,
  children,
  className,
}: {
  title: string;
  headline?: string;
  sub?: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="gap-1 pb-2">
        <CardTitle className="text-muted-foreground">{title}</CardTitle>
        {headline ? <p className="mf-tabular text-2xl font-semibold tracking-tight">{headline}</p> : null}
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        {legend ? <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">{legend}</div> : null}
      </CardContent>
    </Card>
  );
}

export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="size-2.5 shrink-0 rounded-[3px]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

/** Shared tooltip body. Values arrive pre-formatted; this only lays them out. */
export function ChartTooltip({
  label,
  rows,
  className,
}: {
  label: string;
  rows: Array<{ color?: string; name: string; value: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-2xl',
        className,
      )}
    >
      <p className="font-medium">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-2">
            {row.color ? (
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
            ) : null}
            <span className="text-muted-foreground">{row.name}</span>
            <span className="mf-tabular ml-auto font-medium">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
