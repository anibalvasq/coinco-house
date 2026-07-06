import { api, DashboardData } from "../api/client.js";
import { initial } from "../state.js";

/**
 * SVG donut chart built with stroke-dasharray/dashoffset — no external libs.
 * r=54 → circumference = 2π×54 ≈ 339.29
 */
function buildDonutChart(slices: { color: string; pct: number }[]): string {
  const R = 54;
  const C = 2 * Math.PI * R;
  const GAP = 3; // gap between slices in px
  const cx = 70, cy = 70;

  let offset = 0; // tracks dashoffset rotation (starts at top: -C/4)
  const arcs = slices.map(s => {
    const arcLen = Math.max(0, s.pct * C - GAP);
    const svg = `<circle
      cx="${cx}" cy="${cy}" r="${R}"
      fill="none"
      stroke="${s.color}"
      stroke-width="16"
      stroke-dasharray="${arcLen} ${C - arcLen}"
      stroke-dashoffset="${-(offset - C / 4)}"
      stroke-linecap="round"
    />`;
    offset += s.pct * C;
    return svg;
  });

  return `
    <svg width="140" height="140" viewBox="0 0 140 140" style="display:block">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="oklch(0.93 0.01 75)" stroke-width="16"/>
      ${arcs.join("")}
    </svg>`;
}

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

  const donut = buildDonutChart(
    data.split_preview.map(p => ({ color: p.color, pct: p.pct }))
  );

  const legend = data.split_preview.map(p => `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:10px;height:10px;border-radius:50%;background:${p.color};flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${p.name}</div>
        <div style="font-size:11px;color:var(--text-caption)">${(p.pct * 100).toFixed(1)}%</div>
      </div>
      <div style="font-size:14px;font-weight:700">${p.amount_fmt}</div>
    </div>`).join("");

  return `
    <div class="hero-card">
      <div class="hero-total-label">Total gastado</div>
      <div class="hero-total-amount font-display">${data.total_amount_fmt}</div>
      <div class="hero-subtitle">${data.bills_count_label}</div>
    </div>

    <div class="section-title">Reparto rápido</div>
    <div class="card" style="padding:20px 18px">
      <div style="display:flex;align-items:center;gap:20px">
        <div style="position:relative;flex-shrink:0">
          ${donut}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:14px">
          ${legend}
        </div>
      </div>
      <button id="dash-split-btn" class="btn-outline" style="width:100%;padding:12px;margin-top:18px">Ver reparto completo →</button>
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
