"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "./AppShell";
import { getCurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
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
    let cancelled = false;

    getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        if (!cancelled) {
          router.replace("/login");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let inFlight = false;
    let timeoutId: number | null = null;

    const schedule = () => {
      if (cancelled) return;
      timeoutId = window.setTimeout(async () => {
        if (cancelled || inFlight) {
          schedule();
          return;
        }

        inFlight = true;
        try {
          await getCurrentUser();
        } catch (error) {
          if (!cancelled && error instanceof ApiError && error.status === 401) {
            setUser(null);
            router.replace("/login");
            return;
          }
        } finally {
          inFlight = false;
          if (!cancelled) {
            schedule();
          }
        }
      }, 3000);
    };

    schedule();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [router, user]);

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
