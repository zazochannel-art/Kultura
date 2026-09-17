"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/utils";

/**
 * Input numeric cu butoane +/-.
 *
 * Pe șantier tastatura e inamicul: butoanele mari permit ajustarea fără
 * tastare, iar `inputMode="decimal"` deschide tastatura numerică pe telefon.
 */
export function NumberInput({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  suffix,
  placeholder,
  id,
  className,
  stepper = true,
}: {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  stepper?: boolean;
}) {
  const current =
    value === "" || value === null || value === undefined ? "" : String(value);

  const bump = (delta: number) => {
    const next = Math.round((num(current) + delta) * 1000) / 1000;
    const clamped = Math.min(
      max ?? Number.MAX_SAFE_INTEGER,
      Math.max(min, next),
    );
    onChange(clamped);
  };

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      {stepper && (
        <button
          type="button"
          aria-label="Scade"
          onClick={() => bump(-step)}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95 md:size-11"
        >
          <Minus className="size-4" />
        </button>
      )}
      <div className="relative flex-1">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={current}
          placeholder={placeholder ?? "0"}
          onChange={(event) => {
            const raw = event.target.value.replace(",", ".");
            if (raw === "") return onChange(0);
            if (!/^-?\d*\.?\d*$/.test(raw)) return;
            onChange(num(raw));
          }}
          className={cn(
            "h-12 w-full rounded-xl border border-input bg-background px-3.5 text-center text-base font-semibold tabular-nums shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-11 md:text-sm",
            suffix && "pr-12",
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {stepper && (
        <button
          type="button"
          aria-label="Adaugă"
          onClick={() => bump(step)}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95 md:size-11"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Input pentru sume — aceeași ergonomie, cu moneda afișată. */
export function MoneyInput({
  value,
  onChange,
  currency,
  id,
  placeholder,
  className,
}: {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  currency: string;
  id?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <NumberInput
      id={id}
      value={value}
      onChange={onChange}
      suffix={currency}
      placeholder={placeholder}
      stepper={false}
      className={className}
    />
  );
}
