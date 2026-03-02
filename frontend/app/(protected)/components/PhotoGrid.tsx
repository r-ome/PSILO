"use client";

import Image from "next/image";
import { Check, Fullscreen, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Photo } from "@/app/lib/services/photo.service";
import { cn } from "@/app/lib/utils";

interface PhotoGridProps {
  photos: Photo[];
  selectedIds: Set<string>;
  onToggleSelect: (photo: Photo) => void;
  onDeleteRequest: (photo: Photo) => void;
  onPhotoClick: (index: number) => void;
  onRetry?: (photo: Photo) => void;
}

export default function PhotoGrid({
  photos,
  selectedIds,
  onToggleSelect,
  onDeleteRequest,
  onPhotoClick,
  onRetry,
}: PhotoGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {photos.map((photo, index) => {
        if (photo.status === "processing") {
          console.log(photo);
        }
        const isSelected = selectedIds.has(photo.id);
        const isCompleted = photo.status === "completed";
        const isFailed = photo.status === "failed";
        const isProcessing =
          photo.status === "pending" || photo.status === "processing";
        return (
          <div
            key={photo.id}
            className={cn(
              "relative group border rounded-lg overflow-hidden",
              isSelected ? "" : "border-border",
            )}
          >
            <div
              className={cn(
                "relative aspect-square bg-muted transition-transform duration-200",
                isSelected && isCompleted ? "scale-90" : "",
                isCompleted ? "cursor-pointer" : "cursor-default",
              )}
              onClick={() => isCompleted && onPhotoClick(index)}
            >
              {isCompleted ? (
                <>
                  <Image
                    src={photo.signedUrl}
                    alt={photo.filename}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity">
                    <Fullscreen className="h-5 w-5 text-white drop-shadow" />
                  </div>
                </>
              ) : isProcessing ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  <span className="text-xs text-muted-foreground capitalize">
                    {photo.status}
                  </span>
                </div>
              ) : isFailed ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                  <span className="text-xs text-destructive">Failed</span>
                  {onRetry && (
                    <button
                      className="text-xs underline text-muted-foreground hover:text-foreground hover:cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetry(photo);
                      }}
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            {/* Selection toggle — top left (completed only) */}
            {isCompleted && (
              <button
                className={cn(
                  "absolute top-1 left-1 h-5 w-5 rounded-full flex items-center justify-center transition-opacity z-10 cursor-pointer",
                  isSelected
                    ? "opacity-100 bg-primary"
                    : "opacity-0 group-hover:opacity-100 bg-black/40 border border-white",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(photo);
                }}
              >
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </button>
            )}

            {/* Delete — top right (completed only) */}
            {isCompleted && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-background/80 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRequest(photo);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
