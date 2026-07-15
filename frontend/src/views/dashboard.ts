import { api, DashboardData, HistoryRow } from "../api/client.js";

const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const YEAR_BAR_MAX = 72;
const YEAR_BAR_PEAK = "oklch(0.78 0.06 75)";
const YEAR_BAR_EMPTY = "oklch(0.90 0.01 75)";

/**
 * SVG donut chart built with stroke-dasharray/dashoffset — no external libs.
 * r=54 → circumference = 2π×54 ≈ 339.29
 *
 * Rules:
 * - stroke-linecap="butt" (default): avoids round caps bleeding over adjacent arcs.
 * - GAP must be > 0 so adjacent arcs don't visually merge.
 * - Colors are guaranteed distinct via FALLBACK_COLORS if person colors are similar.
 */
const DONUT_COLORS = ["#3b82f6", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#eab308"];

function buildDonutChart(slices: { color: string; pct: number }[]): string {
  const R = 54;
  const C = 2 * Math.PI * R;
  const GAP = 6; // px gap between slices (must be > stroke-width/2 for butt caps to show gap)
  const cx = 70, cy = 70;

  // Always use chart-specific distinct colors — person avatar colors can be too similar
  const colors = slices.map((_s, i) => DONUT_COLORS[i % DONUT_COLORS.length]);

  let offset = 0;
  const arcs = slices.map((s, i) => {
    const arcLen = Math.max(0, s.pct * C - GAP);
    // dashoffset: shift so first arc starts at 12-o'clock (top = -C/4 from 3-o'clock origin)
    const dashoffset = -(offset * C - C / 4);
    const svg = `<circle
      cx="${cx}" cy="${cy}" r="${R}"
      fill="none"
      stroke="${colors[i]}"
      stroke-width="18"
      stroke-dasharray="${arcLen.toFixed(2)} ${(C - arcLen).toFixed(2)}"
      stroke-dashoffset="${dashoffset.toFixed(2)}"
    />`;
    offset += s.pct;
    return svg;
  });

  return `
    <svg width="140" height="140" viewBox="0 0 140 140" style="display:block">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#f0f0ec" stroke-width="18"/>
      ${arcs.join("")}
    </svg>`;
}

function buildYearChart(history: HistoryRow[], year: string, viewingMonth: string): string {
  const totals = new Map<string, number>();
  for (const row of history) {
    if (row.month_key.startsWith(`${year}-`)) {
      totals.set(row.month_key, row.total_amount);
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { key, label: MONTH_SHORT[i], amount: totals.get(key) ?? 0 };
  });

  const maxAmount = Math.max(...months.map(m => m.amount), 1);

  const bars = months.map(m => {
    const hasData = m.amount > 0;
    const isCurrent = m.key === viewingMonth;
    const height = hasData
      ? Math.max(8, Math.round((m.amount / maxAmount) * YEAR_BAR_MAX))
      : 4;
    const bg = !hasData
      ? YEAR_BAR_EMPTY
      : isCurrent
        ? "var(--accent)"
        : YEAR_BAR_PEAK;
    const title = hasData ? `${m.label} · ${fmtCLP(m.amount)}` : m.label;

    return `
      <button type="button" data-year-jump="${m.key}" title="${title}" aria-label="${title}"
        style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;
               border:none;background:none;padding:0;cursor:pointer;min-width:0">
        <div style="height:${YEAR_BAR_MAX}px;display:flex;align-items:flex-end;width:100%;justify-content:center">
          <div style="width:100%;max-width:22px;height:${height}px;border-radius:999px;background:${bg}"></div>
        </div>
        <span style="font-size:10px;color:${isCurrent ? "var(--accent)" : "var(--text-caption)"};
                     font-weight:${isCurrent ? "700" : "500"}">${m.label}</span>
      </button>`;
  }).join("");

  return `
    <div class="section-title">Resumen ${year}</div>
    <div class="card" style="padding:18px 14px 14px">
      <div style="display:flex;align-items:flex-end;gap:4px">${bars}</div>
    </div>`;
}

function fmtCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function buildFixedVariableCard(fv: DashboardData["fixed_variable"]): string {
  const fixedWidth = fv.fixed_pct;
  const variableWidth = fv.variable_pct;
  const showFixed = fixedWidth > 0;
  const showVariable = variableWidth > 0;

  const barSegments = [
    showFixed
      ? `<div style="width:${fixedWidth}%;background:var(--accent);height:100%"></div>`
      : "",
    showVariable
      ? `<div style="width:${variableWidth}%;background:oklch(0.90 0.01 75);height:100%"></div>`
      : "",
  ].join("");

  const bar = showFixed || showVariable
    ? `<div style="display:flex;height:14px;border-radius:999px;overflow:hidden;background:oklch(0.90 0.01 75)">${barSegments}</div>`
    : `<div style="height:14px;border-radius:999px;background:oklch(0.90 0.01 75)"></div>`;

  return `
    <div class="section-title">Fijos vs. variables</div>
    <div class="card" style="padding:18px">
      ${bar}
      <div style="display:flex;justify-content:space-between;margin-top:16px;gap:16px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <div style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0"></div>
            <span style="font-size:12px;font-weight:600;color:var(--text-secondary)">Fijos · ${fv.fixed_pct.toFixed(1)}%</span>
          </div>
          <div style="font-size:15px;font-weight:700">${fv.fixed_total_fmt}</div>
        </div>
        <div style="flex:1;text-align:right">
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-bottom:4px">
            <span style="font-size:12px;font-weight:600;color:var(--text-secondary)">Variables · ${fv.variable_pct.toFixed(1)}%</span>
            <div style="width:8px;height:8px;border-radius:50%;background:oklch(0.90 0.01 75);flex-shrink:0"></div>
          </div>
          <div style="font-size:15px;font-weight:700">${fv.variable_total_fmt}</div>
        </div>
      </div>
    </div>`;
}

export async function renderDashboard(
  month: string,
  onNavigate: (route: string, opts?: { month?: string }) => void
): Promise<string | null> {
  let data: DashboardData;
  let history: HistoryRow[];
  try {
    [data, history] = await Promise.all([api.getDashboard(month), api.getHistory()]);
  } catch (e: any) {
    if (e?.status === 401) return "logout";
    return null;
  }

  const year = month.split("-")[0];
  const yearChart = buildYearChart(history, year, month);

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
      <div class="hero-card">
        <div class="hero-total-label">Total gastado</div>
        <div class="hero-total-amount font-display">${data.total_amount_fmt}</div>
        <div class="hero-subtitle">${data.bills_count_label}</div>
      </div>

      ${yearChart}

      <div style="text-align:center;padding:40px 20px;background:#fff;border-radius:var(--radius-card);margin-top:4px;box-shadow:var(--shadow-card)">
        <div class="font-display" style="font-weight:700;font-size:17px;margin-bottom:8px">Aún no hay cuentas este mes</div>
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:20px">Registra luz, agua, internet o lo que gastes para calcular el reparto.</div>
        <button id="dash-add-btn" class="btn-accent">+ Agregar primera cuenta</button>
      </div>`;
  }

  // Effective share based on actual amounts — respects per-bill split_mode
  const effectivePcts = data.total_amount > 0
    ? data.split_preview.map(p => (p.amount / data.total_amount) * 100)
    : data.split_preview.map(() => 100 / data.split_preview.length);

  const donut = buildDonutChart(
    data.split_preview.map((p, i) => ({ color: p.color, pct: effectivePcts[i] / 100 }))
  );

  const legend = data.split_preview.map((p, i) => `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:10px;height:10px;border-radius:50%;background:${DONUT_COLORS[i % DONUT_COLORS.length]};flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${p.name}</div>
        <div style="font-size:11px;color:var(--text-caption)">${effectivePcts[i].toFixed(1)}%</div>
      </div>
      <div style="font-size:14px;font-weight:700">${p.amount_fmt}</div>
    </div>`).join("");

  return `
    <div class="hero-card">
      <div class="hero-total-label">Total gastado</div>
      <div class="hero-total-amount font-display">${data.total_amount_fmt}</div>
      <div class="hero-subtitle">${data.bills_count_label}</div>
    </div>

    ${yearChart}

    ${buildFixedVariableCard(data.fixed_variable)}

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

export function bindDashboardEvents(
  onNavigate: (route: string, opts?: { month?: string }) => void,
  onAddBill: () => void,
) {
  document.getElementById("dash-add-btn")?.addEventListener("click", onAddBill);
  document.getElementById("dash-split-btn")?.addEventListener("click", () => onNavigate("split"));
  document.getElementById("dash-bills-btn")?.addEventListener("click", () => onNavigate("bills"));
  document.querySelectorAll("[data-year-jump]").forEach(el => {
    el.addEventListener("click", () => {
      const key = (el as HTMLElement).dataset.yearJump!;
      onNavigate("dashboard", { month: key });
    });
  });
}
