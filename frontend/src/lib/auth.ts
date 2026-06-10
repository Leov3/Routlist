import { api } from "./api";
import type { AuthUser } from "@/types/routlis";

export async function getCurrentUser() {
  const result = await api<{ user: AuthUser }>("/auth/me");
  return result.user;
}

export async function logout() {
  await api<{ ok: boolean }>("/auth/logout", { method: "POST" });
}
