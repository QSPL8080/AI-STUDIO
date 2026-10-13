import { CrmRole } from "@/lib/crm-auth";

export interface LeadItem {
  id: string;
  source: "Website" | "Manual Entry" | "Meta Ads" | "Landing Page";
  timestampIst: string;
  timestampEdt: string;
  clientName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  companyName?: string;
  videoScope: string;
  businessType?: string;
  leadStatus: "New" | "Contacted" | "In Progress" | "Hold" | "Closed" | "Delivered";
  projectStatus: "New" | "In Progress" | "Proj Active" | "On Hold" | "Delivered" | "Cancelled";
  notes: string;
  channel?: "Facebook" | "Instagram" | "Website" | "Manual";
  campaign?: string;
  adSet?: string;
  formName?: string;
  closedBy?: string;
  location?: string;
}

export interface OrderItem {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  packageItem: string;
  badgeType: "PACKAGE" | "INDIVIDUAL";
  amount: string;
  amountNumeric: number;
  paymentStatus: "COMPLETED" | "PENDING" | "REFUNDED";
  orderId: string;
  date: string;
  paymentGateway: "PayPal" | "Stripe" | "Razorpay";
}

export interface CalendlyMeetingItem {
  id: string;
  meetingDateIst: string;
  meetingDateEdt: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  crmLeadBadge: string;
  meetingType: string;
  meetingStatus: "SCHEDULED" | "RESCHEDULED" | "COMPLETED" | "NOT CONDUCTED" | "NO SHOW" | "CANCELLED";
  meetingLink: string;
  handlingUser: string;
  createdDateIst: string;
  createdDateEdt: string;
}

export interface ActivityLogItem {
  id: string;
  title: string;
  category: "USER_ACTIVITY" | "CALENDLY" | "LEADS";
  actorEmail: string;
  description: string;
  timestamp: string;
}

export interface AdminAccountItem {
  id: string;
  name: string;
  email: string;
  role: CrmRole;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  isProtected?: boolean;
}

export interface IpTrackingSessionItem {
  id: string;
  timestamp: string;
  isLiveSession?: boolean;
  userEmail: string;
  role: string;
  ipAddress: string;
  gpsCoordinates: string;
  accuracy: string;
  officeProximity: string;
  browserDevice: string;
  accessStatus: "AUTHORIZED" | "TERMINATED";
}

export interface RbacMatrixRow {
  module: string;
  locationLabel: string;
  superAdmin: "Allowed" | "Always Allowed";
  admin: "Allowed" | "Always Allowed" | "Super Admin Only" | "Restricted";
  leadsManager: "Allowed" | "Always Allowed" | "No access" | "Soft-delete only";
}

export interface MasterCounters {
  activeLeads: number;
  recycleBin: number;
  totalOrders: number;
  totalRevenue: string;
  calendlyCalls: number;
  userAccounts: number;
  activityLogs: number;
  securityLogs: number;
  lastCheckedTime: string;
}

export interface CrmConfigSettings {
  crmTitle: string;
  alertEmail: string;
  pollingInterval: string;
  audioChimeEnabled: boolean;
  inactivityTimeout: string;
  failedLoginThreshold: string;
  approvedNetworks: string[];
}
