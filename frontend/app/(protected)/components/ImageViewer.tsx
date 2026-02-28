"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/app/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/app/components/ui/carousel";
import { Photo } from "@/app/lib/services/photo.service";

interface ImageViewerProps {
  photos: Photo[];
  initialIndex: number | null;
  onClose: () => void;
}

export default function ImageViewer({
  photos,
  initialIndex,
  onClose,
}: ImageViewerProps) {
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (api && initialIndex !== null) {
      api.scrollTo(initialIndex, true);
    }
  }, [api, initialIndex]);

  useEffect(() => {
    if (initialIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") api?.scrollPrev();
      else if (e.key === "ArrowRight") api?.scrollNext();
      else if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [api, initialIndex, onClose]);

  return (
    <Dialog
      open={initialIndex !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-[90vw] h-[90vh] p-0 bg-black border-0 flex items-center justify-center overflow-hidden text-white">
        <DialogTitle className="sr-only">Image viewer</DialogTitle>
        <Carousel setApi={setApi} className="w-full">
          <CarouselContent>
            {photos.map((photo) => (
              <CarouselItem
                key={photo.id}
                className="flex items-center justify-center p-8"
              >
                <Image
                  src={photo.signedUrl}
                  alt={photo.filename}
                  width={photo.width ?? 1200}
                  height={photo.height ?? 800}
                  className="max-h-[calc(90vh-4rem)] max-w-full w-auto h-auto object-contain"
                  unoptimized
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 bg-white/20 border-white/40 text-white hover:bg-white/40 hover:text-white" />
          <CarouselNext className="right-2 bg-white/20 border-white/40 text-white hover:bg-white/40 hover:text-white" />
        </Carousel>
      </DialogContent>
    </Dialog>
  );
}
