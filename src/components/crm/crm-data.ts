import {
  ActivityLogItem,
  AdminAccountItem,
  CalendlyMeetingItem,
  CrmConfigSettings,
  IpTrackingSessionItem,
  LeadItem,
  MasterCounters,
  OrderItem,
  RbacMatrixRow,
} from "./crm-types";

// Clean template state - ready for India CRM connection (no US leads, orders, or external data)
export const INITIAL_LEADS: LeadItem[] = [];

export const INITIAL_META_LEADS: LeadItem[] = [];

export const INITIAL_ORDERS: OrderItem[] = [];

export const INITIAL_MEETINGS: CalendlyMeetingItem[] = [];

export const INITIAL_ACTIVITY_LOGS: ActivityLogItem[] = [
  {
    id: "act-1",
    title: "India CRM Initialized",
    category: "USER_ACTIVITY",
    actorEmail: "sa@aistudo.in",
    description: "Enterprise CRM node ready for live inbound leads and orders.",
    timestamp: "Today",
  },
];

export const INITIAL_ADMINS: AdminAccountItem[] = [
  {
    id: "usr-1",
    name: "Super Admin",
    email: "sa@aistudo.in",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    createdAt: "System Protected",
    isProtected: true,
  },
  {
    id: "usr-2",
    name: "test",
    email: "test@aistudio.in",
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: "Today",
    isProtected: false,
  },
];

export const INITIAL_IP_SESSIONS: IpTrackingSessionItem[] = [
  {
    id: "ip-1",
    timestamp: "Today, Live",
    isLiveSession: true,
    userEmail: "sa@aistudo.in",
    role: "SUPER_ADMIN",
    ipAddress: "Active Connection",
    gpsCoordinates: "India Node",
    accuracy: "Secure TLS",
    officeProximity: "Exempt",
    browserDevice: "Enterprise CRM Web Client",
    accessStatus: "AUTHORIZED",
  },
];

export const INITIAL_RBAC_MATRIX: RbacMatrixRow[] = [
  {
    module: "Website Leads Management & Status Updating",
    locationLabel: "Leads Management tab",
    superAdmin: "Always Allowed",
    admin: "Always Allowed",
    leadsManager: "Always Allowed",
  },
  {
    module: "Dashboard & Real-Time Performance Analytics",
    locationLabel: "Dashboard tab",
    superAdmin: "Allowed",
    admin: "Allowed",
    leadsManager: "No access",
  },
  {
    module: "Meta Ads Leads Management & Notes",
    locationLabel: "Meta Leads tab",
    superAdmin: "Allowed",
    admin: "Allowed",
    leadsManager: "Allowed",
  },
  {
    module: "Delete Leads (move to Recycle Bin)",
    locationLabel: "Delete buttons on lead tables",
    superAdmin: "Allowed",
    admin: "Allowed",
    leadsManager: "Soft-delete only",
  },
  {
    module: "Recycle Bin (view & restore leads)",
    locationLabel: "Recycle Bin tab",
    superAdmin: "Allowed",
    admin: "Allowed",
    leadsManager: "No access",
  },
  {
    module: "Permanent Lead Purge & Empty Recycle Bin",
    locationLabel: "Irreversible delete",
    superAdmin: "Allowed",
    admin: "Super Admin Only",
    leadsManager: "No access",
  },
  {
    module: "Orders & Financial Revenue Access",
    locationLabel: "Orders tab (still needs the security PIN)",
    superAdmin: "Allowed",
    admin: "Allowed",
    leadsManager: "No access",
  },
  {
    module: "Activity History / Audit Log",
    locationLabel: "Activity History tab",
    superAdmin: "Allowed",
    admin: "Super Admin Only",
    leadsManager: "No access",
  },
  {
    module: "Export Leads & Campaign Data (CSV)",
    locationLabel: "Export CSV buttons",
    superAdmin: "Allowed",
    admin: "Allowed",
    leadsManager: "No access",
  },
  {
    module: "Create, Suspend & Delete Users",
    locationLabel: "User Management tab",
    superAdmin: "Allowed",
    admin: "Restricted",
    leadsManager: "No access",
  },
  {
    module: "View Live IP Tracking & Login Audit Logs",
    locationLabel: "Login / IP Tracking tab",
    superAdmin: "Allowed",
    admin: "Super Admin Only",
    leadsManager: "No access",
  },
  {
    module: "Modify CRM Settings & Theme Preferences",
    locationLabel: "CRM Settings tab (not Permissions)",
    superAdmin: "Allowed",
    admin: "Restricted",
    leadsManager: "No access",
  },
];

export const INITIAL_COUNTERS: MasterCounters = {
  activeLeads: 0,
  recycleBin: 0,
  totalOrders: 0,
  totalRevenue: "₹0",
  calendlyCalls: 0,
  userAccounts: 2,
  activityLogs: 1,
  securityLogs: 1,
  lastCheckedTime: "Just now",
};

export const INITIAL_CONFIG_SETTINGS: CrmConfigSettings = {
  crmTitle: "AI STUDIO INDIA – Enterprise CRM",
  alertEmail: "info@quickuppaistudio.in",
  pollingInterval: "10 Seconds (Recommended • Real-Time High Precision)",
  audioChimeEnabled: true,
  inactivityTimeout: "10 Minutes (Default / Recommended)",
  failedLoginThreshold: "3 Failed Attempts (Strict)",
  approvedNetworks: ["Office / India Hub"],
};
