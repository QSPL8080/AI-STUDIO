// Types shared by the CRM UI. Data shapes come straight from the server layer
// (type-only imports — nothing from the server is bundled into the browser).
import type { CrmLead, CrmOrder, sync } from "@/lib/crm-server";

export type LeadItem = CrmLead;
export type OrderItem = CrmOrder;

type SyncOk = Awaited<ReturnType<typeof sync>>;
export type SyncData = SyncOk;
export type UserItem = NonNullable<SyncOk["users"]>[number];
export type ActivityItem = NonNullable<SyncOk["activity"]>[number];
export type RecordCounts = NonNullable<SyncOk["counts"]>;
