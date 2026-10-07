// tokens.css loaded via index.html <link>
import { Capacitor } from "@capacitor/core";
import { api, ApiError, Bill, Person } from "./api/client.js";
import { AppState, Route, PeopleTab, currentMonthKey, shiftMonth, monthLabel, initial } from "./state.js";
import { icons } from "./components/icons.js";
import { renderLogin } from "./views/login.js";
import { renderDashboard, bindDashboardEvents } from "./views/dashboard.js";
import { renderBills, bindBillsEvents } from "./views/bills.js";
import { renderPeople, bindPeopleEvents } from "./views/people.js";
import { renderSplit, bindSplitEvents } from "./views/split.js";
import { renderHistory, bindHistoryEvents } from "./views/history.js";
import { openBillModal } from "./components/billModal.js";
import { openPersonModal } from "./components/personModal.js";
import { getPushStatus, enablePush, disablePush, syncPushSubscription } from "./push.js";

// ── App state ────────────────────────────────────────────────
const state: AppState = {
  session: null,
  route: "dashboard",
  viewingMonth: currentMonthKey(),
  peopleTab: "personas",
  modal: null,
  editingId: null,
  showUserMenu: false,
  pushStatus: null,
};

const SCREEN_TITLES: Record<Route, string> = {
  dashboard: "Inicio",
  bills: "Cuentas",
  people: "Personas",
  split: "Reparto",
  history: "Historial",
};

const NAV_ITEMS: { id: Route; label: string; icon: string }[] = [
  { id: "dashboard", label: "Inicio",    icon: icons.home },
  { id: "bills",     label: "Cuentas",   icon: icons.bills },
  { id: "people",    label: "Personas",  icon: icons.people },
  { id: "split",     label: "Reparto",   icon: icons.split },
  { id: "history",   label: "Historial", icon: icons.history },
];

const showMonthSelectorOn: Route[] = ["dashboard", "bills", "split"];

// ── Render helpers ───────────────────────────────────────────
const MENU_BTN = `width:100%;text-align:left;padding:9px 10px;border:none;background:none;
  border-radius:8px;font-family:var(--font-body);font-size:14px;color:var(--text-primary);cursor:pointer`;
const MENU_NOTE = `padding:8px 10px;font-size:12px;line-height:1.4;color:var(--text-secondary)`;

function buildPushMenu(): string {
  switch (state.pushStatus) {
    case "off":
      return `<button id="push-enable-btn" style="${MENU_BTN}">🔔 Activar notificaciones</button>`;
    case "on":
      return `
        <div style="${MENU_NOTE}">🔔 Notificaciones activadas</div>
        <button id="push-test-btn" style="${MENU_BTN}">Enviar prueba</button>
        <button id="push-disable-btn" style="${MENU_BTN}">Desactivar notificaciones</button>`;
    case "denied":
      return `<div style="${MENU_NOTE}">🔕 Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador.</div>`;
    case "ios-install":
      return `<div style="${MENU_NOTE}">🔔 Para recibir notificaciones, agrega la app a tu pantalla de inicio: Compartir → Agregar a inicio.</div>`;
    default:
      return "";
  }
}

function buildShell(): string {
  const showMonth = showMonthSelectorOn.includes(state.route) ||
    (state.route === "people" && state.peopleTab === "dias");
  const isCurrent = state.viewingMonth === currentMonthKey();

  const monthSwitcher = showMonth ? `
    <div class="month-switcher">
      <button class="nav-arrow" id="prev-month">‹</button>
      <div class="month-label-text">${monthLabel(state.viewingMonth)}</div>
      <button class="nav-arrow" id="next-month">›</button>
      ${!isCurrent ? `<button class="today-btn" id="go-today">Hoy</button>` : ""}
    </div>` : "";

  const navItems = NAV_ITEMS.map(n => `
    <button data-nav="${n.id}" class="${n.id === state.route ? "active" : ""}">
      ${n.icon}<span>${n.label}</span>
    </button>`).join("");

  const showFab = state.route === "dashboard" || state.route === "bills" ||
    (state.route === "people" && state.peopleTab === "personas");
  const fab = showFab ? `<button class="fab" id="fab-btn">+</button>` : "";

  return `
    <div class="screen-header">
      <div class="screen-title">${SCREEN_TITLES[state.route]}</div>
      <div style="position:relative">
        <button id="avatar-btn" style="width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;
          background:${state.session?.color || "var(--accent)"};
          font-family:var(--font-display);font-weight:700;font-size:14px;color:#fff">
          ${initial(state.session?.name || "?")}
        </button>
        ${state.showUserMenu ? `
        <div class="dropdown-menu">
          <div style="padding:8px 10px;font-size:13px;color:var(--text-secondary);border-bottom:1px solid var(--divider2);margin-bottom:4px">${state.session?.name || ""}</div>
          ${buildPushMenu()}
          <button id="logout-btn" style="width:100%;text-align:left;padding:9px 10px;border:none;background:none;
            border-radius:8px;font-family:var(--font-body);font-size:14px;color:var(--destructive);cursor:pointer">
            Cerrar sesión
          </button>
        </div>` : ""}
      </div>
    </div>
    ${monthSwitcher}
    <div class="screen-scroll" id="screen-content">
      <div style="padding:40px;text-align:center;color:var(--text-caption)">Cargando…</div>
    </div>
    <nav class="bottom-nav">${navItems}</nav>
    ${fab}`;
}

async function renderScreen() {
  const content = document.getElementById("screen-content");
  if (!content) return;

  const route = state.route;
  const month = state.viewingMonth;

  let html: string | null = "";

  if (route === "dashboard") {
    html = await renderDashboard(month, navigate);
    if (html === "logout") { doLogout(); return; }
    content.innerHTML = html || "";
    bindDashboardEvents(navigate, () => openBillModal(month, null, () => { renderScreen(); }, () => {}));

  } else if (route === "bills") {
    let bills: Bill[] = [];
    try { bills = await api.listBills(month); } catch {}
    html = await renderBills(month,
      (bill) => openBillModal(month, bill, () => renderScreen(), () => {}),
      async (id) => { await api.deleteBill(id); renderScreen(); },
      () => openBillModal(month, null, () => renderScreen(), () => {})
    );
    if (html === "logout") { doLogout(); return; }
    content.innerHTML = html || "";
    bindBillsEvents(bills,
      (bill) => openBillModal(month, bill, () => renderScreen(), () => {}),
      async (id) => { await api.deleteBill(id); renderScreen(); },
      () => openBillModal(month, null, () => renderScreen(), () => {})
    );

  } else if (route === "people") {
    let people: Person[] = [];
    let stays: Record<string, number> = {};
    try {
      people = await api.listPeople();
      if (state.peopleTab === "dias") stays = await api.getStays(month);
    } catch {}

    html = await renderPeople(
      state.peopleTab,
      month,
      (person) => openPersonModal(person, people.length > 1, () => renderScreen(), () => {}),
      (tab) => { state.peopleTab = tab; renderScreen(); }
    );
    if (html === "logout") { doLogout(); return; }
    content.innerHTML = html || "";
    bindPeopleEvents(
      people, stays, month,
      (person) => openPersonModal(person, people.length > 1, () => renderScreen(), () => {}),
      (tab) => { state.peopleTab = tab; renderScreen(); },
      () => {}
    );

  } else if (route === "split") {
    html = await renderSplit(month, () => { state.route = "people"; state.peopleTab = "dias"; rerender(); });
    if (html === "logout") { doLogout(); return; }
    content.innerHTML = html || "";
    bindSplitEvents(() => { state.route = "people"; state.peopleTab = "dias"; rerender(); });

  } else if (route === "history") {
    html = await renderHistory((key) => { state.viewingMonth = key; state.route = "split"; rerender(); });
    if (html === "logout") { doLogout(); return; }
    content.innerHTML = html || "";
    bindHistoryEvents((key) => { state.viewingMonth = key; state.route = "split"; rerender(); });
  }
}

function rerender() {
  const app = document.getElementById("app")!;
  app.innerHTML = buildShell();
  bindShellEvents();
  renderScreen();
}

function bindShellEvents() {
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const r = (btn as HTMLElement).dataset.nav as Route;
      navigate(r);
    });
  });

  document.getElementById("prev-month")?.addEventListener("click", () => {
    state.viewingMonth = shiftMonth(state.viewingMonth, -1);
    rerender();
  });
  document.getElementById("next-month")?.addEventListener("click", () => {
    state.viewingMonth = shiftMonth(state.viewingMonth, 1);
    rerender();
  });
  document.getElementById("go-today")?.addEventListener("click", () => {
    state.viewingMonth = currentMonthKey();
    rerender();
  });

  document.getElementById("avatar-btn")?.addEventListener("click", () => {
    state.showUserMenu = !state.showUserMenu;
    rerender();
    if (state.showUserMenu) {
      getPushStatus().then((status) => {
        state.pushStatus = status;
        if (state.showUserMenu) rerender();
      });
    }
  });
  document.getElementById("push-enable-btn")?.addEventListener("click", async () => {
    try {
      state.pushStatus = await enablePush();
    } catch {
      alert("No se pudieron activar las notificaciones. Intenta de nuevo.");
    }
    rerender();
  });
  document.getElementById("push-disable-btn")?.addEventListener("click", async () => {
    await disablePush();
    state.pushStatus = "off";
    rerender();
  });
  document.getElementById("push-test-btn")?.addEventListener("click", async () => {
    state.showUserMenu = false;
    rerender();
    try { await api.pushTest(); } catch {}
  });
  document.getElementById("logout-btn")?.addEventListener("click", doLogout);

  document.getElementById("fab-btn")?.addEventListener("click", () => {
    if (state.route === "people") {
      openPersonModal(null, true, () => renderScreen(), () => {});
    } else {
      openBillModal(state.viewingMonth, null, () => renderScreen(), () => {});
    }
  });
}

function navigate(route: string, opts?: { month?: string }) {
  state.route = route as Route;
  state.showUserMenu = false;
  if (opts?.month) state.viewingMonth = opts.month;
  rerender();
}

async function doLogout() {
  // Shared phones: stop this device from receiving the previous person's notifications
  try { await disablePush(); } catch {}
  try { await api.logout(); } catch {}
  state.session = null;
  startLoginFlow();
}

// ── Bootstrap ─────────────────────────────────────────────────
async function boot() {
  // Check for existing session
  try {
    const me = await api.me();
    state.session = me;
    rerender();
    void syncPushSubscription();
  } catch {
    startLoginFlow();
  }
}

function startLoginFlow() {
  renderLogin((session) => {
    state.session = session;
    rerender();
    void syncPushSubscription();
  });
}

boot();

// Native shell polish (iOS/Android via Capacitor)
if (Capacitor.isNativePlatform()) {
  import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  });
} else if (import.meta.env.PROD && import.meta.env.MODE !== "mobile" && "serviceWorker" in navigator) {
  // PWA: offline app shell + installability (Chrome/Android "Instalar app")
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
