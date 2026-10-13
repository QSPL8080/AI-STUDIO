export type CrmRole = "SUPER_ADMIN" | "ADMIN" | "LEADS_MANAGER";

export interface CrmUser {
  name: string;
  email: string;
  role: CrmRole;
  token?: string;
  loginTime: string;
}

const STORAGE_KEY = "quickupp_crm_auth_session";
const REMEMBERED_EMAIL_KEY = "quickupp_crm_remembered_email";

// Valid credentials based on requirements:
// Super admin: sa@aistudo.in (also accept sa@aistudio.in) | pass: Anay@8080
// Test admin: test@aistudio.in | pass: test@123
export const CRM_CREDENTIALS = [
  {
    email: "sa@aistudo.in",
    aliases: ["sa@aistudio.in", "sa@aistudio.us"],
    password: "Anay@8080",
    name: "Super Admin",
    role: "SUPER_ADMIN" as CrmRole,
  },
  {
    email: "test@aistudio.in",
    aliases: ["test@aistudio.us"],
    password: "test@123",
    name: "test",
    role: "ADMIN" as CrmRole,
  },
];

export function getStoredCrmUser(): CrmUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CrmUser;
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

export function validateCrmLogin(email: string, pass: string): { success: boolean; user?: CrmUser; error?: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const matched = CRM_CREDENTIALS.find(
    (c) => c.email.toLowerCase() === normalizedEmail || c.aliases?.map((a) => a.toLowerCase()).includes(normalizedEmail)
  );

  if (!matched) {
    return {
      success: false,
      error: "Invalid admin email address. Please check your credentials.",
    };
  }

  if (matched.password !== pass) {
    return {
      success: false,
      error: "Incorrect password. Please verify and try again.",
    };
  }

  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const user: CrmUser = {
    name: matched.name,
    email: matched.email,
    role: matched.role,
    loginTime: timeString,
  };

  return { success: true, user };
}
