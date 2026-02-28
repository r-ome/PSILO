"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import Image from "next/image";
import { Button } from "@/app/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { albumService, AlbumWithPhotos } from "@/app/lib/services/album.service";
import { photoService, Photo } from "@/app/lib/services/photo.service";
import PhotoGrid from "@/app/(protected)/components/PhotoGrid";
import DeleteConfirmDialog from "@/app/(protected)/components/DeleteConfirmDialog";
import ImageViewer from "@/app/(protected)/components/ImageViewer";

export default function AlbumDetailPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = use(params);
  const [album, setAlbum] = useState<AlbumWithPhotos | null>(null);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [photoToRemove, setPhotoToRemove] = useState<Photo | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRemovePending, setBulkRemovePending] = useState(false);

  const loadAlbum = useCallback(async () => {
    try {
      const data = await albumService.getAlbum(albumId);
      setAlbum(data);
    } catch {
      // ignore
    }
  }, [albumId]);

  useEffect(() => {
    albumService.getAlbum(albumId).then(setAlbum).catch(() => {});
    photoService.listPhotos().then(setAllPhotos).catch(() => {});
  }, [albumId]);

  const handleToggleSelect = (photo: Photo) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
  };

  const handleRemoveConfirm = async () => {
    if (!photoToRemove) return;
    const id = photoToRemove.id;
    setPhotoToRemove(null);
    try {
      await albumService.removePhotoFromAlbum(albumId, id);
      setAlbum((prev) =>
        prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== id) } : prev
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      // ignore
    }
  };

  const handleBulkRemoveConfirm = async () => {
    if (!album) return;
    const toRemove = album.photos.filter((p) => selectedIds.has(p.id));
    setBulkRemovePending(false);
    setSelectedIds(new Set());
    try {
      await Promise.all(
        toRemove.map((p) => albumService.removePhotoFromAlbum(albumId, p.id))
      );
      setAlbum((prev) =>
        prev
          ? { ...prev, photos: prev.photos.filter((p) => !toRemove.some((r) => r.id === p.id)) }
          : prev
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
                <div className="relative aspect-square bg-muted">
                  <Image
                    src={photo.signedUrl}
                    alt={photo.filename}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {album.photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos in this album.</p>
      ) : (
        <div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button variant="destructive" size="sm" onClick={() => setBulkRemovePending(true)}>
                <Trash2 className="h-4 w-4 mr-1" />
                Remove selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          )}
          <PhotoGrid
            photos={album.photos}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onDeleteRequest={setPhotoToRemove}
            onPhotoClick={setViewerIndex}
          />
        </div>
      )}

      <DeleteConfirmDialog
        photo={photoToRemove}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setPhotoToRemove(null)}
      />
      <DeleteConfirmDialog
        bulkCount={bulkRemovePending ? selectedIds.size : null}
        onConfirm={handleBulkRemoveConfirm}
        onCancel={() => setBulkRemovePending(false)}
      />
      <ImageViewer
        photos={album.photos}
        initialIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </div>
  );
}
