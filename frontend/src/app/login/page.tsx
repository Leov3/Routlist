"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

type LoginStatsResponse = {
  activeAudios: number;
  activeCategories: number;
  activeButtons: number;
  totalPlaybacks: number;
  storageBytes: number;
  storageFormatted: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [stats, setStats] = useState<LoginStatsResponse | null>(null);
  const [statsError, setStatsError] = useState(false);

  const toastTimer = useRef<undefined | ReturnType<typeof setTimeout>>(undefined);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const spotlightRingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const spotlight = spotlightRef.current;
    const spotlightRing = spotlightRingRef.current;
    if (!spotlight || !spotlightRing) return;

    function handleMouseMove(event: MouseEvent) {
      if (!spotlight || !spotlightRing) return;
      requestAnimationFrame(() => {
        spotlight.style.transform = `translate3d(${event.clientX - 360}px, ${event.clientY - 360}px, 0)`;
        spotlightRing.style.transform = `translate3d(${event.clientX - 170}px, ${event.clientY - 170}px, 0)`;
      });
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const body = document.body;
    const originalBg = body.style.background;
    body.style.background = "#0c0e14";
    return () => {
      body.style.background = originalBg;
    };
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-modal]")) {
        const backdrop = document.getElementById("modalBackdrop");
        if (target === backdrop) setModalOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api<LoginStatsResponse>("/public/stats");
        setStats(data);
      } catch {
        setStatsError(true);
      }
    }
    void loadStats();
  }, []);

  function showToast(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2300);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.replace("/board");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesion");
    } finally {
      setLoading(false);
    }
  }

  function handleDemo() {
    setEmail("admin@routlis.local");
    setPassword("Admin123*");
    showToast("Acceso demo rellenado.");
  }

  return (
    <>
      <div className="login-grid" aria-hidden="true" />
      <div className="login-spotlight" ref={spotlightRef} aria-hidden="true" />
      <div className="login-spotlight-ring" ref={spotlightRingRef} aria-hidden="true" />

      <section className="login-content">
        <div className="login-hero">
          <div className="login-brand-row">
            <div className="login-brand">
              <div className="login-logo-mark">
                <svg viewBox="0 0 48 48" fill="none" className="w-[48px] h-[48px]">
                  <path
                    d="M8 25.5h5.4c1.1 0 2-.7 2.3-1.8l2-8.3c.5-2.1 3.5-2.1 4 0l4.8 19.1c.5 2.1 3.5 2.1 4 0l2.8-11.2c.3-1.1 1.2-1.8 2.3-1.8H40"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path d="M8 33h32" stroke="white" strokeOpacity=".32" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="login-wordmark">
                <strong>Routlis</strong>
                <span>AudioBoard</span>
              </div>
            </div>
            <div className="login-online">Sistema online</div>
          </div>

          <h1 className="login-headline">
            Control total de tu contenido de <span>audio.</span>
          </h1>
          <p className="login-hero-copy">
            Organiza, reproduce y distribuye tu audio en vivo o por programación. Simple, rápido y confiable.
          </p>

          <div className={`login-audio-preview${previewPlaying ? " playing" : ""}`} id="audioPreview">
            <button
              className="login-play-tile"
              type="button"
              aria-label="Reproducir vista previa"
              onClick={() => {
                setPreviewPlaying(!previewPlaying);
                showToast(previewPlaying ? "Vista previa pausada." : "Vista previa reproduciendo.");
              }}
            >
              {previewPlaying ? (
                <svg viewBox="0 0 48 48" fill="none">
                  <path d="M17 13h6v22h-6V13Zm10 0h6v22h-6V13Z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 48 48" fill="none">
                  <path d="M17 13v22l20-11-20-11Z" fill="currentColor" />
                </svg>
              )}
            </button>
            <div>
              <div className="login-track-title">
                <span>Ident Promocional 2024</span>
                <small>00:28</small>
              </div>
              <div className="login-track-meta">00:28 · MP3 · 320 kbps</div>
              <div className="login-wave" aria-hidden="true">
                {Array.from({ length: 20 }).map((_, i) => {
                  const heights = [14, 22, 16, 28, 21, 26, 18, 30, 20, 24, 15, 27, 18, 25, 17, 29, 20, 26, 15, 22];
                  return (
                    <span key={i} style={{ "--h": `${heights[i]}px`, "--i": i + 1 } as React.CSSProperties} />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="login-metrics">
            <div className="login-metric">
              <div className="login-metric-icon">▥</div>
              <div>
                <strong>{statsError ? "--" : (stats?.activeAudios?.toLocaleString() ?? "Cargando...")}</strong>
                <span>Audios activos</span>
              </div>
            </div>
            <div className="login-metric">
              <div className="login-metric-icon">▣</div>
              <div>
                <strong>{statsError ? "--" : (stats?.activeButtons?.toLocaleString() ?? "Cargando...")}</strong>
                <span>Botones activos</span>
              </div>
            </div>
            <div className="login-metric">
              <div className="login-metric-icon">☁</div>
              <div>
                <strong>{statsError ? "--" : (stats?.storageFormatted ?? "Cargando...")}</strong>
                <span>Almacenamiento usado</span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-[#aeb4c2]">
            {statsError
              ? "No se pudieron cargar los datos públicos en tiempo real."
              : `Categorías activas: ${stats?.activeCategories?.toLocaleString() ?? "0"} · Reproducciones totales: ${stats?.totalPlaybacks?.toLocaleString() ?? "0"}`
            }
          </p>
        </div>

        <div className="login-auth-wrap">
          <form className="login-auth-card" id="loginForm" onSubmit={handleSubmit}>
            <h1>Iniciar sesión</h1>
            <p>Entra a tu workspace para operar Routlis AudioBoard.</p>

            <div className="login-form-grid">
              <div>
                <label className="login-label" htmlFor="email">Email</label>
                <div className="login-field">
                  <svg viewBox="0 0 24 24" fill="none" className="w-[19px] h-[19px] text-[#b7bdca] flex-shrink-0">
                    <path
                      d="M4 7.8A2.8 2.8 0 0 1 6.8 5h10.4A2.8 2.8 0 0 1 20 7.8v8.4a2.8 2.8 0 0 1-2.8 2.8H6.8A2.8 2.8 0 0 1 4 16.2V7.8Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path d="m5.5 7 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    className="login-input"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="login-label" htmlFor="password">Contraseña</label>
                <div className="login-field">
                  <svg viewBox="0 0 24 24" fill="none" className="w-[19px] h-[19px] text-[#b7bdca] flex-shrink-0">
                    <path
                      d="M7 10V8a5 5 0 0 1 10 0v2M6.8 10h10.4A1.8 1.8 0 0 1 19 11.8v6.4a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 18.2v-6.4A1.8 1.8 0 0 1 6.8 10Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>
                  <input
                    id="password"
                    type="password"
                    className="login-input"
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    aria-label="Mostrar contraseña"
                    onClick={() => {
                      const input = document.getElementById("password") as HTMLInputElement;
                      const isPassword = input.type === "password";
                      input.type = isPassword ? "text" : "password";
                      showToast(isPassword ? "Contraseña visible." : "Contraseña oculta.");
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]">
                      <path
                        d="M2 12s4.5-7 10-7 10 7 10 7-4.5 7-10 7S2 12 2 12z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <p className="login-error">
                {error}
              </p>
            ) : null}

            <div className="login-auth-options">
              <label className="login-remember">
                <input
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Recordarme
              </label>
              <button type="button" className="login-text-btn" onClick={() => setModalOpen(true)}>
                Olvidé mi contraseña
              </button>
            </div>

            <button type="submit" className="login-primary-btn" id="submitBtn" disabled={loading}>
              → {loading ? "Validando acceso..." : "Entrar al panel"}
            </button>
            <button type="button" className="login-secondary-btn" id="demoBtn" onClick={handleDemo}>
              ✦ Rellenar acceso demo
            </button>

            <div className="login-auth-note">Mockup limpio · sin marco de navegador, con spotlight ligero y clickeable.</div>
          </form>
        </div>
      </section>

      <div className={`login-toast${toast ? " show" : ""}`} id="toast">
        {toast}
      </div>

      <div
        className={`login-modal-backdrop${modalOpen ? " show" : ""}`}
        id="modalBackdrop"
        data-modal
        role="dialog"
        aria-modal="true"
        aria-labelledby="modalTitle"
      >
        <div className="login-modal">
          <h2 id="modalTitle">Recuperar contraseña</h2>
          <p>En producción se enviaría un enlace temporal al email registrado del owner u operador.</p>
          <div className="login-field">
            <svg viewBox="0 0 24 24" fill="none" className="w-[19px] h-[19px] text-[#b7bdca] flex-shrink-0">
              <path
                d="M4 7.8A2.8 2.8 0 0 1 6.8 5h10.4A2.8 2.8 0 0 1 20 7.8v8.4a2.8 2.8 0 0 1-2.8 2.8H6.8A2.8 2.8 0 0 1 4 16.2V7.8Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path d="m5.5 7 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              id="recoverEmail"
              type="email"
              className="login-input"
              placeholder="admin@routlis.local"
              value={recoverEmail}
              onChange={(event) => setRecoverEmail(event.target.value)}
            />
          </div>
          <div className="login-modal-actions">
            <button type="button" className="login-cancel" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="login-send"
              onClick={() => {
                setModalOpen(false);
                showToast("Enlace de recuperación simulado.");
              }}
            >
              Enviar enlace
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
