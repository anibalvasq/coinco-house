import { api, Person } from "../api/client.js";
import { initial, AVATAR_PALETTE } from "../state.js";

export async function renderLogin(onLogin: (session: { id: string; name: string; color: string }) => void) {
  const app = document.getElementById("app")!;

  let people: Person[] = [];
  try {
    people = await api.listPeople();
  } catch {
    // no session needed for people list (public endpoint would be needed in production;
    // for now we attempt a direct fetch with no auth to let the screen load)
  }

  let selectedId: string | null = null;
  let pinBuffer = "";
  let errorMsg = "";

  function render() {
    app.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;padding:64px 26px 32px">
        <div style="margin-bottom:36px">
          <div class="font-display" style="font-weight:700;font-size:25px">Hogar Compartido</div>
          <div style="font-size:14.5px;color:var(--text-secondary);margin-top:6px">Selecciona tu perfil para continuar</div>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:26px" id="profile-cards"></div>

        <div id="pin-area"></div>
      </div>
    `;

    renderProfileCards();
    if (selectedId) renderPinArea();
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
