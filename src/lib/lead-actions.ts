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
  updateCalendlyMeetingStatus as updateCalendlyMeetingStatusInDb,
  updateCalendlyMeetingDetails as updateCalendlyMeetingDetailsInDb,
  deleteCalendlyMeeting as deleteCalendlyMeetingInDb,
  saveCRMNotification as saveCRMNotificationInDb,
  getCRMNotifications as getCRMNotificationsFromDb,
  markNotificationRead as markNotificationReadInDb,
  markAllNotificationsRead as markAllNotificationsReadInDb,
  clearNotifications as clearNotificationsInDb,
  type Lead,
  type LeadStatus,
  type ProjectStatus,
  type ActivityLog,
  type LoginLog,
  type AdminUser,
  type CalendlyMeeting,
  type CRMNotification,
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

export const updateCalendlyMeetingServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    id: string;
    meeting_status?: string;
    notes?: string;
    client_name?: string;
    email?: string;
    phone?: string;
    meeting_date?: string;
    meeting_time?: string;
    meeting_link?: string;
    meeting_type?: string;
    assigned_admin?: string;
    performedBy?: string;
  }) => data)
  .handler(async ({ data }) => {
    try {
      const { id, performedBy, ...updates } = data;
      const ok = await updateCalendlyMeetingDetailsInDb(id, updates);
      if (ok) {
        await addActivityLogInDb({
          action: "Calendly Meeting Updated",
          details: `Meeting #${id.slice(-6)} updated (${updates.meeting_status || "details updated"}) by ${performedBy || "Admin"}`,
          performed_by: performedBy || "Admin",
          user_role: "admin",
        });

        if (updates.meeting_status) {
          const notifType = updates.meeting_status === "cancelled" ? "meeting_cancelled" : updates.meeting_status === "rescheduled" ? "meeting_rescheduled" : updates.meeting_status === "completed" ? "meeting_completed" : "meeting_upcoming";
          await saveCRMNotificationInDb({
            type: notifType,
            title: `Meeting ${updates.meeting_status.charAt(0).toUpperCase() + updates.meeting_status.slice(1)}`,
            message: `Calendly meeting #${id.slice(-6)} marked as ${updates.meeting_status} by ${performedBy || "Admin"}`,
            entity_id: id,
            actor: performedBy || "Admin",
          });
        }
      }
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

export const deleteCalendlyMeetingServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; client_name?: string; performedBy?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await deleteCalendlyMeetingInDb(data.id);
      if (ok) {
        await addActivityLogInDb({
          action: "Calendly Meeting Deleted",
          details: `Meeting record for ${data.client_name || data.id} removed`,
          performed_by: data.performedBy || "Admin",
          user_role: "admin",
        });
      }
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// 14. Record Calendly Booking (from widget listener or webhook)
export const recordCalendlyBookingServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    client_name: string;
    email: string;
    phone?: string;
    meeting_date: string;
    meeting_time: string;
    meeting_status?: string;
    meeting_link: string;
    meeting_type?: string;
    notes?: string;
    raw_event?: string;
  }) => data)
  .handler(async ({ data }) => {
    try {
      const meeting = await saveCalendlyMeetingInDb({
        client_name: data.client_name,
        email: data.email,
        phone: data.phone,
        meeting_date: data.meeting_date,
        meeting_time: data.meeting_time,
        meeting_status: data.meeting_status || "scheduled",
        meeting_link: data.meeting_link,
        meeting_type: data.meeting_type || "AI Video Strategy Call (30 min)",
        notes: data.notes || "Booked via Calendly",
      });

      // Also create a linked Lead
      const lead = await saveLeadToDb({
        source: "USA Website - Calendly",
        name: data.client_name,
        email: data.email,
        phone: data.phone || "N/A",
        videoType: data.meeting_type || "AI Video Strategy Call (30 min)",
        business: "Inbound Calendly Strategy Call",
        status: "New",
        notes: `Calendly booking on ${data.meeting_date} at ${data.meeting_time}. Meeting Link: ${data.meeting_link}`,
        meetingDate: data.meeting_date,
        meetingTime: data.meeting_time,
        meetingLink: data.meeting_link,
      });

      // Activity log
      await addActivityLogInDb({
        lead_id: lead.id,
        action: "Calendly Meeting Booked",
        details: `Strategy call scheduled for ${data.client_name} (${data.email}) on ${data.meeting_date} at ${data.meeting_time}`,
        performed_by: "Calendly Integration",
        user_role: "system",
      });

      // Notification
      await saveCRMNotificationInDb({
        type: "meeting_new",
        title: "New Calendly Meeting Booked",
        message: `${data.client_name} scheduled a strategy call for ${data.meeting_date} at ${data.meeting_time}`,
        entity_id: meeting.id,
        actor: "Calendly",
      });

      return { success: true, meeting, lead };
    } catch (error: any) {
      console.error("recordCalendlyBookingServerFn error:", error);
      return { success: false, error: error.message };
    }
  });

// 15. Send Test Calendly Booking Event (for Admins to test live sync)
export const sendTestCalendlyBookingServerFn = createServerFn({ method: "POST" })
  .validator((data: { performedBy?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const names = [
        "Marcus Vance (USA Luxury Real Estate)",
        "Elena Rostova (Fashion Brand USA)",
        "David Sterling (SaaS Founder, Austin TX)",
        "Sophia Chen (E-Commerce CEO, NYC)",
        "Alexander Hayes (Beverly Hills Dental Group)",
      ];
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomSlug = randomName.split(" ")[0].toLowerCase() + Math.floor(Math.random() * 900 + 100);
      const email = `${randomSlug}@brandventures.us`;
      const phone = `+1 (${Math.floor(Math.random() * 800 + 200)}) ${Math.floor(Math.random() * 800 + 200)}-${Math.floor(Math.random() * 8900 + 1000)}`;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const meetingDate = tomorrow.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const meetingTime = "3:30 PM EST";

      const meeting = await saveCalendlyMeetingInDb({
        client_name: randomName,
        email,
        phone,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        meeting_status: "scheduled",
        meeting_link: "https://calendly.com/quickuppaistudio/strategy-call",
        meeting_type: "AI Video Strategy Call (30 min)",
        notes: `Simulated live Calendly booking test initiated by ${data.performedBy || "Admin"}`,
      });

      const lead = await saveLeadToDb({
        source: "USA Website - Calendly",
        name: randomName,
        email,
        phone,
        videoType: "AI Video Strategy Call (30 min)",
        business: "High-Ticket Brand Campaign",
        location: "United States",
        industry: "E-Commerce / Real Estate",
        requirement: "Looking for 10-15 AI Avatar and UGC video ads per month for US market expansion.",
        status: "New",
        notes: `Test Calendly Meeting scheduled on ${meetingDate} at ${meetingTime}.`,
        meetingDate: meetingDate,
        meetingTime: meetingTime,
        meetingLink: "https://calendly.com/quickuppaistudio/strategy-call",
      });

      await addActivityLogInDb({
        lead_id: lead.id,
        action: "Test Calendly Call Created",
        details: `Live test call created for ${randomName} (${email}) for ${meetingDate} at ${meetingTime}`,
        performed_by: data.performedBy || "Admin Test",
        user_role: "admin",
      });

      await saveCRMNotificationInDb({
        type: "meeting_new",
        title: "New Calendly Meeting Booked",
        message: `${randomName} scheduled a Strategy Call for ${meetingDate} at ${meetingTime}`,
        entity_id: meeting.id,
        actor: "Calendly Live Test",
      });

      return { success: true, meeting, lead };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// 16. CRM Notifications Server Functions
export const fetchNotificationsServerFn = createServerFn({ method: "GET" })
  .validator((data?: { limit?: number }) => data || {})
  .handler(async ({ data }) => {
    try {
      const notifications = await getCRMNotificationsFromDb(data?.limit || 50);
      return { success: true, notifications };
    } catch (error: any) {
      return { success: false, notifications: [] as CRMNotification[], error: error.message };
    }
  });

export const markNotificationReadServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await markNotificationReadInDb(data.id);
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

export const markAllNotificationsReadServerFn = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      const ok = await markAllNotificationsReadInDb();
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

export const clearNotificationsServerFn = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      const ok = await clearNotificationsInDb();
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

// Broadcast Channel utility
export function broadcastLeadEvent(event: {
  type: "NEW_LEAD" | "UPDATE_LEAD" | "DELETE_LEAD" | "RESTORE_LEAD" | "REFRESH_ALL" | "NEW_MEETING" | "NEW_NOTIFICATION";
  lead?: Lead;
  meeting?: CalendlyMeeting;
  notification?: CRMNotification;
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

