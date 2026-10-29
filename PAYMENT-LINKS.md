# Admin-generated customer payment links

Admins and the Super Admin can send a customer a secure PayU payment link from the CRM
(**Payment Links** tab, or **Generate Payment Link** inside a lead). The customer opens
`https://quickuppaistudio.in/pay/<token>`, chooses **Full** or **Partial (50%)** payment and pays
through the existing PayU integration. The website checkout is unchanged.

## One-time setup (production / Supabase)

1. Supabase → SQL Editor → run **`supabase-update.sql`** (safe to run again). It adds the
   `crm_payment_links` table. Orders and payments still live in `ind_orders`.
2. Make sure `CRM_SESSION_SECRET` is set to a long random value in Hostinger. Payment-link
   tokens are signed with it (they fall back to `PAYU_SALT` if it's missing). Changing it later
   makes older links stop working.
3. Nothing else: PayU, email and receipts use the existing settings.

Local Postgres creates the table automatically (`crm-schema.ts`).

## Rules

- Only **Admin** and **Super Admin** can create, list or cancel links (checked on the server).
- The admin enters a **custom total**. Video type and quantity come from the website price list.
  The admin does **not** choose full or partial: the customer does.
- Partial payment uses the website's rule: 50% now, rounded up to the rupee (`splitPayment`).
  Totals too small to split only offer full payment.
- **Initial link:** valid for exactly 24 hours and single use. It's used up by the first
  verified successful payment (full or partial). Failed or cancelled payments don't use it up,
  so the customer can retry before expiry. If a PayU payment started before expiry and is
  confirmed after it, the payment is still accepted.
- **Retry safety:** before a new attempt replaces an unfinished one, PayU is asked about the old
  one. A success, or a payment still pending at the bank, blocks the retry. A new attempt can't
  start within 60 seconds of the previous one unless PayU reported a failure. If an older
  attempt still succeeds later, it's applied to the order. If the order was already paid, the
  payment is logged as **"DUPLICATE payment received — refund needed"**.
- **Coupons:** the customer page has no coupon field and the API accepts only the link token
  and the Full/Partial choice. Website coupons are unchanged.
- **Balance after a partial payment:** uses the existing website balance link
  (`/api/pay-balance`). It has no fixed expiry, works until the balance is paid, and covers the
  full outstanding amount. It's shown in the receipt email, on the customer page and in the CRM
  (Copy / WhatsApp). For payment-link orders, PayU is also checked before a balance retry.
- **Leads:** the lead is created with the existing lead process and source **Manual Entry** or
  **Meta Ads**. If a lead with the same mobile or email exists, the admin chooses to attach to
  it or to create a new lead. Payment-link payments are **not** written into the lead's manual
  "Payment status / Deal amount" fields, so revenue isn't counted twice. They show in the
  lead's **Payment Links · Orders & Payments** card and in **Orders & Payments**.
- `/api/pay-order` refuses payment-link orders, so the 24-hour and customer-choice rules
  can't be bypassed.

## Files

- `src/lib/payment-links.ts`: all server logic
- `src/lib/payment-link-token.ts`: signed link tokens
- `src/lib/payment-link-actions.ts`: server functions
- `src/routes/pay.$token.tsx`: customer page
- `src/components/crm/payment-links-panel.tsx`: CRM tab, form, and lead card
- Small, gated hooks in `checkout-server.ts` and `crm-server.ts`, wiring in `crm-app.tsx`,
  and the table in `crm-schema.ts` and the SQL files
