"use client";

import { useState } from "react";
import { Camera, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PhotoInput } from "@/components/photo/photo-input";
import { AssetImage } from "@/components/photo/asset-image";
import { PHOTO_STAGE_LABELS } from "@/lib/constants";
import { PHOTO_STAGES } from "@/lib/types";
import type { Job, JobPhoto, PhotoStage } from "@/lib/types";
import { addPhoto, deletePhoto } from "@/lib/db/actions";
import { deleteAsset } from "@/lib/storage";

/** Pozele lucrării, grupate pe etape: înainte, în timpul, după. */
export function PhotosTab({ job, photos }: { job: Job; photos: JobPhoto[] }) {
  const [preview, setPreview] = useState<JobPhoto | null>(null);

  return (
    <div className="space-y-6">
      {PHOTO_STAGES.map((stage) => {
        const stagePhotos = photos.filter((photo) => photo.stage === stage);
        return (
          <section key={stage}>
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {PHOTO_STAGE_LABELS[stage]}
              </h3>
              <span className="text-xs text-muted-foreground">
                {stagePhotos.length} poze
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {stagePhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setPreview(photo)}
                  className="relative aspect-square overflow-hidden rounded-xl border border-border"
                >
                  <AssetImage
                    storagePath={photo.storage_path}
                    localKey={photo.local_key}
                    alt={PHOTO_STAGE_LABELS[photo.stage]}
                  />
                  {!photo.storage_path && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] text-amber-300">
                      local
                    </span>
                  )}
                </button>
              ))}

              <PhotoInput
                folder={`jobs/${job.id}`}
                multiple
                label="Adaugă"
                onCaptured={async (asset) => {
                  await addPhoto({
                    job_id: job.id,
                    stage: stage as PhotoStage,
                    storage_path: asset.storage_path,
                    local_key: asset.local_key,
                  });
                }}
              />
            </div>
          </section>
        );
      })}

      <Dialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="sm:max-w-2xl" hideClose>
          <DialogTitle className="sr-only">Fotografie</DialogTitle>
          {preview && (
            <>
              <div className="relative max-h-[70dvh] overflow-hidden rounded-xl bg-black">
                <AssetImage
                  storagePath={preview.storage_path}
                  localKey={preview.local_key}
                  alt={PHOTO_STAGE_LABELS[preview.stage]}
                  className="max-h-[70dvh] object-contain"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {PHOTO_STAGE_LABELS[preview.stage]}
                </span>
                <div className="flex gap-2">
                  <Confirm
                    title="Ștergi poza?"
                    onConfirm={async () => {
                      await deleteAsset(
                        preview.storage_path,
                        preview.local_key,
                      );
                      await deletePhoto(preview.id);
                      setPreview(null);
                      toast.success("Poză ștearsă");
                    }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-400"
                    >
                      <Trash2 /> Șterge
                    </Button>
                  </Confirm>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreview(null)}
                  >
                    <X /> Închide
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {!photos.length && (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Camera className="size-4" />
          Fotografiile se salvează și offline, apoi se urcă automat.
        </p>
      )}
    </div>
  );
}
