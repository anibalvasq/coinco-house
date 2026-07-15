import { api, Bill, BillCreate, Category, SplitMode } from "../api/client.js";
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
      split_mode: editing.split_mode ?? "proportional",
      fixed: editing.fixed ?? false,
    } : {
      category_id: categories[0]?.id || "",
      name: "",
      amount: undefined,
      date: todayStr(),
      note: "",
      split_mode: "proportional",
      fixed: false,
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

        <div class="form-group">
          <div class="form-label">Tipo de gasto</div>
          <div style="display:flex;gap:8px">
            <button id="expense-fixed" type="button"
              style="flex:1;padding:10px 8px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;
                     border:2px solid ${draft.fixed ? "var(--accent)" : "oklch(0.88 0.01 75)"};
                     background:${draft.fixed ? "oklch(0.97 0.02 250)" : "#fff"};
                     color:${draft.fixed ? "var(--accent)" : "var(--text-secondary)"}">
              Fijo
            </button>
            <button id="expense-variable" type="button"
              style="flex:1;padding:10px 8px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;
                     border:2px solid ${!draft.fixed ? "var(--accent)" : "oklch(0.88 0.01 75)"};
                     background:${!draft.fixed ? "oklch(0.97 0.02 250)" : "#fff"};
                     color:${!draft.fixed ? "var(--accent)" : "var(--text-secondary)"}">
              Variable
            </button>
          </div>
        </div>

        <div class="form-group">
          <div class="form-label">Forma de dividir</div>
          <div style="display:flex;gap:8px">
            <button id="split-proportional" class="split-mode-btn${draft.split_mode !== "equal" ? " active" : ""}"
              style="flex:1;padding:10px 8px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;
                     border:2px solid ${draft.split_mode !== "equal" ? "var(--accent)" : "oklch(0.88 0.01 75)"};
                     background:${draft.split_mode !== "equal" ? "oklch(0.97 0.02 250)" : "#fff"};
                     color:${draft.split_mode !== "equal" ? "var(--accent)" : "var(--text-secondary)"}">
              📅 Por estancia
            </button>
            <button id="split-equal" class="split-mode-btn${draft.split_mode === "equal" ? " active" : ""}"
              style="flex:1;padding:10px 8px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;
                     border:2px solid ${draft.split_mode === "equal" ? "var(--accent)" : "oklch(0.88 0.01 75)"};
                     background:${draft.split_mode === "equal" ? "oklch(0.97 0.02 250)" : "#fff"};
                     color:${draft.split_mode === "equal" ? "var(--accent)" : "var(--text-secondary)"}">
              ⚖️ 50 / 50
            </button>
          </div>
          <div style="font-size:11px;color:var(--text-caption);margin-top:6px" id="split-mode-hint">
            ${draft.split_mode === "equal"
              ? "Cada persona paga la misma parte, sin importar los días de estadía."
              : "Se divide según los días que cada persona estuvo en el hogar."}
          </div>
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
    let selectedSplitMode: SplitMode = (draft.split_mode as SplitMode) || "proportional";
    let selectedFixed = draft.fixed ?? false;

    function setExpenseType(fixed: boolean) {
      selectedFixed = fixed;
      const fixedBtn = document.getElementById("expense-fixed") as HTMLButtonElement;
      const varBtn = document.getElementById("expense-variable") as HTMLButtonElement;
      fixedBtn.style.borderColor = fixed ? "var(--accent)" : "oklch(0.88 0.01 75)";
      fixedBtn.style.background = fixed ? "oklch(0.97 0.02 250)" : "#fff";
      fixedBtn.style.color = fixed ? "var(--accent)" : "var(--text-secondary)";
      varBtn.style.borderColor = !fixed ? "var(--accent)" : "oklch(0.88 0.01 75)";
      varBtn.style.background = !fixed ? "oklch(0.97 0.02 250)" : "#fff";
      varBtn.style.color = !fixed ? "var(--accent)" : "var(--text-secondary)";
    }

    document.getElementById("expense-fixed")?.addEventListener("click", () => setExpenseType(true));
    document.getElementById("expense-variable")?.addEventListener("click", () => setExpenseType(false));

    function setSplitMode(mode: SplitMode) {
      selectedSplitMode = mode;
      const propBtn = document.getElementById("split-proportional") as HTMLButtonElement;
      const eqBtn = document.getElementById("split-equal") as HTMLButtonElement;
      const hint = document.getElementById("split-mode-hint")!;
      const isEqual = mode === "equal";
      propBtn.style.borderColor = !isEqual ? "var(--accent)" : "oklch(0.88 0.01 75)";
      propBtn.style.background = !isEqual ? "oklch(0.97 0.02 250)" : "#fff";
      propBtn.style.color = !isEqual ? "var(--accent)" : "var(--text-secondary)";
      eqBtn.style.borderColor = isEqual ? "var(--accent)" : "oklch(0.88 0.01 75)";
      eqBtn.style.background = isEqual ? "oklch(0.97 0.02 250)" : "#fff";
      eqBtn.style.color = isEqual ? "var(--accent)" : "var(--text-secondary)";
      hint.textContent = isEqual
        ? "Cada persona paga la misma parte, sin importar los días de estadía."
        : "Se divide según los días que cada persona estuvo en el hogar.";
    }

    document.getElementById("split-proportional")?.addEventListener("click", () => setSplitMode("proportional"));
    document.getElementById("split-equal")?.addEventListener("click", () => setSplitMode("equal"));

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
          await api.updateBill(editing.id, { category_id: selectedCatId, name, amount, date, note, split_mode: selectedSplitMode, fixed: selectedFixed });
        } else {
          await api.createBill(month, { category_id: selectedCatId, name, amount, date, note, split_mode: selectedSplitMode, fixed: selectedFixed });
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
