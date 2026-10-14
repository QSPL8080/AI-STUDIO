// Client-side session storage only. Credentials are verified on the server
// (see crm-server-auth.ts) — no passwords live in the browser bundle.
import type { CrmRole } from "./crm-permissions";
export type { CrmRole };

export interface CrmUser {
  id: string;
  name: string;
  email: string;
  role: CrmRole;
  token: string;
}

const STORAGE_KEY = "quickupp_crm_auth_session_v2";
const REMEMBERED_EMAIL_KEY = "quickupp_crm_remembered_email";

export function getStoredCrmUser(): CrmUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as CrmUser;
    return u && u.token ? u : null;
  } catch {
    return null;
  }
}

export function setStoredCrmUser(user: CrmUser, persist: boolean = false): void {
  if (typeof window === "undefined") return;
  try {
    const str = JSON.stringify(user);
    sessionStorage.setItem(STORAGE_KEY, str);
    if (persist) {
      localStorage.setItem(STORAGE_KEY, str);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.error("Failed to persist CRM user session", e);
  }
}

export function clearStoredCrmUser(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear CRM user session", e);
  }
}

export function getRememberedEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

export function setRememberedEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    if (email) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  } catch (e) {
    console.error("Failed to store remembered email", e);
  }
}
