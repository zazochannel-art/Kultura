import { Hammer } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20">
        <Hammer className="size-5 text-black" />
      </div>
      {!compact && (
        <span className="text-lg font-bold tracking-tight">
          Montaj<span className="text-primary">Pro</span>
        </span>
      )}
    </div>
  );
}
