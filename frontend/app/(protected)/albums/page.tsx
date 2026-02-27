"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { albumService, Album } from "@/app/lib/services/album.service";

export default function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    albumService.listAlbums().then(setAlbums).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!newAlbumName.trim()) return;
    setCreating(true);
    try {
      const album = await albumService.createAlbum(newAlbumName.trim());
      setAlbums((prev) => [...prev, album]);
      setNewAlbumName("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Create Album</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Album name"
              value={newAlbumName}
              onChange={(e) => setNewAlbumName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={creating || !newAlbumName.trim()}>
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-4">Your Albums</h2>
        {albums.length === 0 ? (
          <p className="text-sm text-muted-foreground">No albums yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {albums.map((album) => (
              <Link key={album.id} href={`/albums/${album.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="pt-4">
                    <p className="font-medium">{album.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {album.createdAt
                        ? new Date(album.createdAt).toLocaleDateString()
                        : ""}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
