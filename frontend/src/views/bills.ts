import { api, Bill, Category } from "../api/client.js";

export async function renderBills(
  month: string,
  onEdit: (bill: Bill) => void,
  onDelete: (id: string) => void,
  onAdd: () => void
): Promise<string | null> {
  let bills: Bill[];
  let cats: Category[];
  try {
    [bills, cats] = await Promise.all([api.listBills(month), api.listCategories()]);
  } catch (e: any) {
    if (e?.status === 401) return "logout";
    return null;
  }

  const catMap = Object.fromEntries(cats.map(c => [c.id, c]));

  if (!bills.length) {
    return `
      <div style="text-align:center;padding:60px 20px;background:#fff;border-radius:var(--radius-card);margin-top:8px;box-shadow:var(--shadow-card)">
        <div class="font-display" style="font-weight:700;font-size:17px;margin-bottom:8px">No hay cuentas este mes</div>
        <button id="bills-add-btn" class="btn-accent" style="margin-top:12px">+ Agregar cuenta</button>
      </div>`;
  }

  const rows = bills.map(b => {
    const cat = catMap[b.category_id];
    const dateLabel = formatDateShort(b.date);
    const displayName = b.name || cat?.name || "";
    return `
      <div class="list-row">
        <div style="width:32px;height:32px;border-radius:10px;background:oklch(0.93 0.01 75);
             display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
             color:var(--text-secondary);flex-shrink:0">${cat?.name[0] || "?"}</div>
        <div data-edit="${b.id}" style="flex:1;min-width:0;cursor:pointer">
          <div style="font-size:14.5px;font-weight:600">${displayName}</div>
          <div style="font-size:12px;color:var(--text-caption)">${cat?.name || ""} · ${dateLabel}</div>
        </div>
        <div style="font-weight:700;font-size:14.5px">${fmtCLP(b.amount)}</div>
        <button data-delete="${b.id}" style="border:none;background:none;color:oklch(0.65 0.02 25);cursor:pointer;font-size:17px;padding:4px">✕</button>
      </div>`;
  }).join("");

  return `<div class="card" style="padding:6px 18px;margin-top:4px">${rows}</div>`;
}

export function bindBillsEvents(
  bills: Bill[],
  onEdit: (bill: Bill) => void,
  onDelete: (id: string) => void,
  onAdd: () => void
) {
  document.getElementById("bills-add-btn")?.addEventListener("click", onAdd);
  document.querySelectorAll("[data-edit]").forEach(el => {
    const id = (el as HTMLElement).dataset.edit!;
    el.addEventListener("click", () => {
      const bill = bills.find(b => b.id === id);
      if (bill) onEdit(bill);
    });
  });
  document.querySelectorAll("[data-delete]").forEach(el => {
    const id = (el as HTMLElement).dataset.delete!;
    el.addEventListener("click", () => onDelete(id));
  });
}

function fmtCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Math.round(amount));
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const [, m, d] = dateStr.split("-");
  return `${Number(d)} ${months[Number(m) - 1]}`;
}
