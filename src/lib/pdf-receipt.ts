import PDFDocument from "pdfkit";
import {
  getReceiptRegularFont,
  getReceiptBoldFont,
  getCompanyLogoBuffer,
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
}

/**
 * Generates an official, beautiful PDF Payment Receipt / Invoice buffer
 * matching Quickupp AI Studio branding and official format.
 * 100% self-contained with embedded fonts and logo for zero-crash reliability.
 */
export async function generateInvoicePdfBuffer(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const regularFont = getReceiptRegularFont();
      const boldFont = getReceiptBoldFont();
      const logoBuffer = getCompanyLogoBuffer();

      const doc = new PDFDocument({
        font: regularFont as unknown as string,
        margin: 42,
        size: "A4",
        info: {
          Title: `Payment Receipt - ${data.orderNumber}`,
          Author: "Quickupp AI Studio",
          Subject: `Official Payment Receipt for Order ${data.orderNumber}`,
          Creator: "Quickupp AI Studio Invoice Generator",
        },
      });

      doc.registerFont("ReceiptRegular", regularFont);
      doc.registerFont("ReceiptBold", boldFont);

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const pageWidth = 595.28;
      const margin = 42;
      const contentWidth = pageWidth - margin * 2;

      // Top colored accent bar
      doc
        .rect(0, 0, pageWidth, 6)
        .fill("#7c3aed");

      const topY = 24;

      // 1. TOP LEFT: Official PDF Logo
      let leftEndY = topY;
      try {
        doc.image(logoBuffer, margin, topY, { width: 165 });
        leftEndY = topY + 34;
      } catch {
        doc
          .font("ReceiptBold")
          .fontSize(16)
          .fillColor("#6d28d9")
          .text("QUICKUPP AI STUDIO", margin, topY);
        leftEndY = topY + 22;
      }

      // Left subtitle lines below logo (Company metadata)
      doc
        .font("ReceiptRegular")
        .fontSize(8.5)
        .fillColor("#64748b")
        .text("AI-Powered Creative & Video Studio", margin, leftEndY);

      leftEndY += 12;
      doc
        .font("ReceiptRegular")
        .fontSize(8)
        .fillColor("#64748b")
        .text("Operated by-Quickupp Softech LLC", margin, leftEndY);

      leftEndY += 12;
      doc
        .font("ReceiptRegular")
        .fontSize(8.5)
        .fillColor("#475569")
        .text("Email: ", margin, leftEndY, { continued: true })
        .fillColor("#2563eb")
        .text("info@quickuppaistudio.us", {
          link: "mailto:info@quickuppaistudio.us",
          underline: true,
        });

      leftEndY += 12;
      doc
        .font("ReceiptRegular")
        .fontSize(8.5)
        .fillColor("#475569")
        .text("Website: ", margin, leftEndY, { continued: true })
        .fillColor("#2563eb")
        .text("quickuppaistudio.us", {
          link: "https://quickuppaistudio.us",
          underline: true,
        });

      leftEndY += 14;

      // TOP RIGHT: Clean Header (No overlapping text)
      const rightColWidth = 250;
      const rightColX = pageWidth - margin - rightColWidth;
      let rightY = topY;

      doc
        .font("ReceiptBold")
        .fontSize(16)
        .fillColor("#0f172a")
        .text("PAYMENT RECEIPT", rightColX, rightY, { width: rightColWidth, align: "right" });

      rightY += 22;

      doc
        .font("ReceiptBold")
        .fontSize(9)
        .fillColor("#0f172a")
        .text(`Receipt No: ${data.orderNumber}`, rightColX, rightY, { width: rightColWidth, align: "right" });

      rightY += 13;

      const issueDateStr = data.issueDate || data.paymentDate || "September 25, 2026";
      doc
        .font("ReceiptRegular")
        .fontSize(9)
        .fillColor("#475569")
        .text(`Date: ${issueDateStr}`, rightColX, rightY, { width: rightColWidth, align: "right" });

      rightY += 13;

      doc
        .font("ReceiptBold")
        .fontSize(9)
        .fillColor("#16a34a")
        .text("Payment Status: PAID ✓", rightColX, rightY, { width: rightColWidth, align: "right" });

      rightY += 14;

      // Divider line
      let currentY = Math.max(leftEndY, rightY) + 10;
      doc
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .moveTo(margin, currentY)
        .lineTo(pageWidth - margin, currentY)
        .stroke();

      currentY += 14;

      // 2. BILL TO Section
      doc
        .font("ReceiptBold")
        .fontSize(10)
        .fillColor("#6d28d9")
        .text("BILL TO", margin, currentY);

      currentY += 14;

      doc
        .font("ReceiptRegular")
        .fontSize(9.5)
        .fillColor("#475569")
        .text("Customer Name: ", margin, currentY, { continued: true })
        .font("ReceiptBold")
        .fillColor("#0f172a")
        .text(data.customerName);

      currentY += 14;

      doc
        .font("ReceiptRegular")
        .fontSize(9.5)
        .fillColor("#475569")
        .text("Email: ", margin, currentY, { continued: true })
        .fillColor("#2563eb")
        .text(data.customerEmail, {
          link: `mailto:${data.customerEmail}`,
          underline: true,
        });

      if (data.customerCompany && data.customerCompany.trim()) {
        currentY += 14;
        doc
          .font("ReceiptRegular")
          .fontSize(9.5)
          .fillColor("#475569")
          .text("Company: ", margin, currentY, { continued: true })
          .font("ReceiptBold")
          .fillColor("#0f172a")
          .text(data.customerCompany);
      }

      // Billing address - single clean line as requested
      const formattedAddress = (data.billingAddress || "United States").replace(/[\r\n]+/g, ", ").trim();
      currentY += 14;
      doc
        .font("ReceiptRegular")
        .fontSize(9.5)
        .fillColor("#475569")
        .text("Billing Address: ", margin, currentY, { continued: true })
        .font("ReceiptRegular")
        .fillColor("#0f172a")
        .text(formattedAddress);

      currentY += 20;

      // 3. PAYMENT DETAILS Table
      doc
        .font("ReceiptBold")
        .fontSize(10)
        .fillColor("#6d28d9")
        .text("PAYMENT DETAILS", margin, currentY);

      currentY += 13;

      // Table Header Box
      const tableX = margin;
      const tableRight = tableX + contentWidth; // 553.28
      const col1X = tableX + 12;
      const col1Width = 320;
      const col2X = tableX + 332;
      const col2Width = 50;
      const col3X = tableX + 382;
      const col3Width = tableRight - 12 - col3X; // 541.28 - 424 = 117.28

      doc
        .rect(tableX, currentY, contentWidth, 20)
        .fill("#f8fafc")
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .stroke();

      doc
        .font("ReceiptBold")
        .fontSize(9)
        .fillColor("#475569")
        .text("Description", col1X, currentY + 5, { width: col1Width })
        .text("Qty", col2X, currentY + 5, { width: col2Width, align: "center" })
        .text("Amount", col3X, currentY + 5, { width: col3Width, align: "right" });

      currentY += 20;

      // Table Row
      const rowHeight = 30;
      doc
        .rect(tableX, currentY, contentWidth, rowHeight)
        .fill("#ffffff")
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .stroke();

      const itemDesc = data.packageDescription
        ? `${data.serviceName} – ${data.packageDescription}`
        : `${data.serviceName}`;

      const qty = data.qty || 1;
      const formattedAmount = `$${data.amount.toFixed(2)}`;

      doc
        .font("ReceiptBold")
        .fontSize(9.5)
        .fillColor("#0f172a")
        .text(itemDesc, col1X, currentY + 9, { width: col1Width })
        .font("ReceiptRegular")
        .fontSize(9.5)
        .text(String(qty), col2X, currentY + 9, { width: col2Width, align: "center" })
        .font("ReceiptBold")
        .fontSize(9.5)
        .text(formattedAmount, col3X, currentY + 9, { width: col3Width, align: "right" });

      currentY += rowHeight + 10;

      // Subtotal, Tax, Total Block (Mathematically right aligned to exact table border)
      const totalsWidth = 220;
      const totalsX = tableRight - totalsWidth; // 333.28 to 553.28
      const padRight = 12; // Matches table column right padding
      const totalsLabelX = totalsX + 12;
      const totalsLabelWidth = 90;
      const totalsValX = totalsX + totalsLabelWidth;
      const totalsValWidth = totalsWidth - totalsLabelWidth - padRight; // 220 - 90 - 12 = 118 (terminates at 541.28)

      const subtotalVal = data.subtotal !== undefined ? data.subtotal : data.amount;
      const taxVal = data.tax !== undefined ? data.tax : 0;
      const totalVal = data.total !== undefined ? data.total : data.amount;
      const currencyStr = data.currency || "USD";

      doc
        .font("ReceiptRegular")
        .fontSize(9)
        .fillColor("#64748b")
        .text("Subtotal:", totalsLabelX, currentY, { width: totalsLabelWidth, align: "left" })
        .font("ReceiptBold")
        .fillColor("#0f172a")
        .text(`$${subtotalVal.toFixed(2)}`, totalsValX, currentY, { width: totalsValWidth, align: "right" });

      currentY += 14;

      doc
        .font("ReceiptRegular")
        .fontSize(9)
        .fillColor("#64748b")
        .text("Tax (0%):", totalsLabelX, currentY, { width: totalsLabelWidth, align: "left" })
        .font("ReceiptBold")
        .fillColor("#0f172a")
        .text(`$${taxVal.toFixed(2)}`, totalsValX, currentY, { width: totalsValWidth, align: "right" });

      currentY += 15;

      // Total Box (Border and values align perfectly with table)
      doc
        .roundedRect(totalsX, currentY - 4, totalsWidth, 24, 4)
        .fill("#f5f3ff")
        .strokeColor("#ddd6fe")
        .lineWidth(1)
        .stroke();

      doc
        .font("ReceiptBold")
        .fontSize(10)
        .fillColor("#6d28d9")
        .text("Total:", totalsLabelX, currentY + 3, { width: totalsLabelWidth, align: "left" })
        .text(
          `$${totalVal.toFixed(2)} ${currencyStr}`,
          totalsValX,
          currentY + 3,
          { width: totalsValWidth, align: "right" }
        );

      currentY += 32;

      // 4. Payment Information Card
      doc
        .roundedRect(margin, currentY, contentWidth, 74, 6)
        .fill("#f8fafc")
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .stroke();

      doc
        .font("ReceiptBold")
        .fontSize(9.5)
        .fillColor("#475569")
        .text("PAYMENT INFORMATION", margin + 14, currentY + 10);

      const infoLeftX = margin + 14;
      const infoRightX = margin + 270;
      let cardY = currentY + 25;

      const paymentMethodStr = data.paymentMethod || "PayPal";
      doc
        .font("ReceiptRegular")
        .fontSize(9)
        .fillColor("#64748b")
        .text("Payment Method: ", infoLeftX, cardY, { continued: true })
        .font("ReceiptBold")
        .fillColor("#0f172a")
        .text(paymentMethodStr);

      const paymentDateStr = data.paymentDate || "September 25, 2026";
      doc
        .font("ReceiptRegular")
        .fontSize(9)
        .fillColor("#64748b")
        .text("Payment Date: ", infoRightX, cardY, { continued: true })
        .font("ReceiptBold")
        .fillColor("#0f172a")
        .text(paymentDateStr);

      cardY += 14;
      doc
        .font("ReceiptRegular")
        .fontSize(9)
        .fillColor("#64748b")
        .text("Transaction ID: ", infoLeftX, cardY, { continued: true })
        .font("ReceiptBold")
        .fillColor("#0f172a")
        .text(data.transactionId);

      const paymentTimeStr = data.paymentTime || "10:42 AM EST";
      doc
        .font("ReceiptRegular")
        .fontSize(9)
        .fillColor("#64748b")
        .text("Payment Time: ", infoRightX, cardY, { continued: true })
        .font("ReceiptBold")
        .fillColor("#0f172a")
        .text(paymentTimeStr);

      cardY += 14;
      doc
        .font("ReceiptRegular")
        .fontSize(9)
        .fillColor("#64748b")
        .text("Payment Status: ", infoLeftX, cardY, { continued: true })
        .font("ReceiptBold")
        .fillColor("#16a34a")
        .text("PAID ✓");

      currentY += 88;

      // 5. THANK YOU FOR YOUR PURCHASE Section
      doc
        .font("ReceiptBold")
        .fontSize(10)
        .fillColor("#0f172a")
        .text("THANK YOU FOR YOUR PURCHASE", margin, currentY);

      currentY += 13;
      doc
        .font("ReceiptRegular")
        .fontSize(8.5)
        .fillColor("#334155")
        .text("Your payment has been successfully received.", margin, currentY);

      currentY += 12;
      doc
        .font("ReceiptRegular")
        .fontSize(8.5)
        .fillColor("#334155")
        .text("Your order is now being processed by the Quickupp AI Studio team.", margin, currentY);

      currentY += 14;
      doc
        .font("ReceiptBold")
        .fontSize(8.5)
        .fillColor("#475569")
        .text("For questions regarding your order or payment:", margin, currentY);

      currentY += 12;
      doc
        .font("ReceiptBold")
        .fontSize(9)
        .fillColor("#6d28d9")
        .text("Quickupp AI Studio", margin, currentY);

      currentY += 12;
      doc
        .font("ReceiptRegular")
        .fontSize(8.5)
        .fillColor("#475569")
        .text("Email: ", margin, currentY, { continued: true })
        .fillColor("#2563eb")
        .text("info@quickuppaistudio.us", {
          link: "mailto:info@quickuppaistudio.us",
          underline: true,
        });

      currentY += 12;
      doc
        .font("ReceiptRegular")
        .fontSize(8.5)
        .fillColor("#475569")
        .text("Website: ", margin, currentY, { continued: true })
        .fillColor("#2563eb")
        .text("quickuppaistudio.us", {
          link: "https://quickuppaistudio.us",
          underline: true,
        });

      currentY += 16;
      doc
        .font("ReceiptRegular")
        .fontSize(7.5)
        .fillColor("#94a3b8")
        .text(
          "This document serves as your official payment receipt for the transaction described above. Operated by-Quickupp Softech LLC.",
          margin,
          currentY,
          { width: contentWidth }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
