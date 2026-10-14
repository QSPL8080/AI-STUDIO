import { createServerFn } from "@tanstack/react-start";
import { saveLead as saveLeadToDb, type Lead } from "./db";
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

      // 2. Dispatch new-lead email notification (qsaistudio@gmail.com)
      try {
        const mail = await sendLeadNotificationEmail({
          ...data,
          leadId: saved.id,
        });
        // Record how the email went out so it can be checked in CRM → Activity History.
        const { logActivity } = await import("./crm-db");
        await logActivity({
          title: mail.success ? "New-lead email sent" : "New-lead email FAILED",
          category: "LEADS",
          actorEmail: "website",
          description: mail.success
            ? `Lead ${data.name}: emailed via ${mail.via}.`
            : `Lead ${data.name}: ${mail.errors.join(" | ").slice(0, 900)}`,
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

// NOTE: CRM read/update/delete endpoints now live in ./crm-actions.ts and require a
// signed-in CRM session with the right role. Only the public website form endpoint stays here.

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


