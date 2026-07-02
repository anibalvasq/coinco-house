import { api, Person } from "../api/client.js";
import { initial } from "../state.js";

export async function renderPeople(
  tab: "personas" | "dias",
  month: string,
  onEdit: (person: Person) => void,
  onTabChange: (tab: "personas" | "dias") => void
): Promise<string | null> {
  let people: Person[];
  let stays: Record<string, number> = {};
  try {
    people = await api.listPeople();
    if (tab === "dias") stays = await api.getStays(month);
  } catch (e: any) {
    if (e?.status === 401) return "logout";
    return null;
  }

  const tabsHtml = `
    <div class="tab-bar">
      <button data-tab="personas" class="${tab === "personas" ? "active" : ""}">Personas</button>
      <button data-tab="dias" class="${tab === "dias" ? "active" : ""}">Días en estancia</button>
    </div>`;

  let content = "";
  if (tab === "personas") {
    content = `
      <div class="card" style="padding:6px 18px">
        ${people.map(p => `
          <div class="list-row">
            <div class="avatar" style="background:${p.color}">${initial(p.name)}</div>
            <div style="flex:1">
              <div style="font-size:14.5px;font-weight:600">${p.name}</div>
              <div style="font-size:12px;color:var(--text-caption)">PIN ••••</div>
            </div>
            <button data-edit="${p.id}" style="border:none;background:oklch(0.94 0.01 75);border-radius:10px;padding:8px 10px;cursor:pointer;font-size:13px">Editar</button>
          </div>`).join("")}
      </div>`;
  } else {
    const totalDays = people.reduce((s, p) => s + (stays[p.id] || 0), 0);
    content = `
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">
        El reparto se calcula según los días que cada persona estuvo en casa este mes.
      </div>
      <div class="card" style="padding:6px 18px">
        ${people.map(p => `
          <div class="list-row">
            <div class="avatar" style="background:${p.color}">${initial(p.name)}</div>
            <div style="flex:1;font-size:14.5px;font-weight:600">${p.name}</div>
            <div class="stepper">
              <button data-minus="${p.id}">–</button>
              <input data-days="${p.id}" type="number" value="${stays[p.id] || 0}" min="0" max="31" />
              <button data-plus="${p.id}">+</button>
            </div>
          </div>`).join("")}
      </div>
      <div style="text-align:center;font-size:12.5px;color:var(--text-caption);margin-top:12px">Total días registrados: ${totalDays}</div>`;
  }

  return `${tabsHtml}${content}`;
}

export function bindPeopleEvents(
  people: Person[],
  stays: Record<string, number>,
  month: string,
  onEdit: (person: Person) => void,
  onTabChange: (tab: "personas" | "dias") => void,
  onStaysChange: (stays: Record<string, number>) => void
) {
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => onTabChange((btn as HTMLElement).dataset.tab as "personas" | "dias"));
  });

  document.querySelectorAll("[data-edit]").forEach(el => {
    const id = (el as HTMLElement).dataset.edit!;
    el.addEventListener("click", () => {
      const person = people.find(p => p.id === id);
      if (person) onEdit(person);
    });
  });

  document.querySelectorAll("[data-days]").forEach(input => {
    const id = (input as HTMLInputElement).dataset.days!;
    input.addEventListener("change", async () => {
      const val = Math.max(0, Math.min(31, Number((input as HTMLInputElement).value)));
      (input as HTMLInputElement).value = String(val);
      const updated = { ...stays, [id]: val };
      try {
        await api.updateStays(month, updated);
        onStaysChange(updated);
      } catch {}
    });
  });

  document.querySelectorAll("[data-minus]").forEach(btn => {
    const id = (btn as HTMLElement).dataset.minus!;
    btn.addEventListener("click", async () => {
      const input = document.querySelector<HTMLInputElement>(`[data-days="${id}"]`);
      if (!input) return;
      const val = Math.max(0, Number(input.value) - 1);
      input.value = String(val);
      const updated = { ...stays, [id]: val };
      try { await api.updateStays(month, updated); onStaysChange(updated); } catch {}
    });
  });

  document.querySelectorAll("[data-plus]").forEach(btn => {
    const id = (btn as HTMLElement).dataset.plus!;
    btn.addEventListener("click", async () => {
      const input = document.querySelector<HTMLInputElement>(`[data-days="${id}"]`);
      if (!input) return;
      const val = Math.min(31, Number(input.value) + 1);
      input.value = String(val);
      const updated = { ...stays, [id]: val };
      try { await api.updateStays(month, updated); onStaysChange(updated); } catch {}
    });
  });
}
