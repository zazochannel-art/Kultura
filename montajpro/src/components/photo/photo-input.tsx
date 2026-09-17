"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { storeImage, type StoredAsset } from "@/lib/storage";
import { useApp } from "@/lib/app-provider";
import { cn } from "@/lib/utils";

/**
 * Captură foto de pe telefon.
 *
 * `capture="environment"` deschide direct camera din spate pe Android/iOS;
 * pe desktop rămâne un selector de fișiere obișnuit.
 */
export function PhotoInput({
  folder,
  onCaptured,
  label = "Adaugă poză",
  multiple = false,
  variant = "tile",
  className,
}: {
  folder: string;
  onCaptured: (asset: StoredAsset, file: File) => void | Promise<void>;
  label?: string;
  multiple?: boolean;
  variant?: "tile" | "button";
  className?: string;
}) {
  const { userId } = useApp();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} nu este o imagine`);
          continue;
        }
        const asset = await storeImage(file, folder, userId);
        await onCaptured(asset, file);
      }
      toast.success(
        files.length > 1 ? `${files.length} poze adăugate` : "Poză adăugată",
      );
    } catch {
      toast.error("Poza nu a putut fi salvată");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const inputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
    </>
  );

  if (variant === "button") {
    return (
      <div className={cn("flex gap-2", className)}>
        {inputs}
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
          {label}
        </button>
        <button
          type="button"
          disabled={busy}
          aria-label="Alege din galerie"
          onClick={() => galleryRef.current?.click()}
          className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-accent disabled:opacity-60"
        >
          <ImagePlus className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {inputs}
      <button
        type="button"
        disabled={busy}
        onClick={() => cameraRef.current?.click()}
        className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-6 animate-spin" />
        ) : (
          <Camera className="size-6" />
        )}
        <span className="px-2 text-center text-xs font-medium">{label}</span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => galleryRef.current?.click()}
        className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        din galerie
      </button>
    </div>
  );
}
