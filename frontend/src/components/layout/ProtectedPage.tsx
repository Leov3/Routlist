"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "./AppShell";
import { getCurrentUser } from "@/lib/auth";
import type { AuthUser } from "@/types/routlis";

type ProtectedPageProps = {
  children: React.ReactNode;
  requiredPermissions?: string[];
  allowedRoles?: string[];
};

export function ProtectedPage({
  children,
  requiredPermissions = [],
  allowedRoles = [],
}: ProtectedPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Cargando Routlis...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const hasPermissions = requiredPermissions.every((permission) =>
    user.permissions.includes(permission),
  );
  const hasRole = allowedRoles.length === 0 || allowedRoles.includes(user.role);

  if (!hasPermissions || !hasRole) {
    return (
      <AppShell user={user}>
        <div className="rounded-[28px] border border-outline-variant bg-surface-container p-8 shadow-elevation-1">
          <h1 className="text-2xl font-semibold tracking-tight text-error">Acceso restringido</h1>
          <p className="mt-3 text-base text-on-surface-variant">
            Tu rol actual no tiene permisos para entrar a esta seccion.
          </p>
        </div>
      </AppShell>
    );
  }

  return <AppShell user={user}>{children}</AppShell>;
}
