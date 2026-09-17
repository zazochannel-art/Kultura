"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { resolveAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Afișează o imagine indiferent unde se află: blob local (offline) sau
 * Supabase Storage. Localul are prioritate — este instant.
 */
export function AssetImage({
  storagePath,
  localKey,
  alt,
  className,
  onClick,
}: {
  storagePath: string | null | undefined;
  localKey: string | null | undefined;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  // Rezultatul este legat de sursă: cât timp cheia diferă, imaginea încă se
  // caută. Așa nu avem nevoie de un setState sincron la schimbarea props-urilor.
  const key = `${storagePath ?? ""}|${localKey ?? ""}`;
  const [resolved, setResolved] = useState<{
    key: string;
    url: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveAssetUrl(storagePath, localKey).then((next) => {
      if (!cancelled) setResolved({ key, url: next });
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath, localKey, key]);

  const url = resolved?.key === key ? resolved.url : undefined;

  if (url === undefined)
    return <Skeleton className={cn("size-full", className)} />;

  if (!url) {
    return (
      <div
        className={cn(
          "flex size-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-5" />
        <span className="text-[10px]">Indisponibilă</span>
      </div>
    );
  }

  return (
    // Sursele sunt blob: / URL semnat Supabase — `next/image` nu le poate
    // optimiza, așa că folosim <img> direct.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      onClick={onClick}
      className={cn("size-full object-cover", className)}
    />
  );
}
