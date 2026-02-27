"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import { Button } from "@/app/components/ui/button";
import { albumService, AlbumWithPhotos } from "@/app/lib/services/album.service";
import { photoService, Photo } from "@/app/lib/services/photo.service";
import { Trash2, Plus } from "lucide-react";

export default function AlbumDetailPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = use(params);
  const [album, setAlbum] = useState<AlbumWithPhotos | null>(null);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Used by handleAdd after adding a photo — not called inside an effect
  const loadAlbum = useCallback(async () => {
    try {
      const data = await albumService.getAlbum(albumId);
      setAlbum(data);
    } catch {
      // ignore
    }
  }, [albumId]);

  // Initial load: setState called inside .then() callbacks (async), not synchronously
  useEffect(() => {
    albumService.getAlbum(albumId).then(setAlbum).catch(() => {});
    photoService.listPhotos().then(setAllPhotos).catch(() => {});
  }, [albumId]);

  const handleRemove = async (photoId: string) => {
    try {
      await albumService.removePhotoFromAlbum(albumId, photoId);
      setAlbum((prev) =>
        prev
          ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) }
          : prev,
      );
    } catch {
      // ignore
    }
  };

  const handleAdd = async (photoId: string) => {
    try {
      await albumService.addPhotoToAlbum(albumId, photoId);
      await loadAlbum();
      setShowPicker(false);
    } catch {
      // ignore
    }
  };

  const albumPhotoIds = new Set(album?.photos.map((p) => p.id) ?? []);
  const availablePhotos = allPhotos.filter((p) => !albumPhotoIds.has(p.id));

  if (!album) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{album.name}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPicker((v) => !v)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Photo
        </Button>
      </div>

      {showPicker && availablePhotos.length > 0 && (
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm font-medium mb-3">Select a photo to add:</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {availablePhotos.map((photo) => (
              <button
                key={photo.id}
                className="border border-border rounded overflow-hidden hover:border-primary transition-colors text-left"
                onClick={() => handleAdd(photo.id)}
              >
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <span className="text-xs text-muted-foreground truncate px-1">
                    {photo.filename}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {album.photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos in this album.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {album.photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group border border-border rounded-lg overflow-hidden"
            >
              <div className="aspect-square bg-muted flex items-center justify-center">
                <span className="text-xs text-muted-foreground truncate px-2">
                  {photo.filename}
                </span>
              </div>
              <div className="p-2 text-xs text-muted-foreground truncate">
                {photo.filename}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-background/80 hover:text-red-500"
                onClick={() => handleRemove(photo.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
