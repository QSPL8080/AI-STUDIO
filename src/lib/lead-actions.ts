import { createServerFn } from "@tanstack/react-start";
import {
  saveLead as saveLeadToDb,
  getLeads as getLeadsFromDb,
  updateLead as updateLeadInDb,
  updateLeadStatus as updateStatusInDb,
  updateProjectStatus as updateProjectStatusInDb,
  softDeleteLead as softDeleteInDb,
  restoreLead as restoreLeadInDb,
  permanentDeleteLead as permanentDeleteInDb,
  addActivityLog as addActivityLogInDb,
  getActivityLogs as getActivityLogsFromDb,
  addLoginLog as addLoginLogInDb,
  getLoginLogs as getLoginLogsFromDb,
  getAdminUsers as getAdminUsersFromDb,
  saveAdminUser as saveAdminUserInDb,
  updateAdminUserStatus as updateAdminUserStatusInDb,
  deleteAdminUser as deleteAdminUserInDb,
  saveCalendlyMeeting as saveCalendlyMeetingInDb,
  getCalendlyMeetings as getCalendlyMeetingsFromDb,
  type Lead,
  type LeadStatus,
  type ProjectStatus,
  type ActivityLog,
  type LoginLog,
  type AdminUser,
  type CalendlyMeeting,
} from "./db";
import { sendLeadNotificationEmail } from "./email";

function sanitizeLeadPhone(phone: string, isUsa: boolean): string {
  const trimmed = phone.trim();
  if (!trimmed) return trimmed;
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return trimmed;
  }

  if (digits.length === 10) {
    if (isUsa) {
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return `+91 ${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return digits.length > 10 ? `+${digits}` : trimmed;
}

// 1. Submit Lead from Website Forms
export const submitLeadServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    source: "Contact Form" | "Popup Modal" | "USA - Contact Form" | "USA - Popup Modal" | string;
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
      const isUsa = data.source?.includes("USA");
      const normalizedData = {
        ...data,
        phone: sanitizeLeadPhone(data.phone, isUsa),
      };

      const saved = await saveLeadToDb(normalizedData);

      // Log activity
      try {
        await addActivityLogInDb({
          lead_id: saved.id,
          action: "Lead Submitted",
          details: `New lead received from ${saved.source} for ${saved.name} (${saved.phone})`,
          performed_by: "System / Website",
          user_role: "system",
        });
      } catch {}

      // Dispatch Email Notification
      try {
        await sendLeadNotificationEmail({
          ...normalizedData,
          leadId: saved.id,
        });
      } catch (mailError) {
        console.error("Failed to send lead notification email:", mailError);
      }

      return { success: true, lead: saved };
    } catch (error: any) {
      console.error("Error submitting lead to PostgreSQL:", error);
      return { success: false, error: error.message };
    }
  });

// 2. Fetch Leads (with optional deleted filter for Recycle Bin)
export const fetchLeadsServerFn = createServerFn({ method: "GET" })
  .validator((data?: { includeDeleted?: boolean }) => data || {})
  .handler(async ({ data }) => {
    try {
      const leads = await getLeadsFromDb(data?.includeDeleted || false);
      return { success: true, leads };
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      return { success: false, leads: [] as Lead[], error: error.message };
    }
  });

// 3. Add Manual Lead (Admin / Super Admin)
export const addManualLeadServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    source?: string;
    name: string;
    phone: string;
    email?: string;
    videoType: string;
    videoQuantity?: number | string;
    business: string;
    location?: string;
    industry?: string;
    requirement?: string;
    additional?: string;
    status?: LeadStatus;
    projectStatus?: ProjectStatus;
    notes?: string;
    deliveryDate?: string;
    meetingDate?: string;
    meetingTime?: string;
    meetingLink?: string;
    assignedAdmin?: string;
    createdBy?: string;
    userRole?: string;
  }) => data)
  .handler(async ({ data }) => {
    try {
      const isUsa =
        (data.source || "").includes("USA") ||
        (data.location || "").toLowerCase().includes("usa") ||
        (data.phone || "").startsWith("+1");
      const leadSource = data.source || "Manual";
      const normalizedData = {
        ...data,
        source: leadSource,
        phone: sanitizeLeadPhone(data.phone, isUsa),
      };

      const saved = await saveLeadToDb(normalizedData);

      await addActivityLogInDb({
        lead_id: saved.id,
        action: `${leadSource} Lead Created`,
        details: `${leadSource} lead created for ${saved.name} (${saved.phone}) by ${data.createdBy || "Admin"}`,
        performed_by: data.createdBy || "Admin",
        user_role: data.userRole || "admin",
      });

      return { success: true, lead: saved };
    } catch (error: any) {
      console.error("Error adding manual lead:", error);
      return { success: false, error: error.message };
    }
  });

// 4. Update Lead Full Info
export const updateLeadDetailsServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    id: string;
    updates: Partial<Lead>;
    updatedBy?: string;
    userRole?: string;
    changeSummary?: string;
  }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await updateLeadInDb(data.id, data.updates);
      if (ok && data.changeSummary) {
        await addActivityLogInDb({
          lead_id: data.id,
          action: "Lead Updated",
          details: data.changeSummary,
          performed_by: data.updatedBy || "Admin",
          user_role: data.userRole || "admin",
        });
      }
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// 5. Update Lead Status (with Closed Logic)
export const updateLeadStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    id: string;
    status: LeadStatus;
    closedBy?: string;
    deliveryDate?: string;
    closedAt?: string;
    userRole?: string;
  }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await updateStatusInDb(data.id, data.status, {
        closed_by: data.closedBy,
        delivery_date: data.deliveryDate,
        closed_at: data.closedAt,
      });

      if (ok) {
        const details =
          data.status === "Closed"
            ? `Lead closed by ${data.closedBy || "Admin"}${data.deliveryDate ? ` with delivery date ${data.deliveryDate}` : ""}`
            : `Lead status changed to ${data.status} by ${data.closedBy || "Admin"}`;

        await addActivityLogInDb({
          lead_id: data.id,
          action: data.status === "Closed" ? "Lead Closed" : "Status Changed",
          details,
          performed_by: data.closedBy || "Admin",
          user_role: data.userRole || "admin",
        });
      }

      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// 6. Update Project Status (with Delivered Logic)
export const updateProjectStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    id: string;
    projectStatus: ProjectStatus;
    deliveryDate?: string;
    performedBy?: string;
    userRole?: string;
  }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await updateProjectStatusInDb(data.id, data.projectStatus, data.deliveryDate);
      if (ok) {
        const details =
          data.projectStatus === "Delivered"
            ? `Project marked Delivered by ${data.performedBy || "Admin"}${data.deliveryDate ? ` (Delivery Date: ${data.deliveryDate})` : ""}`
            : `Project status set to ${data.projectStatus} by ${data.performedBy || "Admin"}`;

        await addActivityLogInDb({
          lead_id: data.id,
          action: data.projectStatus === "Delivered" ? "Project Delivered" : "Project Status Changed",
          details,
          performed_by: data.performedBy || "Admin",
          user_role: data.userRole || "admin",
        });
      }
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// 7. Soft Delete (Move to Recycle Bin)
export const softDeleteLeadServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; performedBy?: string; userRole?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await softDeleteInDb(data.id);
      if (ok) {
        await addActivityLogInDb({
          lead_id: data.id,
          action: "Lead Soft-Deleted",
          details: `Lead moved to Recycle Bin by ${data.performedBy || "Admin"}`,
          performed_by: data.performedBy || "Admin",
          user_role: data.userRole || "admin",
        });
      }
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// Backward-compatible deleteLeadServerFn
export const deleteLeadServerFn = softDeleteLeadServerFn;

// 8. Restore Lead from Recycle Bin
export const restoreLeadServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; performedBy?: string; userRole?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await restoreLeadInDb(data.id);
      if (ok) {
        await addActivityLogInDb({
          lead_id: data.id,
          action: "Lead Restored",
          details: `Lead restored from Recycle Bin by ${data.performedBy || "Admin"}`,
          performed_by: data.performedBy || "Admin",
          user_role: data.userRole || "admin",
        });
      }
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// 9. Permanent Delete (Super Admin only)
export const permanentDeleteLeadServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; performedBy?: string; userRole?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await permanentDeleteInDb(data.id);
      if (ok) {
        await addActivityLogInDb({
          lead_id: data.id,
          action: "Lead Permanently Deleted",
          details: `Lead permanently erased from database by ${data.performedBy || "Super Admin"}`,
          performed_by: data.performedBy || "Super Admin",
          user_role: data.userRole || "super_admin",
        });
      }
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// 10. Activity Logs
export const fetchActivityLogsServerFn = createServerFn({ method: "GET" })
  .validator((limit?: number) => limit || 100)
  .handler(async ({ data }) => {
    try {
      const logs = await getActivityLogsFromDb(data);
      return { success: true, logs };
    } catch (error: any) {
      return { success: false, logs: [] as ActivityLog[], error: error.message };
    }
  });

export const addActivityLogServerFn = createServerFn({ method: "POST" })
  .validator((data: { lead_id?: string; action: string; details: string; performed_by: string; user_role: string }) => data)
  .handler(async ({ data }) => {
    try {
      const log = await addActivityLogInDb(data);
      return { success: true, log };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// 11. Login Logs
export const recordLoginLogServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    email: string;
    role: string;
    ip_address: string;
    location?: string;
    user_agent: string;
    status?: "success" | "failed";
  }) => data)
  .handler(async ({ data }) => {
    try {
      const log = await addLoginLogInDb(data);
      return { success: true, log };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

export const fetchLoginLogsServerFn = createServerFn({ method: "GET" })
  .validator((limit?: number) => limit || 100)
  .handler(async ({ data }) => {
    try {
      const logs = await getLoginLogsFromDb(data);
      return { success: true, logs };
    } catch (error: any) {
      return { success: false, logs: [] as LoginLog[], error: error.message };
    }
  });

// 12. Admin Users (Super Admin Management)
export const fetchAdminUsersServerFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const users = await getAdminUsersFromDb();
    return { success: true, users };
  } catch (error: any) {
    return { success: false, users: [] as AdminUser[], error: error.message };
  }
});

export const createAdminUserServerFn = createServerFn({ method: "POST" })
  .validator((data: { name: string; email: string; password: string; role: "super_admin" | "admin"; status?: "active" | "inactive"; performedBy?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const user = await saveAdminUserInDb(data);
      await addActivityLogInDb({
        action: "Admin Account Created",
        details: `New ${data.role} account created for ${data.name} (${data.email})`,
        performed_by: data.performedBy || "Super Admin",
        user_role: "super_admin",
      });
      return { success: true, user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

export const toggleAdminUserStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: "active" | "inactive"; email?: string; performedBy?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await updateAdminUserStatusInDb(data.id, data.status);
      if (ok) {
        await addActivityLogInDb({
          action: "Admin Status Changed",
          details: `Admin user ${data.email || data.id} status changed to ${data.status}`,
          performed_by: data.performedBy || "Super Admin",
          user_role: "super_admin",
        });
      }
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

export const deleteAdminUserServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; email?: string; performedBy?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await deleteAdminUserInDb(data.id);
      if (ok) {
        await addActivityLogInDb({
          action: "Admin Deleted",
          details: `Admin account ${data.email || data.id} deleted`,
          performed_by: data.performedBy || "Super Admin",
          user_role: "super_admin",
        });
      }
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// 13. Calendly Meetings
export const fetchCalendlyMeetingsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const meetings = await getCalendlyMeetingsFromDb();
    return { success: true, meetings };
  } catch (error: any) {
    return { success: false, meetings: [] as CalendlyMeeting[], error: error.message };
  }
});

export const saveCalendlyMeetingServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    lead_id?: string;
    client_name: string;
    email: string;
    phone?: string;
    meeting_date: string;
    meeting_time: string;
    meeting_status?: string;
    meeting_link: string;
    meeting_type?: string;
    assigned_admin?: string;
    notes?: string;
    performedBy?: string;
  }) => data)
  .handler(async ({ data }) => {
    try {
      const meeting = await saveCalendlyMeetingInDb(data);
      await addActivityLogInDb({
        lead_id: data.lead_id,
        action: "Calendly Meeting Scheduled",
        details: `Meeting with ${data.client_name} on ${data.meeting_date} at ${data.meeting_time}`,
        performed_by: data.performedBy || "System / Calendly",
        user_role: "system",
      });
      return { success: true, meeting };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// Broadcast Channel utility
export function broadcastLeadEvent(event: {
  type: "NEW_LEAD" | "UPDATE_LEAD" | "DELETE_LEAD" | "RESTORE_LEAD" | "REFRESH_ALL";
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

