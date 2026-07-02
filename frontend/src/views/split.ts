import { api, SplitResult } from "../api/client.js";
import { initial } from "../state.js";

export async function renderSplit(
  month: string,
  onGoToDays: () => void
): Promise<string | null> {
  let data: SplitResult;
  try {
    data = await api.getSplit(month);
  } catch (e: any) {
    if (e?.status === 401) return "logout";
    return null;
  }

  const warningHtml = data.equal_split_warning ? `
    <div style="background:oklch(0.97 0.03 75);border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:oklch(0.45 0.06 75)">
      No hay días registrados: el reparto se muestra en partes iguales.
      <a id="goto-days" href="#" style="color:inherit;font-weight:700"> Registrar días →</a>
    </div>` : "";

  const maxAmount = Math.max(...data.per_person.map(p => p.amount), 1);

  const perPersonHtml = data.per_person.map(p => `
    <div class="card" style="padding:18px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div class="avatar" style="background:${p.color}">${initial(p.name)}</div>
        <div style="flex:1">
          <div style="font-size:14.5px;font-weight:600">${p.name}</div>
          <div style="font-size:12px;color:var(--text-caption)">${p.days} días · ${p.pct}%</div>
        </div>
        <div class="font-display" style="font-weight:700;font-size:18px">${p.amount_fmt}</div>
      </div>
      <div class="progress-track" style="height:8px">
        <div class="progress-fill" style="width:${(p.amount / maxAmount) * 100}%;background:${p.color}"></div>
      </div>
    </div>`).join("");

  const billDetailsHtml = data.bill_details.length ? `
    <div class="section-title">Detalle por cuenta</div>
    ${data.bill_details.map(b => `
      <div class="card" style="padding:14px 18px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div>
            <div style="font-size:14px;font-weight:600">${b.name}</div>
            <div style="font-size:12px;color:var(--text-caption)">${b.category_name}</div>
          </div>
          <div style="font-weight:700;font-size:14px">${b.amount_fmt}</div>
        </div>
        <div style="font-size:12px;color:var(--text-caption)">
          ${b.per_person.map(pp => `${pp.name} ${pp.amount_fmt}`).join(" · ")}
        </div>
      </div>`).join("")}` : "";

  return `
    <div class="hero-card" style="margin-top:4px">
      <div class="hero-total-label">Total del mes</div>
      <div class="hero-total-amount font-display">${data.total_amount_fmt}</div>
    </div>

    ${warningHtml}

    <div class="section-title">Por persona</div>
    ${perPersonHtml}
    ${billDetailsHtml}`;
}

export function bindSplitEvents(onGoToDays: () => void) {
  document.getElementById("goto-days")?.addEventListener("click", (e) => {
    e.preventDefault();
    onGoToDays();
  });
}
