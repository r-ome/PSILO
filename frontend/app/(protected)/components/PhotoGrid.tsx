"use client";

import Image from "next/image";
import { Check, Fullscreen, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Photo } from "@/app/lib/services/photo.service";
import { cn } from "@/app/lib/utils";

interface PhotoGridProps {
  photos: Photo[];
  selectedIds: Set<string>;
  onToggleSelect: (photo: Photo) => void;
  onDeleteRequest: (photo: Photo) => void;
  onPhotoClick: (index: number) => void;
}

export default function PhotoGrid({
  photos,
  selectedIds,
  onToggleSelect,
  onDeleteRequest,
  onPhotoClick,
}: PhotoGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {photos.map((photo, index) => {
        const isSelected = selectedIds.has(photo.id);
        return (
          <div
            key={photo.id}
            className={cn(
              "relative group border rounded-lg overflow-hidden",
              isSelected ? "border-primary" : "border-border",
            )}
          >
            <div
              className="relative aspect-square bg-muted cursor-pointer"
              onClick={() => onPhotoClick(index)}
            >
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
            </div>

            {/* Selection toggle — top left */}
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

            {/* Delete — top right */}
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
          </div>
        );
      })}
    </div>
  );
}
