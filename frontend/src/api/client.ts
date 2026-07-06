const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
  let url = `${BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, detail.detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as T;
}

export const api = {
  // Auth
  login: (person_id: string, pin: string) =>
    request<{ id: string; name: string; color: string }>("POST", "/auth/login", { person_id, pin }),
  logout: () => request<void>("POST", "/auth/logout"),
  me: () => request<{ id: string; name: string; color: string }>("GET", "/auth/me"),

  // People
  listPeople: () => request<Person[]>("GET", "/people"),
  createPerson: (data: { name: string; color: string; pin: string }) =>
    request<Person>("POST", "/people", data),
  updatePerson: (id: string, data: Partial<{ name: string; color: string; pin: string }>) =>
    request<Person>("PATCH", `/people/${id}`, data),
  deletePerson: (id: string) => request<void>("DELETE", `/people/${id}`),

  // Categories
  listCategories: () => request<Category[]>("GET", "/categories"),
  createCategory: (name: string) => request<Category>("POST", "/categories", { name }),
  deleteCategory: (id: string) => request<void>("DELETE", `/categories/${id}`),

  // Bills
  listBills: (month: string) => request<Bill[]>("GET", "/bills", undefined, { month }),
  createBill: (month: string, data: BillCreate) => request<Bill>("POST", "/bills", data, { month }),
  updateBill: (id: string, data: Partial<BillCreate>) => request<Bill>("PATCH", `/bills/${id}`, data),
  deleteBill: (id: string) => request<void>("DELETE", `/bills/${id}`),

  // Stays
  getStays: (month: string) => request<Record<string, number>>("GET", "/stays", undefined, { month }),
  updateStays: (month: string, stays: Record<string, number>) =>
    request<Record<string, number>>("PUT", "/stays", { stays }, { month }),

  // Split
  getSplit: (month: string) => request<SplitResult>("GET", "/split", undefined, { month }),

  // Dashboard
  getDashboard: (month: string) => request<DashboardData>("GET", "/dashboard", undefined, { month }),

  // History
  getHistory: () => request<HistoryRow[]>("GET", "/history"),
};

// ── Shared types ────────────────────────────────────────────
export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export type SplitMode = "proportional" | "equal";

export interface Bill {
  id: string;
  category_id: string;
  name: string;
  amount: number;
  date: string;
  note: string;
  month_key: string;
  split_mode: SplitMode;
}

export interface BillCreate {
  category_id: string;
  name: string;
  amount: number;
  date: string;
  note?: string;
  split_mode?: SplitMode;
}

export interface SplitResult {
  month_key: string;
  total_amount: number;
  total_amount_fmt: string;
  total_days: number;
  equal_split_warning: boolean;
  per_person: SplitPerson[];
  bill_details: BillDetail[];
}

export interface SplitPerson {
  id: string;
  name: string;
  color: string;
  days: number;
  pct: number;
  amount: number;
  amount_fmt: string;
}

export interface BillDetail {
  id: string;
  name: string;
  category_name: string;
  amount: number;
  amount_fmt: string;
  split_mode: SplitMode;
  per_person: { person_id: string; name: string; amount: number; amount_fmt: string }[];
}

export interface DashboardData {
  month_key: string;
  has_bills: boolean;
  total_amount: number;
  total_amount_fmt: string;
  bills_count: number;
  bills_count_label: string;
  split_preview: { id: string; name: string; color: string; amount: number; amount_fmt: string; pct: number }[];
  equal_split_warning: boolean;
  recent_bills: { id: string; name: string; category_name: string; amount: number; amount_fmt: string; date: string; date_label: string }[];
}

export interface HistoryRow {
  month_key: string;
  month_label: string;
  bills_count: number;
  total_amount: number;
  total_amount_fmt: string;
}
