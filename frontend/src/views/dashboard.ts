import { api, DashboardData } from "../api/client.js";
import { initial } from "../state.js";

export async function renderDashboard(
  month: string,
  onNavigate: (route: string, opts?: { month?: string }) => void
): Promise<string | null> {
  let data: DashboardData;
  try {
    data = await api.getDashboard(month);
  } catch (e: any) {
    if (e?.status === 401) return "logout";
    return null;
  }

  const splitRows = data.split_preview.map(p => `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div class="avatar" style="background:${p.color}">${initial(p.name)}</div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:600">
          <span>${p.name}</span><span>${p.amount_fmt}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${p.pct}%;background:${p.color}"></div>
        </div>
      </div>
    </div>`).join("");

  const recentRows = data.recent_bills.map(b => `
    <div class="list-row">
      <div style="width:32px;height:32px;border-radius:10px;background:oklch(0.93 0.01 75);
           display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
           color:var(--text-secondary)">${b.category_name[0] || "?"}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600">${b.name || b.category_name}</div>
        <div style="font-size:12px;color:var(--text-caption)">${b.date_label}</div>
      </div>
      <div style="font-weight:700;font-size:14px">${b.amount_fmt}</div>
    </div>`).join("");

  if (!data.has_bills) {
    return `
      <div style="text-align:center;padding:60px 20px;background:#fff;border-radius:var(--radius-card);margin-top:8px;box-shadow:var(--shadow-card)">
        <div class="font-display" style="font-weight:700;font-size:17px;margin-bottom:8px">Aún no hay cuentas este mes</div>
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:20px">Registra luz, agua, internet o lo que gastes para calcular el reparto.</div>
        <button id="dash-add-btn" class="btn-accent">+ Agregar primera cuenta</button>
      </div>`;
  }

  return `
    <div class="hero-card">
      <div class="hero-total-label">Total gastado</div>
      <div class="hero-total-amount font-display">${data.total_amount_fmt}</div>
      <div class="hero-subtitle">${data.bills_count_label}</div>
    </div>

    <div class="section-title">Reparto rápido</div>
    <div class="card" style="padding:18px">
      ${splitRows}
      <button id="dash-split-btn" class="btn-outline" style="width:100%;padding:12px">Ver reparto completo →</button>
    </div>

    ${data.recent_bills.length ? `
    <div class="section-title">Últimas cuentas</div>
    <div class="card" style="padding:6px 18px">
      ${recentRows}
      <button id="dash-bills-btn" style="width:100%;padding:12px 0;border:none;background:none;
        font-family:var(--font-body);font-weight:600;font-size:13px;cursor:pointer;color:var(--accent)">
        Ver todas →
      </button>
    </div>` : ""}`;
}

export function bindDashboardEvents(onNavigate: (route: string) => void, onAddBill: () => void) {
  document.getElementById("dash-add-btn")?.addEventListener("click", onAddBill);
  document.getElementById("dash-split-btn")?.addEventListener("click", () => onNavigate("split"));
  document.getElementById("dash-bills-btn")?.addEventListener("click", () => onNavigate("bills"));
}
