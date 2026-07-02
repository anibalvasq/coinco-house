import { api, HistoryRow } from "../api/client.js";

export async function renderHistory(
  onJumpToMonth: (key: string) => void
): Promise<string | null> {
  let rows: HistoryRow[];
  try {
    rows = await api.getHistory();
  } catch (e: any) {
    if (e?.status === 401) return "logout";
    return null;
  }

  if (!rows.length) {
    return `
      <div style="text-align:center;padding:60px 20px;background:#fff;border-radius:var(--radius-card);margin-top:8px;box-shadow:var(--shadow-card)">
        <div class="font-display" style="font-weight:700;font-size:17px;margin-bottom:8px">Sin historial aún</div>
        <div style="font-size:14px;color:var(--text-secondary)">Los meses con cuentas aparecerán aquí.</div>
      </div>`;
  }

  const items = rows.map(r => `
    <div data-jump="${r.month_key}" class="list-row" style="cursor:pointer">
      <div style="flex:1">
        <div style="font-size:15px;font-weight:600;text-transform:capitalize">${r.month_label}</div>
        <div style="font-size:12px;color:var(--text-caption)">${r.bills_count} cuenta${r.bills_count !== 1 ? "s" : ""}</div>
      </div>
      <div style="font-weight:700;font-size:14px">${r.total_amount_fmt}</div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`).join("");

  return `<div class="card" style="padding:6px 18px;margin-top:4px">${items}</div>`;
}

export function bindHistoryEvents(onJumpToMonth: (key: string) => void) {
  document.querySelectorAll("[data-jump]").forEach(el => {
    el.addEventListener("click", () => onJumpToMonth((el as HTMLElement).dataset.jump!));
  });
}
