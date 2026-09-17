"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/**
 * Câmp de formular cu etichetă, ajutor și eroare — folosit peste tot ca să
 * arate la fel și să valideze la fel.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-1 text-primary">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Două câmpuri pe rând pe ecrane mici — potrivit pentru dimensiuni. */
export function FieldRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>{children}</div>
  );
}
