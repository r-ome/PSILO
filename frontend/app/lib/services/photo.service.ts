import { api } from "@/app/lib/api";

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
  createdAt: string | null;
  signedUrl: string;
}

export const photoService = {
  listPhotos: () => api.get<Photo[]>("/api/photos"),
  deletePhoto: (key: string) =>
    api.delete<{ message: string }>(`/api/photos?key=${encodeURIComponent(key)}`),
};
