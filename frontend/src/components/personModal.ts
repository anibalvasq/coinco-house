import { api, Person } from "../api/client.js";
import { initial, AVATAR_PALETTE } from "../state.js";

export function openPersonModal(
  editing: Person | null,
  canDelete: boolean,
  onSaved: () => void,
  onClosed: () => void
) {
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.id = "person-modal-scrim";

  const selectedColor = { value: editing?.color || AVATAR_PALETTE[0] };

  function renderSwatches(): string {
    return AVATAR_PALETTE.map(c => `
      <div data-swatch="${c}" class="color-swatch${c === selectedColor.value ? " selected" : ""}"
           style="background:${c}"></div>`).join("");
  }

  function render() {
    scrim.innerHTML = `
      <div class="modal-sheet">
        <div class="font-display" style="font-weight:700;font-size:17px;margin-bottom:20px">
          ${editing ? "Editar persona" : "Nueva persona"}
        </div>

        <div class="form-group" style="display:flex;justify-content:center;margin-bottom:20px">
          <div class="avatar" id="preview-avatar" style="background:${selectedColor.value};width:56px;height:56px;font-size:22px">
            ${initial((document.getElementById("person-name") as HTMLInputElement)?.value || editing?.name || "?")}
          </div>
        </div>

        <div class="form-group">
          <div class="form-label">Nombre</div>
          <input id="person-name" class="form-input" placeholder="Nombre" value="${editing?.name || ""}">
        </div>

        <div class="form-group">
          <div class="form-label">Color</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap" id="swatches">${renderSwatches()}</div>
        </div>

        <div class="form-group">
          <div class="form-label">PIN (4 dígitos)</div>
          <input id="person-pin" class="form-input" type="text" inputmode="numeric" placeholder="1234"
            maxlength="4" style="letter-spacing:4px" value="">
          ${editing ? `<div style="font-size:12px;color:var(--text-caption);margin-top:4px">Deja en blanco para no cambiar el PIN</div>` : ""}
        </div>

        <div style="display:flex;gap:10px;margin-top:8px;${editing && canDelete ? "justify-content:space-between" : "justify-content:flex-end"}">
          ${editing && canDelete ? `<button id="person-delete" class="btn-destructive">Eliminar</button>` : ""}
          <div style="display:flex;gap:10px">
            <button id="person-cancel" class="btn-outline">Cancelar</button>
            <button id="person-save" class="btn-accent">Guardar</button>
          </div>
        </div>
      </div>`;
  }

  render();
  document.body.appendChild(scrim);

  // Update avatar preview when name changes
  document.getElementById("person-name")?.addEventListener("input", e => {
    const av = document.getElementById("preview-avatar");
    if (av) av.textContent = initial((e.target as HTMLInputElement).value);
  });

  // Swatch selection
  scrim.addEventListener("click", async (e) => {
    const el = e.target as HTMLElement;

    if (el.dataset.swatch) {
      selectedColor.value = el.dataset.swatch;
      scrim.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
      el.classList.add("selected");
      const av = document.getElementById("preview-avatar");
      if (av) av.style.background = selectedColor.value;
      return;
    }

    if (el.id === "person-cancel" || e.target === scrim) {
      scrim.remove(); onClosed(); return;
    }

    if (el.id === "person-save") {
      const name = (document.getElementById("person-name") as HTMLInputElement).value.trim();
      const pin = (document.getElementById("person-pin") as HTMLInputElement).value.replace(/\D/g, "").slice(0, 4);
      if (!name) return;
      try {
        if (editing) {
          const payload: Partial<{ name: string; color: string; pin: string }> = { name, color: selectedColor.value };
          if (pin.length === 4) payload.pin = pin;
          await api.updatePerson(editing.id, payload);
        } else {
          if (pin.length !== 4) { alert("El PIN debe tener 4 dígitos"); return; }
          await api.createPerson({ name, color: selectedColor.value, pin });
        }
        scrim.remove(); onSaved();
      } catch (err) { console.error(err); }
      return;
    }

    if (el.id === "person-delete") {
      if (!editing) return;
      try {
        await api.deletePerson(editing.id);
        scrim.remove(); onSaved();
      } catch (err: any) {
        alert(err.message || "Error al eliminar");
      }
    }
  });
}
