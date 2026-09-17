import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cifră mare + etichetă. Blocul de bază al dashboard-ului. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger" | "secondary";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "text-muted-foreground bg-muted",
    primary: "text-cyan-300 bg-cyan-500/10",
    secondary: "text-violet-300 bg-violet-500/10",
    success: "text-emerald-300 bg-emerald-500/10",
    warning: "text-amber-300 bg-amber-500/10",
    danger: "text-red-300 bg-red-500/10",
  };

  const content = (
    <div
      className={cn(
        "card-hover flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 sm:p-4",
        href && "hover:border-primary/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            tones[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
