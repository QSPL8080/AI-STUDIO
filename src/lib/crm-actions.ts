// CRM server functions. Thin wrappers — all logic and role checks live in
// ./crm-server.ts, which is loaded dynamically so it never ships to the browser.
import { createServerFn } from "@tanstack/react-start";
import type { CrmRole } from "./crm-permissions";

const srv = () => import("./crm-server");

type Tok = { token: string };

export const crmLoginFn = createServerFn({ method: "POST" })
  .validator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.login(data.email, data.password));
  });

export const crmLogoutFn = createServerFn({ method: "POST" })
  .validator((d: Tok) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.logout(data.token));
  });

export const crmSyncFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { ordersPin?: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.sync(data.token, data.ordersPin));
  });

export const crmUnlockOrdersFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { pin: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.unlockOrders(data.token, data.pin));
  });

export const crmCreateLeadFn = createServerFn({ method: "POST" })
  .validator(
    (d: Tok & {
      lead: {
        kind: "website" | "meta";
        clientName: string;
        email?: string;
        phone?: string;
        business?: string;
        videoScope?: string;
        notes?: string;
        channel?: string;
        campaign?: string;
        adSet?: string;
        formName?: string;
      };
    }) => d,
  )
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.createLead(data.token, data.lead));
  });

export const crmUpdateLeadFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { id: string; leadStatus?: string; projectStatus?: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    const patch: { leadStatus?: string; projectStatus?: string } = {};
    if (data.leadStatus) patch.leadStatus = data.leadStatus;
    if (data.projectStatus) patch.projectStatus = data.projectStatus;
    return s.guard(() => s.updateLead(data.token, data.id, patch));
  });

export const crmDeleteLeadFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { id: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.deleteLead(data.token, data.id));
  });

export const crmDeleteLeadsFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { ids: string[] }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.deleteLeads(data.token, data.ids));
  });

export const crmLeadHistoryFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { id: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.leadHistory(data.token, data.id));
  });

export const crmRestoreLeadFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { id: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.restoreLead(data.token, data.id));
  });

export const crmPurgeLeadFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { id: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.purgeLead(data.token, data.id));
  });

export const crmEmptyRecycleBinFn = createServerFn({ method: "POST" })
  .validator((d: Tok) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.emptyRecycleBin(data.token));
  });

export const crmClearLeadsFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { kind: "website" | "meta" }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.clearLeads(data.token, data.kind));
  });

export const crmDeleteOrderFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { id: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.deleteOrder(data.token, data.id));
  });

export const crmCreateUserFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { name: string; email: string; password: string; role: CrmRole }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.createUser(data.token, data));
  });

export const crmSetUserStatusFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { userId: string; status: "ACTIVE" | "INACTIVE" }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.setUserStatus(data.token, data.userId, data.status));
  });

export const crmDeleteUserFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { userId: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.deleteUser(data.token, data.userId));
  });

export const crmSaveMatrixFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { matrix: unknown }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.saveMatrix(data.token, data.matrix));
  });

export const crmSaveConfigFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { config: unknown }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.saveConfig(data.token, data.config));
  });

export const crmDeleteActivityFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { id: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.deleteActivity(data.token, data.id));
  });

export const crmClearActivityFn = createServerFn({ method: "POST" })
  .validator((d: Tok) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.clearActivity(data.token));
  });

export const crmDeleteOrdersFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { ids: string[] }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.deleteOrders(data.token, data.ids));
  });

export const crmDeleteActivitiesFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { ids: string[] }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.deleteActivities(data.token, data.ids));
  });

export const crmRestoreLeadsFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { ids: string[] }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.restoreLeads(data.token, data.ids));
  });

export const crmPurgeLeadsFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { ids: string[] }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.purgeLeads(data.token, data.ids));
  });

export const crmUnlockUserFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { userId: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.unlockUser(data.token, data.userId));
  });

export const crmTestAlertEmailFn = createServerFn({ method: "POST" })
  .validator((d: Tok) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.testAlertEmail(data.token));
  });

export const crmMarkNotificationsFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { all?: boolean; clear?: boolean; ids?: string[] }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.guard(() => s.markNotifications(data.token, { ...(data.all ? { all: true } : {}), ...(data.clear ? { clear: true } : {}), ...(data.ids ? { ids: data.ids } : {}) }));
  });
