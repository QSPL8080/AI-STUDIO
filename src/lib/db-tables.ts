// India site tables. The US site (aistudio.us) uses the same Supabase project with
// its own `leads` / `orders` tables — India MUST NOT read or write those, so all
// India data lives in separate ind_* tables.
export const LEADS_TABLE = "ind_leads";
export const ORDERS_TABLE = "ind_orders";
export const COUPONS_TABLE = "ind_coupons";

