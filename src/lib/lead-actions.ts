import { createServerFn } from "@tanstack/react-start";
import {
  saveLead as saveLeadToDb,
  getLeads as getLeadsFromDb,
  updateLeadStatus as updateLeadStatusInDb,
  deleteLead as deleteLeadFromDb,
  clearAllLeads as clearAllLeadsInDb,
  type Lead,
} from "./db";
import { sendLeadNotificationEmail } from "./email";
import type { IndiaLeadSource } from "./lead-source";

export const submitLeadServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    source: IndiaLeadSource;
    name: string;
    phone: string;
    email?: string;
    videoType: string;
    business: string;
    location?: string;
    industry?: string;
    requirement?: string;
    additional?: string;
  }) => data)
  .handler(async ({ data }) => {
    try {
      // 1. Save lead to PostgreSQL / Supabase Database for Admin Panel
      const saved = await saveLeadToDb(data);

      // 2. Dispatch Email Notification directly to quickuppaistudio1@gmail.com
      try {
        await sendLeadNotificationEmail({
          ...data,
          leadId: saved.id,
        });
      } catch (mailError) {
        console.error("Failed to send lead notification email:", mailError);
      }

      return { success: true, lead: saved };
    } catch (error: any) {
      console.error("Error submitting lead to database:", error);
      return { success: false, error: error.message };
    }
  });

export const getLeadsServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const leads = await getLeadsFromDb();
      return { success: true, leads };
    } catch (err: any) {
      console.error("Error fetching leads from database:", err);
      return { success: false, error: err.message, leads: [] };
    }
  });

export const updateLeadStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: Lead["status"] }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await updateLeadStatusInDb(data.id, data.status);
      return { success: ok };
    } catch (err: any) {
      console.error("Error updating lead status in database:", err);
      return { success: false, error: err.message };
    }
  });

export const deleteLeadServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await deleteLeadFromDb(data.id);
      return { success: ok };
    } catch (err: any) {
      console.error("Error deleting lead from database:", err);
      return { success: false, error: err.message };
    }
  });

export const clearAllLeadsServerFn = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      const ok = await clearAllLeadsInDb();
      return { success: ok };
    } catch (err: any) {
      console.error("Error clearing all leads from database:", err);
      return { success: false, error: err.message };
    }
  });

export const createCrmLeadServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    name?: string;
    clientName?: string;
    phone: string;
    email?: string;
    videoType?: string;
    videoScope?: string;
    business?: string;
    notes?: string;
    source?: string;
  }) => data)
  .handler(async ({ data }) => {
    try {
      const saved = await saveLeadToDb({
        source: data.source || "Manual Entry",
        name: data.clientName || data.name || "Valued Client",
        phone: data.phone,
        email: data.email,
        videoType: data.videoScope || data.videoType || "AI Video",
        business: data.business || "General Inquiry",
        requirement: data.notes,
      });
      return { success: true, lead: saved };
    } catch (err: any) {
      console.error("Error creating CRM lead in database:", err);
      return { success: false, error: err.message };
    }
  });

export function broadcastLeadEvent(event: {
  type: "NEW_LEAD" | "UPDATE_LEAD" | "DELETE_LEAD";
  lead?: Lead;
  id?: string;
}) {
  if (typeof window === "undefined") return;
  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("ai_studio_leads_sync");
      bc.postMessage(event);
      bc.close();
    }
    window.dispatchEvent(new CustomEvent("ai_studio_lead_event", { detail: event }));
  } catch (e) {
    console.error("Broadcast lead event failed:", e);
  }
}


