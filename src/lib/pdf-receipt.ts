import PDFDocument from "pdfkit";
import {
  getReceiptRegularFont,
  getReceiptBoldFont,
  getCompanyLogoDarkBuffer,
} from "./receipt-assets.ts";

export interface InvoiceData {
  orderNumber: string;
  issueDate?: string | undefined;
  paymentDate?: string | undefined;
  paymentTime?: string | undefined;
  paymentStatus?: string | undefined;
  customerName: string;
  customerEmail: string;
  customerCompany?: string | undefined;
  billingAddress?: string | undefined;
  serviceName: string;
  packageDescription?: string | undefined;
  qty?: number | undefined;
  amount: number;
  currency?: string | undefined;
  subtotal?: number | undefined;
  tax?: number | undefined;
  total?: number | undefined;
  paymentMethod?: string | undefined;
  transactionId: string;
  /** Payment plan: "full" (default), "advance" (50% now) or "balance" (rest of an advance order). */
  plan?: "full" | "advance" | "balance" | undefined;
  planLabel?: string | undefined;
  /** Full price of the order (amount = what this payment charged). */
  orderTotal?: number | undefined;
  /** Already paid before this payment (balance payments). */
  paidBefore?: number | undefined;
  /** Paid so far in total, including this payment. */
  paidTotal?: number | undefined;
  /** Still to be paid after this payment. */
  balanceDue?: number | undefined;
  parentOrderNumber?: string | undefined;
}

const SITE = "quickuppaistudio.in";
const SITE_URL = "https://quickuppaistudio.in";
const SUPPORT_EMAIL = "info@quickuppaistudio.in";
const COMPANY = "Quickupp Softech Private Limited";

const C = {
  brand: "#7c3aed",
  brandDark: "#6d28d9",
  brandSoft: "#f5f3ff",
  brandLine: "#ddd6fe",
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  panel: "#f8fafc",
  link: "#2563eb",
  green: "#16a34a",
};

/**
 * Official A4 PDF payment receipt for Quickupp AI Studio (India).
 * Fills the full page: header, bill-to, payment table, totals, payment information,
 * thank-you note, and a contact footer anchored to the bottom of the page.
 * Fonts and logo are embedded, so it renders the same everywhere.
 */
export async function generateInvoicePdfBuffer(data: InvoiceData): Promise<Buffer> {
  const currency = data.currency || "INR";
  const money = (n: number) =>
    currency === "INR"
      ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${currency} ${n.toFixed(2)}`;

  return new Promise((resolve, reject) => {
    try {
      const regular = getReceiptRegularFont();
      const doc = new PDFDocument({
        size: "A4",
        margin: 0,
        // IMPORTANT: start with our embedded font. Without this, PDFKit first loads its
        // built-in Helvetica from a file on disk, which does not exist in the bundled
        // production server, and every receipt fails ("Receipt not available").
        font: regular as unknown as string,
        info: {
          Title: `Payment Receipt - ${data.orderNumber}`,
          Author: "Quickupp AI Studio",
          Subject: `Official Payment Receipt for Order ${data.orderNumber}`,
          Creator: "Quickupp AI Studio",
        },
      });
      doc.registerFont("R", regular);
      doc.registerFont("B", getReceiptBoldFont());

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const W = 595.28;
      const H = 841.89;
      const M = 48;
      const CW = W - M * 2;
      const R = W - M;

      // Label + value on one line ("Label: value"), returns nothing; caller manages y.
      const pair = (
        label: string,
        value: string,
        x: number,
        y: number,
        o: { size?: number; bold?: boolean; color?: string; link?: string; width?: number } = {},
      ) => {
        const size = o.size ?? 11;
        doc.font("R").fontSize(size).fillColor(C.muted).text(`${label} `, x, y, { continued: true });
        doc
          .font(o.bold === false ? "R" : "B")
          .fillColor(o.link ? C.link : o.color || C.ink)
          .text(value, o.link ? { link: o.link, underline: true } : {});
      };
      const section = (t: string, y: number) =>
        doc.font("B").fontSize(12).fillColor(C.brandDark).text(t, M, y, { characterSpacing: 0.4 });

      // ── Top brand bar ─────────────────────────────────────────────
      const grad = doc.linearGradient(0, 0, W, 0);
      grad.stop(0, "#4f46e5").stop(0.5, "#a832e6").stop(1, "#e11d74");
      doc.rect(0, 0, W, 8).fill(grad);

      // ── Header ────────────────────────────────────────────────────
      let ly = 40;
      try {
        doc.image(getCompanyLogoDarkBuffer(), M, ly, { width: 200 });
        ly += 40;
      } catch {
        doc.font("B").fontSize(20).fillColor(C.brandDark).text("Quickupp AI Studio", M, ly);
        ly += 30;
      }
      doc.font("R").fontSize(10.5).fillColor(C.muted).text("AI-Powered Creative & Video Studio", M, ly);
      ly += 15;
      doc.font("R").fontSize(10).fillColor(C.muted).text(`Operated by ${COMPANY}`, M, ly);
      ly += 17;
      pair("Email:", SUPPORT_EMAIL, M, ly, { size: 10.5, bold: false, link: `mailto:${SUPPORT_EMAIL}` });
      ly += 15;
      pair("Website:", SITE, M, ly, { size: 10.5, bold: false, link: SITE_URL });
      ly += 15;

      const rw = 260;
      const rx = R - rw;
      let ry = 40;
      doc.font("B").fontSize(24).fillColor(C.ink).text("PAYMENT RECEIPT", rx, ry, { width: rw, align: "right" });
      ry += 34;
      doc.font("B").fontSize(11).fillColor(C.ink).text(`Receipt No: ${data.orderNumber}`, rx, ry, { width: rw, align: "right" });
      ry += 17;
      const issueDate =
        data.issueDate ||
        data.paymentDate ||
        new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" });
      doc.font("R").fontSize(11).fillColor(C.body).text(`Date: ${issueDate}`, rx, ry, { width: rw, align: "right" });
      ry += 18;
      // PAID pill
      const plan = data.plan || "full";
      const balanceDue = Math.max(0, data.balanceDue ?? 0);
      const partly = plan === "advance" && balanceDue > 0;
      const pillText = partly ? "ADVANCE PAID" : "PAYMENT: PAID";
      const pillW = doc.font("B").fontSize(10).widthOfString(pillText) + (partly ? 24 : 40);
      const pillH = 22;
      const pillX = R - pillW;
      doc.roundedRect(pillX, ry, pillW, pillH, 11).fill(partly ? "#fef3c7" : "#dcfce7");
      doc.font("B").fontSize(10).fillColor(partly ? "#b45309" : C.green).text(pillText, pillX + 12, ry + 6, { lineBreak: false });
      if (!partly) drawTick(doc, pillX + pillW - 22, ry + 7.5);
      ry += pillH;

      let y = Math.max(ly, ry) + 22;
      doc.moveTo(M, y).lineTo(R, y).lineWidth(1).strokeColor(C.line).stroke();
      y += 24;

      // ── Bill to ───────────────────────────────────────────────────
      section("BILL TO", y);
      y += 22;
      pair("Customer Name:", data.customerName, M, y);
      y += 19;
      pair("Email:", data.customerEmail, M, y, { bold: false, link: `mailto:${data.customerEmail}` });
      y += 19;
      if (data.customerCompany?.trim()) {
        pair("Company:", data.customerCompany.trim(), M, y);
        y += 19;
      }
      pair("Billing Address:", (data.billingAddress || "India").replace(/[\r\n]+/g, ", ").trim(), M, y, { bold: false, color: C.ink });
      const tight = plan !== "full"; // advance / balance receipts have extra rows: tighten spacing
      y += tight ? 24 : 28;

      // ── Payment details: one table (item, subtotal, tax, total) ──
      section("PAYMENT DETAILS", y);
      y += 22;
      const c1 = M + 16;
      const c2 = M + 330;
      const c2w = 60;
      const c3w = 130;
      const c3 = R - 16 - c3w;
      const orderTotal = data.orderTotal ?? data.subtotal ?? data.amount;
      const sub = data.subtotal ?? orderTotal;
      const tot = data.total ?? data.amount;
      const paidTotal = data.paidTotal ?? data.amount;
      const headH = 32;
      const rowH = 46;
      const sumH = tight ? 27 : 30;
      const totH = 40;
      const sumRows: [string, string][] =
        plan === "advance"
          ? [
              ["Order Total", money(orderTotal)],
              ["Amount Paid (50% Advance)", money(data.amount)],
            ]
          : plan === "balance"
            ? [
                ["Order Total", money(orderTotal)],
                ["Paid Earlier (50% Advance)", money(data.paidBefore ?? 0)],
                ["Amount Paid Now (Balance)", money(data.amount)],
              ]
            : [["Subtotal", money(sub)]];
      if (data.tax !== undefined) sumRows.push(["Tax", money(data.tax)]);
      // Last (highlighted) row: what is still due for an advance, otherwise the total paid.
      const lastRow = partly
        ? { label: "Balance Due:", value: `${money(balanceDue)} ${currency}`, bg: "#fffbeb", line: "#fde68a", color: "#b45309" }
        : {
            label: plan === "balance" ? "Total Paid (Fully Paid):" : "Total:",
            value: `${money(plan === "balance" ? paidTotal : tot)} ${currency}`,
            bg: C.brandSoft,
            line: C.brandLine,
            color: C.brandDark,
          };
      const tableTop = y;
      const tableH = headH + rowH + sumH * sumRows.length + totH;

      // Frame + header band + total band (clipped to the rounded frame)
      doc.save();
      doc.roundedRect(M, tableTop, CW, tableH, 8).clip();
      doc.rect(M, tableTop, CW, headH).fill("#f1f5f9");
      doc.rect(M, tableTop + tableH - totH, CW, totH).fill(lastRow.bg);
      doc.restore();
      doc.roundedRect(M, tableTop, CW, tableH, 8).lineWidth(1).strokeColor(C.line).stroke();

      // Header
      doc.font("B").fontSize(10.5).fillColor(C.muted);
      doc.text("Description", c1, y + 11);
      doc.text("Qty", c2, y + 11, { width: c2w, align: "center" });
      doc.text("Amount", c3, y + 11, { width: c3w, align: "right" });
      y += headH;
      doc.moveTo(M, y).lineTo(R, y).lineWidth(1).strokeColor(C.line).stroke();

      // Item
      const item = data.packageDescription ? `${data.serviceName} – ${data.packageDescription}` : data.serviceName;
      doc.font("B").fontSize(12).fillColor(C.ink).text(item, c1, y + 16, { width: c2 - c1 - 10 });
      doc.font("R").fontSize(12).fillColor(C.ink).text(String(data.qty || 1), c2, y + 16, { width: c2w, align: "center" });
      doc.font("B").fontSize(12).fillColor(C.ink).text(money(orderTotal), c3, y + 16, { width: c3w, align: "right" });
      y += rowH;

      // Subtotal / tax rows (label sits under the Qty column, value under Amount)
      const labelX = c1;
      const labelW = c3 - 40 - c1;
      for (const [k, v] of sumRows) {
        doc.moveTo(M, y).lineTo(R, y).lineWidth(1).strokeColor(C.line).stroke();
        doc.font("R").fontSize(11).fillColor(C.muted).text(`${k}:`, labelX, y + 9, { width: labelW, align: "right" });
        doc.font("B").fontSize(11).fillColor(C.ink).text(v, c3, y + 9, { width: c3w, align: "right" });
        y += sumH;
      }

      // Total row
      doc.moveTo(M, y).lineTo(R, y).lineWidth(1).strokeColor(lastRow.line).stroke();
      doc.font("B").fontSize(13).fillColor(lastRow.color).text(lastRow.label, labelX, y + 13, { width: labelW, align: "right" });
      doc.font("B").fontSize(13).fillColor(lastRow.color).text(lastRow.value, c3 - 30, y + 13, { width: c3w + 30, align: "right" });
      y += totH + (tight ? 22 : 28);

      // ── Payment information card ─────────────────────────────────
      const cardH = 108;
      doc.roundedRect(M, y, CW, cardH, 10).fillAndStroke(C.panel, C.line);
      doc.font("B").fontSize(12).fillColor(C.body).text("PAYMENT INFORMATION", M + 20, y + 18, { characterSpacing: 0.4 });
      const ix = M + 20;
      const jx = M + CW / 2 + 10;
      let cy = y + 44;
      const paymentTime =
        data.paymentTime ||
        new Date()
          .toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true })
          .toUpperCase() + " IST";
      pair("Payment Method:", data.paymentMethod || "PayU", ix, cy, { size: 10.5 });
      pair("Payment Date:", data.paymentDate || issueDate, jx, cy, { size: 10.5 });
      cy += 20;
      pair("Transaction ID:", data.transactionId, ix, cy, { size: 10.5 });
      pair("Payment Time:", paymentTime, jx, cy, { size: 10.5 });
      cy += 20;
      const statusText = partly ? "PARTIALLY PAID" : "PAID";
      pair("Payment Status:", statusText, ix, cy, { size: 10.5, color: partly ? "#b45309" : C.green });
      if (!partly) {
        const tickX =
          ix +
          doc.font("R").fontSize(10.5).widthOfString("Payment Status: ") +
          doc.font("B").fontSize(10.5).widthOfString(statusText) +
          5;
        drawTick(doc, tickX, cy + 2);
      }
      pair("Payment Type:", data.planLabel || "Full Payment", jx, cy, { size: 10.5 });
      y += cardH + (tight ? 18 : 28);

      // ── Thank you ─────────────────────────────────────────────────
      doc.font("B").fontSize(15).fillColor(C.ink).text("THANK YOU FOR YOUR PURCHASE", M, y);
      y += tight ? 22 : 24;
      doc.font("R").fontSize(11).fillColor(C.body).text("Your payment has been successfully received.", M, y);
      y += tight ? 16 : 17;
      if (plan !== "balance") {
        doc.font("R").fontSize(11).fillColor(C.body).text("Your order is now being processed by the Quickupp AI Studio team.", M, y);
        y += tight ? 16 : 17;
      }
      if (partly) {
        doc.font("B").fontSize(11).fillColor("#b45309").text(
          `Balance due: ${money(balanceDue)} ${currency}. You can pay it anytime using the link in your payment email.`,
          M,
          y,
          { width: CW },
        );
      } else if (plan === "balance") {
        doc.font("B").fontSize(11).fillColor(C.green).text(
          `Your order${data.parentOrderNumber ? ` ${data.parentOrderNumber}` : ""} is now fully paid. Thank you!`,
          M,
          y,
          { width: CW },
        );
      } else {
        doc.font("R").fontSize(11).fillColor(C.body).text(
          "Please keep your receipt number handy when communicating with our team.",
          M,
          y,
        );
      }

      // ── Footer (anchored to the bottom of the page) ──────────────
      const fy = H - 132;
      doc.moveTo(M, fy).lineTo(R, fy).lineWidth(1).strokeColor(C.line).stroke();
      let f = fy + 18;
      doc.font("B").fontSize(10.5).fillColor(C.body).text("For questions regarding your order or payment:", M, f);
      f += 18;
      doc.font("B").fontSize(12).fillColor(C.brandDark).text("Quickupp AI Studio", M, f);
      f += 18;
      pair("Email:", SUPPORT_EMAIL, M, f, { size: 10.5, bold: false, link: `mailto:${SUPPORT_EMAIL}` });
      f += 16;
      pair("Website:", SITE, M, f, { size: 10.5, bold: false, link: SITE_URL });

      doc
        .font("R")
        .fontSize(8)
        .fillColor(C.faint)
        .text(
          `This document serves as your official payment receipt for the transaction described above. Operated by ${COMPANY}.`,
          M,
          H - 32,
          { width: CW, align: "center" },
        );
      doc.rect(0, H - 8, W, 8).fill(grad);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/** Small green check mark (drawn, so it never shows as a missing-glyph box). */
function drawTick(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc
    .save()
    .lineWidth(1.7)
    .lineCap("round")
    .lineJoin("round")
    .strokeColor("#16a34a")
    .moveTo(x, y + 4)
    .lineTo(x + 3.2, y + 7.2)
    .lineTo(x + 9, y)
    .stroke()
    .restore();
}
