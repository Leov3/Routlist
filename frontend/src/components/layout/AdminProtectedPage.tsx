"use client";

import { ProtectedPage } from "./ProtectedPage";

type AdminProtectedPageProps = {
  children: React.ReactNode;
};

export function AdminProtectedPage({ children }: AdminProtectedPageProps) {
  return <ProtectedPage>{children}</ProtectedPage>;
}
