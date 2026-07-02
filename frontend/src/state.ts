/**
 * App-level UI state — not persisted to the DB.
 * Only session info is stored in an httpOnly cookie (managed by the backend).
 */
export type Route = "dashboard" | "bills" | "people" | "split" | "history";
export type PeopleTab = "personas" | "dias";
export type Modal = "bill" | "person" | null;

export interface AppState {
  session: { id: string; name: string; color: string } | null;
  route: Route;
  viewingMonth: string;  // 'YYYY-MM'
  peopleTab: PeopleTab;
  modal: Modal;
  editingId: string | null;
  showUserMenu: boolean;
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key: string, delta: number): string {
  let [y, m] = key.split("-").map(Number);
  m += delta;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1)  { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio",
                     "julio","agosto","septiembre","octubre","noviembre","diciembre"];

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

export const AVATAR_PALETTE = [
  "oklch(0.58 0.14 250)", "oklch(0.62 0.15 40)", "oklch(0.58 0.13 150)",
  "oklch(0.60 0.14 320)", "oklch(0.60 0.13 90)", "oklch(0.58 0.13 200)",
];

export const CAT_PALETTE: { bg: string; fg: string }[] = [
  { bg: "oklch(0.90 0.05 40)",  fg: "oklch(0.40 0.13 40)" },
  { bg: "oklch(0.90 0.05 210)", fg: "oklch(0.40 0.11 210)" },
  { bg: "oklch(0.90 0.05 265)", fg: "oklch(0.42 0.13 265)" },
  { bg: "oklch(0.90 0.05 145)", fg: "oklch(0.40 0.11 145)" },
  { bg: "oklch(0.90 0.05 20)",  fg: "oklch(0.42 0.14 20)" },
  { bg: "oklch(0.90 0.05 325)", fg: "oklch(0.42 0.12 325)" },
  { bg: "oklch(0.90 0.05 90)",  fg: "oklch(0.38 0.10 90)" },
  { bg: "oklch(0.90 0.05 300)", fg: "oklch(0.42 0.12 300)" },
];

export function initial(name: string): string {
  return (name || "?")[0].toUpperCase();
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
