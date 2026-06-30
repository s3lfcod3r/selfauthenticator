// Duenner Fetch-Wrapper gegen /api. Dasselbe Contract nutzt später das APK.
const BASE = "/api";
const TOKEN_KEY = "selfauth_token";

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function setToken(t: string | null): void {
  token = t;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return token;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...opts, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* kein JSON-Body */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export interface AuthState {
  has_users: boolean;
  allow_registration: boolean;
}

export interface PreloginOut {
  kdf_salt: string;
  kdf_algorithm: string;
  kdf_mem_kib: number;
  kdf_ops: number;
}

export interface TokenOut {
  token: string;
  protected_vault_key: string;
  kdf_salt: string;
  kdf_mem_kib: number;
  kdf_ops: number;
}

export interface EntryOut {
  id: string;
  ciphertext: string;
  revision: number;
  deleted: boolean;
  updated_at: string;
}

export interface RegisterBody {
  email: string;
  kdf_salt: string;
  kdf_mem_kib: number;
  kdf_ops: number;
  auth_hash: string;
  protected_vault_key: string;
}

export const api = {
  state: () => req<AuthState>("/auth/state"),
  prelogin: (email: string) =>
    req<PreloginOut>("/auth/prelogin", { method: "POST", body: JSON.stringify({ email }) }),
  register: (body: RegisterBody) =>
    req<TokenOut>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (email: string, authHash: string) =>
    req<TokenOut>("/auth/login", { method: "POST", body: JSON.stringify({ email, auth_hash: authHash }) }),
  listVault: () => req<{ entries: EntryOut[]; server_time: string }>("/vault"),
  upsert: (body: { id: string; ciphertext: string; base_revision?: number }) =>
    req<EntryOut>("/vault", { method: "POST", body: JSON.stringify(body) }),
  remove: (id: string) => req<EntryOut>(`/vault/${id}`, { method: "DELETE" }),
};
