"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "./AppShell";
import { getCurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import type { AuthUser } from "@/types/routlis";

type ProtectedPageProps = {
  children: React.ReactNode;
  requiredPermissions?: string[];
  allowedRoles?: string[];
};

function routePolicy(pathname: string) {
  if (pathname === "/admin") {
    return { allowedRoles: ["OWNER", "ADMIN", "SUPERVISOR"] };
  }
  if (pathname === "/admin/access") {
    return { allowedRoles: ["OWNER"] };
  }
  if (pathname === "/admin/organizations") {
    return { requiredPermissions: ["organization:read"] };
  }
  if (pathname === "/admin/users") {
    return { requiredPermissions: ["user:read"] };
  }
  if (pathname === "/admin/audios") {
    return { requiredPermissions: ["audio:read"] };
  }
  if (pathname === "/admin/categories") {
    return { requiredPermissions: ["category:read"] };
  }
  if (pathname === "/admin/buttons") {
    return { requiredPermissions: ["button:read"] };
  }
  if (pathname === "/admin/narratives") {
    return { requiredPermissions: ["narratives:view"] };
  }
  if (pathname === "/admin/narratives/new") {
    return { requiredPermissions: ["narratives:create"] };
  }
  if (pathname.startsWith("/admin/narratives/") && pathname.endsWith("/builder")) {
    return { requiredPermissions: ["narratives:update"] };
  }
  if (pathname === "/admin/integraciones") {
    return { requiredPermissions: ["integration:manage"] };
  }
  if (pathname === "/admin/history") {
    return { requiredPermissions: ["history:read"] };
  }
  if (pathname === "/admin/storage" || pathname === "/admin/maintenance") {
    return { allowedRoles: ["OWNER"] };
  }
  return {};
}

export function ProtectedPage({
  children,
  requiredPermissions = [],
  allowedRoles = [],
}: ProtectedPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const policy = routePolicy(pathname);
  const effectiveAllowedRoles = allowedRoles.length ? allowedRoles : policy.allowedRoles ?? [];
  const effectiveRequiredPermissions =
    requiredPermissions.length ? requiredPermissions : policy.requiredPermissions ?? [];

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

  const hasPermissions = effectiveRequiredPermissions.every((permission) =>
    user.permissions.includes(permission),
  );
  const hasRole =
    effectiveAllowedRoles.length === 0 ||
    effectiveAllowedRoles.includes(user.role);

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
