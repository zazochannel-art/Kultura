'use client';

import { Check } from 'lucide-react';
import { COLOR_SWATCHES } from '@/lib/icons';
import { cn } from '@/lib/utils';

export function ColorPicker({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (color: string) => void;
  name?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {COLOR_SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={color}
          aria-pressed={value.toLowerCase() === color.toLowerCase()}
          className={cn(
            'flex size-8 items-center justify-center rounded-lg transition-transform hover:scale-110',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
          )}
          style={{ backgroundColor: color }}
        >
          {value.toLowerCase() === color.toLowerCase() ? (
            <Check className="size-4 text-white drop-shadow" />
          ) : null}
        </button>
      ))}
    </div>
  );
}
