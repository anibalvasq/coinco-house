import { api, Bill, BillCreate, Category } from "../api/client.js";
import { todayStr, CAT_PALETTE } from "../state.js";

export function openBillModal(
  month: string,
  editing: Bill | null,
  onSaved: () => void,
  onClosed: () => void
) {
  let categories: Category[] = [];
  let showNewCatInput = false;
  let newCatName = "";

  async function load() {
    categories = await api.listCategories();
    render();
  }

  function render() {
    const draft: Partial<BillCreate & { id: string }> = editing ? {
      id: editing.id,
      category_id: editing.category_id,
      name: editing.name,
      amount: editing.amount,
      date: editing.date,
      note: editing.note,
    } : {
      category_id: categories[0]?.id || "",
      name: "",
      amount: undefined,
      date: todayStr(),
      note: "",
    };

    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.id = "bill-modal-scrim";

    const catChips = categories.map((c, i) => {
      const pal = CAT_PALETTE[i % CAT_PALETTE.length];
      const sel = c.id === draft.category_id;
      return `<button data-catid="${c.id}" class="cat-chip" style="background:${pal.bg};color:${pal.fg};${sel ? `border-color:var(--accent)` : ""}">
        ${c.name}
      </button>`;
    }).join("");

    const newCatHtml = showNewCatInput
      ? `<div style="display:flex;gap:8px;margin-top:8px">
           <input id="new-cat-input" class="form-input" placeholder="Nueva categoría" value="${newCatName}" style="flex:1;padding:8px 12px;font-size:13px">
           <button id="new-cat-save" class="btn-accent" style="padding:8px 14px;font-size:13px">Agregar</button>
         </div>`
      : `<button id="new-cat-btn" class="cat-chip" style="background:none;border:1.5px dashed oklch(0.80 0.01 75);color:var(--text-secondary)">+ Nueva</button>`;

    scrim.innerHTML = `
      <div class="modal-sheet">
        <div class="font-display" style="font-weight:700;font-size:17px;margin-bottom:20px">${editing ? "Editar cuenta" : "Nueva cuenta"}</div>

        <div class="form-group">
          <div class="form-label">Categoría</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">${catChips}${newCatHtml}</div>
        </div>

        <div class="form-group">
          <div class="form-label">Nombre (opcional)</div>
          <input id="bill-name" class="form-input" placeholder="Ej: Factura julio" value="${draft.name || ""}">
        </div>

        <div class="form-group">
          <div class="form-label">Monto (CLP)</div>
          <input id="bill-amount" class="form-input" type="number" inputmode="numeric" placeholder="0" value="${draft.amount ?? ""}">
        </div>

        <div class="form-group">
          <div class="form-label">Fecha</div>
          <input id="bill-date" class="form-input" type="date" value="${draft.date || todayStr()}">
        </div>

        <div class="form-group">
          <div class="form-label">Nota (opcional)</div>
          <textarea id="bill-note" class="form-input" rows="2" placeholder="...">${draft.note || ""}</textarea>
        </div>

        <div style="display:flex;gap:10px;margin-top:8px;${editing ? "justify-content:space-between" : "justify-content:flex-end"}">
          ${editing ? `<button id="bill-delete" class="btn-destructive">Eliminar</button>` : ""}
          <div style="display:flex;gap:10px">
            <button id="bill-cancel" class="btn-outline">Cancelar</button>
            <button id="bill-save" class="btn-accent">Guardar</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(scrim);
    let selectedCatId = draft.category_id || categories[0]?.id || "";

    // Category chip selection
    scrim.querySelectorAll("[data-catid]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedCatId = (btn as HTMLElement).dataset.catid!;
        scrim.querySelectorAll("[data-catid]").forEach(b => (b as HTMLElement).style.borderColor = "transparent");
        (btn as HTMLElement).style.borderColor = "var(--accent)";
      });
    });

    // New cat toggle
    document.getElementById("new-cat-btn")?.addEventListener("click", () => {
      showNewCatInput = true;
      document.getElementById("bill-modal-scrim")?.remove();
      render();
    });

    document.getElementById("new-cat-input")?.addEventListener("input", e => {
      newCatName = (e.target as HTMLInputElement).value;
    });

    document.getElementById("new-cat-save")?.addEventListener("click", async () => {
      if (!newCatName.trim()) return;
      const cat = await api.createCategory(newCatName.trim());
      categories.push(cat);
      selectedCatId = cat.id;
      showNewCatInput = false;
      newCatName = "";
      document.getElementById("bill-modal-scrim")?.remove();
      render();
    });

    document.getElementById("bill-cancel")?.addEventListener("click", () => {
      document.getElementById("bill-modal-scrim")?.remove();
      onClosed();
    });

    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) {
        scrim.remove();
        onClosed();
      }
    });

    document.getElementById("bill-save")?.addEventListener("click", async () => {
      const name = (document.getElementById("bill-name") as HTMLInputElement).value;
      const amount = parseFloat((document.getElementById("bill-amount") as HTMLInputElement).value);
      const date = (document.getElementById("bill-date") as HTMLInputElement).value;
      const note = (document.getElementById("bill-note") as HTMLTextAreaElement).value;
      if (!selectedCatId || isNaN(amount) || !date) return;
      try {
        if (editing) {
          await api.updateBill(editing.id, { category_id: selectedCatId, name, amount, date, note });
        } else {
          await api.createBill(month, { category_id: selectedCatId, name, amount, date, note });
        }
        document.getElementById("bill-modal-scrim")?.remove();
        onSaved();
      } catch (err) { console.error(err); }
    });

    document.getElementById("bill-delete")?.addEventListener("click", async () => {
      if (!editing) return;
      try {
        await api.deleteBill(editing.id);
        document.getElementById("bill-modal-scrim")?.remove();
        onSaved();
      } catch (err) { console.error(err); }
    });
  }

  load();
}
