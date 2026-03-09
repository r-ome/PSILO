import { api } from "@/app/lib/api";

export interface GroupedPhotosByDate {
  date: string;
  photos: Photo[];
}

export interface Photo {
  id: string;
  userId: string;
  s3Key: string;
  filename: string;
  size: number | null;
  width: number | null;
  height: number | null;
  format: string | null;
  contentType: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string | null;
  takenAt: string | null;
  signedUrl: string;
}

export const photoService = {
  listPhotos: () => api.get<Photo[]>("/api/photos"),
  deletePhoto: (key: string) =>
    api.delete<{ message: string }>(
      `/api/photos?key=${encodeURIComponent(key)}`,
    ),
  updatePhotoTakenAt: (key: string, takenAt: string | null) =>
    api.patch<Photo>(`/api/photos?key=${encodeURIComponent(key)}`, { takenAt }),
};
