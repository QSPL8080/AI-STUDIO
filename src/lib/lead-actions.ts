import { createServerFn } from "@tanstack/react-start";
import { saveLead as saveLeadToDb, getLeads as getLeadsFromDb, updateLeadStatus as updateStatusInDb, deleteLead as deleteLeadFromDb, type Lead } from "./db";

export const submitLeadServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    source: "Contact Form" | "Popup Modal";
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
      const saved = await saveLeadToDb(data);
      return { success: true, lead: saved };
    } catch (error: any) {
      console.error("Error submitting lead to PostgreSQL:", error);
      return { success: false, error: error.message };
    }
  });

export const fetchLeadsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const leads = await getLeadsFromDb();
    return { success: true, leads };
  } catch (error: any) {
    console.error("Error fetching leads from PostgreSQL:", error);
    return { success: false, leads: [] as Lead[], error: error.message };
  }
});

export const updateLeadStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: Lead["status"] }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await updateStatusInDb(data.id, data.status);
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

export const deleteLeadServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await deleteLeadFromDb(data.id);
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

