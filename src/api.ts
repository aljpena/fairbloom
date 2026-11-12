const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
const TOKEN_KEY = "fairbloom.admin.token";

export type Role = "admin" | "farmer" | "buyer";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type TransactionStatus = "pending" | "approved" | "rejected";

export interface AdminUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  farmLocation?: string | null;
  buyerCategory?: string | null;
  businessLocation?: string | null;
  verificationStatus: VerificationStatus;
  verificationNote?: string | null;
  verificationDocument?: string | null;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Pagination {
  total: number;
  page: number;
  pages: number;
}

export interface Transaction {
  _id: string;
  submittedBy?: { _id: string; name: string; role: Role; email?: string } | string;
  farmer?: { _id: string; name: string } | string | null;
  buyer?: { _id: string; name: string } | string | null;
  flowerVariety: string;
  price: number;
  volume: number;
  location?: string;
  flaggedForReview: boolean;
  deviationPercent: number | null;
  status: TransactionStatus;
  createdAt: string;
}

export interface VerificationUser extends AdminUser {
  documentUrl: string | null;
}

export interface UserActivity {
  activeListings: number;
  transactions: Record<string, number>;
}

export interface PageResult<T> {
  items: T[];
  pagination: Pagination;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const authToken = {
  get: () => window.localStorage.getItem(TOKEN_KEY),
  set: (token: string) => window.localStorage.setItem(TOKEN_KEY, token),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

function expireSession() {
  authToken.clear();
  window.dispatchEvent(new Event("fairbloom:unauthorized"));
}

function queryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const value = search.toString();
  return value ? `?${value}` : "";
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const token = options.token === undefined ? authToken.get() : options.token;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("Can't connect to the FairBloom server. Check the API URL and your connection.", 0);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Request failed (${response.status})`;
    if (response.status === 401 && token) expireSession();
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export const adminApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: Pick<AdminUser, "name" | "email" | "role"> & { id?: string } }>("/auth/login", {
      method: "POST",
      body: { email, password },
      token: null,
    }),

  me: () => request<{ user: AdminUser }>("/auth/me"),

  dashboard: async () => {
    const [transactions, verifications, users] = await Promise.all([
      request<{ transactions: Transaction[] }>("/transactions/pending"),
      request<{ users: VerificationUser[]; pagination: Pagination }>("/admin/verifications?status=pending&limit=1"),
      request<{ users: AdminUser[]; pagination: Pagination }>("/admin/users?limit=1"),
    ]);
    return {
      pendingTransactions: transactions.transactions,
      pendingVerifications: verifications.pagination.total,
      totalUsers: users.pagination.total,
    };
  },

  pendingTransactions: () =>
    request<{ transactions: Transaction[] }>("/transactions/pending"),

  transactions: (page: number, flowerVariety: string) =>
    request<{ transactions: Transaction[]; pagination: Pagination }>(
      `/transactions${queryString({ page, limit: 30, flowerVariety: flowerVariety || undefined })}`,
    ),

  reviewTransaction: (id: string, decision: "approve" | "reject") =>
    request<{ transaction: Transaction }>(`/transactions/${id}/review`, {
      method: "PATCH",
      body: { decision },
    }),

  verifications: (status: VerificationStatus, page: number) =>
    request<{ users: VerificationUser[]; pagination: Pagination }>(
      `/admin/verifications${queryString({ status, page, limit: 20 })}`,
    ),

  reviewVerification: (id: string, decision: "approve" | "reject", reason?: string) =>
    request<{ user: AdminUser; documentDeleted: boolean }>(`/admin/users/${id}/verification`, {
      method: "PATCH",
      body: { decision, reason },
    }),

  users: (filters: { search: string; role: string; status: string; page: number }) =>
    request<{ users: AdminUser[]; pagination: Pagination }>(
      `/admin/users${queryString({
        ...filters,
        search: filters.search || undefined,
        role: filters.role || undefined,
        status: filters.status || undefined,
        limit: 20,
      })}`,
    ),

  user: (id: string) =>
    request<{ user: AdminUser; activity: UserActivity }>(`/admin/users/${id}`),

  setUserStatus: (id: string, isActive: boolean) =>
    request<{ user: AdminUser; message: string }>(`/admin/users/${id}/status`, {
      method: "PATCH",
      body: { isActive },
    }),

  eraseUser: (id: string, confirmEmail: string, transactions: "anonymize" | "delete") =>
    request<{ message: string }>(`/admin/users/${id}/erase`, {
      method: "POST",
      body: { confirmEmail, transactions },
    }),

  verificationImage: async (documentUrl: string) => {
    const token = authToken.get();
    let response: Response;
    try {
      response = await fetch(`${API_URL.replace(/\/api$/, "")}${documentUrl}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      throw new ApiError("Could not load the verification document.", 0);
    }
    if (!response.ok) {
      if (response.status === 401 && token) expireSession();
      throw new ApiError("Could not load the verification document.", response.status);
    }
    return URL.createObjectURL(await response.blob());
  },

  backup: async () => {
    const token = authToken.get();
    let response: Response;
    try {
      response = await fetch(`${API_URL}/admin/backup`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      throw new ApiError("Can't connect to the FairBloom server.", 0);
    }
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const message =
        payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : `Backup failed (${response.status})`;
      if (response.status === 401 && token) expireSession();
      throw new ApiError(message, response.status);
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "fairbloom-backup.json";
    return { blob, filename };
  },
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(value);
}

export function submitterName(transaction: Transaction) {
  if (transaction.submittedBy && typeof transaction.submittedBy === "object") return transaction.submittedBy.name;
  if (transaction.farmer && typeof transaction.farmer === "object") return transaction.farmer.name;
  if (transaction.buyer && typeof transaction.buyer === "object") return transaction.buyer.name;
  return "Unknown member";
}
