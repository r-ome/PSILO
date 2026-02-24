import { api } from "@/app/lib/api";

export const authService = {
  login: (email: string, password: string) =>
    api.post("/api/auth/login", { email, password }),
};
