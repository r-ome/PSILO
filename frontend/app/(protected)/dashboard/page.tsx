"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import FileDropZone from "@/app/(protected)/components/FileDropZone";
import { photoService, Photo } from "@/app/lib/services/photo.service";
import { Trash2 } from "lucide-react";

export default function Page() {
  const [photos, setPhotos] = useState<Photo[]>([]);

  // Used by FileDropZone after upload — not called inside an effect
  const loadPhotos = useCallback(() => {
    photoService.listPhotos().then(setPhotos).catch(() => {});
  }, []);

  // Initial load: setState called inside .then() callback (async), not synchronously
  useEffect(() => {
    photoService.listPhotos().then(setPhotos).catch(() => {});
  }, []);

  const handleDelete = async (s3Key: string) => {
    try {
      await photoService.deletePhoto(s3Key);
      setPhotos((prev) => prev.filter((p) => p.s3Key !== s3Key));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8">
      <div className="w-1/3">
        <Card>
          <CardHeader>
            <CardTitle>Upload Your Files</CardTitle>
          </CardHeader>
          <CardContent>
            <FileDropZone onUploadComplete={loadPhotos} />
          </CardContent>
        </Card>
      </div>

      {photos.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Your Photos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group border border-border rounded-lg overflow-hidden"
              >
                <div className="relative aspect-square bg-muted">
                  <Image
                    src={photo.signedUrl}
                    alt={photo.filename}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                  />
                </div>
                <div className="p-2 text-xs text-muted-foreground truncate">
                  {photo.filename}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-background/80 hover:text-red-500"
                  onClick={() => handleDelete(photo.s3Key)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
