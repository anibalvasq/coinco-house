import { api, Person } from "../api/client.js";
import { initial, AVATAR_PALETTE } from "../state.js";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              width?: number;
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>('script[data-google-gis]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Google")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleGis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google"));
    document.head.appendChild(script);
  });
}

export async function renderLogin(onLogin: (session: { id: string; name: string; color: string }) => void) {
  const app = document.getElementById("app")!;

  let people: Person[] = [];
  try {
    people = await api.listPeople();
  } catch {
    // no session needed for people list (public endpoint would be needed in production;
    // for now we attempt a direct fetch with no auth to let the screen load)
  }

  let googleClientId: string | null = null;
  try {
    const providers = await api.authProviders();
    if (providers.google.enabled && providers.google.client_id) {
      googleClientId = providers.google.client_id;
    }
  } catch {
    // PIN-only fallback if providers endpoint is unavailable
  }

  let selectedId: string | null = null;
  let pinBuffer = "";
  let errorMsg = "";
  let googleInitialized = false;

  function setGoogleStatus(message: string, isError = false) {
    const el = document.getElementById("google-status");
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? "var(--destructive)" : "var(--text-secondary)";
  }

  function render() {
    app.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;padding:64px 26px 32px">
        <div style="margin-bottom:36px">
          <div class="font-display" style="font-weight:700;font-size:25px">Hogar Compartido</div>
          <div style="font-size:14.5px;color:var(--text-secondary);margin-top:6px">Selecciona tu perfil para continuar</div>
        </div>

        ${googleClientId ? `
        <div style="margin-bottom:22px">
          <div id="google-btn" style="display:flex;justify-content:center;min-height:44px"></div>
          <div id="google-status" style="text-align:center;font-size:13px;margin-top:10px;min-height:18px;color:var(--destructive)"></div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:20px">
            <div style="flex:1;height:1px;background:var(--divider2)"></div>
            <div style="font-size:12px;color:var(--text-caption)">o con PIN</div>
            <div style="flex:1;height:1px;background:var(--divider2)"></div>
          </div>
        </div>` : ""}

        <div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:26px" id="profile-cards"></div>

        <div id="pin-area"></div>
      </div>
    `;

    renderProfileCards();
    if (selectedId) renderPinArea();
    if (googleClientId) void mountGoogleButton(googleClientId);
  }

  async function mountGoogleButton(clientId: string) {
    try {
      await loadGoogleScript();
      if (!window.google?.accounts?.id) throw new Error("Google no disponible");
      const el = document.getElementById("google-btn");
      if (!el || el.dataset.mounted === "1") return;
      if (!googleInitialized) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        googleInitialized = true;
      }
      const width = Math.min(320, Math.max(240, el.clientWidth || 280));
      window.google.accounts.id.renderButton(el, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width,
        locale: "es",
      });
      el.dataset.mounted = "1";
    } catch {
      setGoogleStatus("No se pudo cargar el inicio con Google", true);
    }
  }

  async function handleGoogleCredential(response: { credential: string }) {
    setGoogleStatus("Entrando con Google…");
    try {
      const session = await api.googleLogin(response.credential);
      onLogin(session);
    } catch (err) {
      const detail = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "No se pudo iniciar sesión con Google";
      setGoogleStatus(detail, true);
    }
  }

  function renderProfileCards() {
    const container = document.getElementById("profile-cards")!;
    if (!people.length) {
      container.innerHTML = `<p style="color:var(--text-secondary);font-size:14px">No hay personas registradas.</p>`;
      return;
    }
    container.innerHTML = people.map((p, i) => {
      const color = p.color || AVATAR_PALETTE[i % AVATAR_PALETTE.length];
      const sel = p.id === selectedId;
      return `
        <button data-pid="${p.id}" style="
          background:#fff;border-radius:16px;padding:16px 14px;border:2px solid ${sel ? "var(--accent)" : "transparent"};
          display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;
          box-shadow:var(--shadow-card);min-width:90px;">
          <div class="avatar" style="background:${color};width:44px;height:44px;font-size:18px">${initial(p.name)}</div>
          <div class="font-display" style="font-weight:600;font-size:14px">${p.name}</div>
        </button>`;
    }).join("");

    container.querySelectorAll("[data-pid]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedId = (btn as HTMLElement).dataset.pid!;
        pinBuffer = "";
        errorMsg = "";
        render();
      });
    });
  }

  function renderPinArea() {
    const area = document.getElementById("pin-area")!;
    const person = people.find(p => p.id === selectedId);
    if (!person) return;

    area.innerHTML = `
      <div id="pin-card" style="background:#fff;border-radius:20px;padding:24px 20px;box-shadow:var(--shadow-pin)">
        <div style="text-align:center;font-size:14px;color:var(--text-secondary);margin-bottom:14px">PIN de ${person.name}</div>
        <div style="display:flex;justify-content:center;gap:12px;margin-bottom:22px">
          ${[0,1,2,3].map(i => `
            <div style="width:14px;height:14px;border-radius:50%;background:${i < pinBuffer.length ? "var(--accent)" : "oklch(0.9 0.01 75)"};transition:background .15s"></div>
          `).join("")}
        </div>
        ${errorMsg ? `<div style="text-align:center;color:var(--destructive);font-size:13px;margin-bottom:12px">${errorMsg}</div>` : ""}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          ${["1","2","3","4","5","6","7","8","9","","0","⌫"].map(k => `
            <button data-key="${k}" style="
              padding:16px;border-radius:12px;border:none;
              background:${k ? "oklch(0.96 0.008 75)" : "transparent"};
              font-family:var(--font-display);font-weight:700;font-size:18px;
              cursor:${k ? "pointer" : "default"};color:var(--text-primary)">
              ${k}
            </button>
          `).join("")}
        </div>
      </div>`;

    area.querySelectorAll("[data-key]").forEach(btn => {
      const key = (btn as HTMLElement).dataset.key!;
      if (!key) return;
      btn.addEventListener("click", () => pressPin(key));
    });
  }

  async function pressPin(key: string) {
    if (key === "⌫") {
      pinBuffer = pinBuffer.slice(0, -1);
      errorMsg = "";
      renderPinArea();
      return;
    }
    if (pinBuffer.length >= 4) return;
    pinBuffer += key;
    renderPinArea();

    if (pinBuffer.length === 4) {
      try {
        const session = await api.login(selectedId!, pinBuffer);
        onLogin(session);
      } catch {
        const card = document.getElementById("pin-card");
        if (card) { card.classList.add("shake"); setTimeout(() => card.classList.remove("shake"), 600); }
        setTimeout(() => {
          pinBuffer = "";
          errorMsg = "PIN incorrecto";
          renderPinArea();
        }, 400);
      }
    }
  }

  render();
}
