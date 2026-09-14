'use client';

import { ICON_MAP, ICON_NAMES } from '@/lib/icons';
import { cn } from '@/lib/utils';

export function IconPicker({
  value,
  onChange,
  color,
  name,
}: {
  value: string;
  onChange: (icon: string) => void;
  color?: string;
  name?: string;
}) {
  return (
    <div className="mf-scroll-x max-h-40 overflow-y-auto rounded-lg border border-border p-2">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div className="grid grid-cols-7 gap-1 sm:grid-cols-10">
        {ICON_NAMES.map((iconName) => {
          const Icon = ICON_MAP[iconName];
          const selected = value === iconName;
          return (
            <button
              key={iconName}
              type="button"
              onClick={() => onChange(iconName)}
              aria-label={iconName}
              aria-pressed={selected}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg transition-colors',
                selected ? 'bg-accent' : 'hover:bg-accent/60',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              )}
              style={selected && color ? { color } : undefined}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
