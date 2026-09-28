import { createServerFn } from "@tanstack/react-start";
import { resolvePurchaseItem } from "./pricing";
import {
  createPayPalOrderApi,
  capturePayPalOrderApi,
  getPublicPayPalConfig,
} from "./paypal";
import {
  saveOrder as saveOrderToDb,
  updateOrderPayment as updateOrderPaymentInDb,
  getOrders as getOrdersFromDb,
  getOrderById as getOrderByIdFromDb,
  getOrderByAnyId as getOrderByAnyIdFromDb,
  updateOrderStatus as updateOrderStatusInDb,
  deleteOrder as deleteOrderFromDb,
  saveCRMNotification as saveCRMNotificationInDb,
  type Order,
  type PaymentStatus,
} from "./db";
import { sendPaymentReceiptEmail } from "./email";
import { generateInvoicePdfBuffer } from "./pdf-receipt";

/**
 * Public configuration helper for client-side PayPal Script initialization.
 * Only returns client ID and environment (Never the client secret).
 */
export const getPayPalConfigServerFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const config = getPublicPayPalConfig();
    return {
      success: true,
      clientId: config.clientId,
      environment: config.environment,
    };
  } catch (error: any) {
    console.error("Failed to get PayPal config:", error);
    return {
      success: false,
      clientId: "",
      environment: "sandbox",
      error: error.message,
    };
  }
});

/**
 * Server-authoritative PayPal Order Creation.
 * Resolves price from trusted pricing table, validates input, calls PayPal REST API, and stores pending record.
 */
export const createPayPalOrderServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    itemType: "individual" | "package" | "setup" | string;
    itemId?: string;
    tierId?: string;
    format?: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    customerCompany?: string;
  }) => data)
  .handler(async ({ data }) => {
    try {
      if (!data.customerName?.trim() || !data.customerEmail?.trim()) {
        return {
          success: false,
          error: "Please enter your full name and a valid email address.",
        };
      }

      // Authoritatively resolve item and price from server configuration
      const resolvedItem = resolvePurchaseItem({
        itemType: data.itemType,
        itemId: data.itemId,
        tierId: data.tierId,
        format: data.format,
      });

      if (!resolvedItem) {
        return {
          success: false,
          error: "Invalid or unrecognized service/package selected.",
        };
      }

      // Create Order with official PayPal REST API
      const paypalOrder = await createPayPalOrderApi({
        amount: resolvedItem.amount,
        currency: resolvedItem.currency,
        itemName: resolvedItem.itemName,
        customerName: data.customerName.trim(),
        customerEmail: data.customerEmail.trim(),
      });

      // Persist pending order to database
      const savedOrder = await saveOrderToDb({
        paypalOrderId: paypalOrder.id,
        customerName: data.customerName.trim(),
        customerEmail: data.customerEmail.trim(),
        customerPhone: data.customerPhone?.trim() || undefined,
        customerCompany: data.customerCompany?.trim() || undefined,
        itemType: resolvedItem.itemType,
        itemId: resolvedItem.itemId,
        itemName: resolvedItem.itemName,
        amount: resolvedItem.amount,
        currency: resolvedItem.currency,
        paymentStatus: "PENDING",
        paypalStatus: paypalOrder.status,
      });

      return {
        success: true,
        orderId: paypalOrder.id,
        internalOrderId: savedOrder.id,
        resolvedItem,
      };
    } catch (error: any) {
      console.error("Error creating PayPal order:", error);
      return {
        success: false,
        error: error.message || "Failed to initialize PayPal order.",
      };
    }
  });

/**
 * Server-authoritative PayPal Payment Capture.
 * Captures payment from PayPal, verifies COMPLETED status, updates database, and broadcasts sync event.
 */
export const capturePayPalOrderServerFn = createServerFn({ method: "POST" })
  .validator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    try {
      if (!data.orderId) {
        return { success: false, error: "Missing PayPal Order ID for capture." };
      }

      const captureResult = await capturePayPalOrderApi(data.orderId);
      const isCompleted = captureResult.status === "COMPLETED";

      let captureId: string | undefined;
      const captures =
        captureResult.purchase_units?.[0]?.payments?.captures;
      if (captures && captures.length > 0 && captures[0]) {
        captureId = captures[0].id;
      }

      const paymentStatus: PaymentStatus = isCompleted ? "COMPLETED" : "FAILED";

      const updatedOrder = await updateOrderPaymentInDb({
        paypalOrderId: data.orderId,
        paypalCaptureId: captureId,
        paymentStatus,
        paypalStatus: captureResult.status,
        rawDetails: JSON.stringify(captureResult),
      });

      // Automated Payment Receipt Email Dispatch (Hostinger SMTP)
      if (isCompleted && updatedOrder && updatedOrder.customer_email) {
        sendPaymentReceiptEmail({
          customerName: updatedOrder.customer_name,
          customerEmail: updatedOrder.customer_email,
          customerPhone: updatedOrder.customer_phone || undefined,
          customerCompany: updatedOrder.customer_company || undefined,
          orderId: data.orderId,
          captureId,
          itemName: updatedOrder.item_name,
          amount: Number(updatedOrder.amount),
          currency: updatedOrder.currency || "USD",
          paymentMethod: "PayPal / Credit Card",
        }).catch((err) => {
          console.error("Automated payment receipt dispatch error:", err);
        });

        try {
          await saveCRMNotificationInDb({
            type: "order_payment",
            title: "New PayPal Payment Received",
            message: `${updatedOrder.customer_name} completed payment of $${updatedOrder.amount} for ${updatedOrder.item_name}`,
            entity_id: updatedOrder.id,
            actor: updatedOrder.customer_name,
          });
        } catch {}
      }

      return {
        success: isCompleted,
        status: captureResult.status,
        captureId,
        order: updatedOrder,
      };
    } catch (error: any) {
      console.error("Error capturing PayPal order:", error);
      // Mark as failed in DB
      try {
        await updateOrderPaymentInDb({
          paypalOrderId: data.orderId,
          paymentStatus: "FAILED",
          rawDetails: error.message,
        });
      } catch {}
      return {
        success: false,
        error: error.message || "Failed to capture PayPal payment.",
      };
    }
  });

/**
 * Fetch all orders for the Admin Portal.
 */
export const fetchOrdersServerFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const orders = await getOrdersFromDb();
    return { success: true, orders };
  } catch (error: any) {
    console.error("Error fetching orders from database:", error);
    return { success: false, orders: [] as Order[], error: error.message };
  }
});

/**
 * Update order payment status (Admin).
 */
export const updateOrderStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: PaymentStatus }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await updateOrderStatusInDb(data.id, data.status);
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

/**
 * Delete order record (Admin).
 */
export const deleteOrderServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      const ok = await deleteOrderFromDb(data.id);
      return { success: ok };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

/**
 * Send or re-send payment receipt email to customer (Admin / Client).
 */
export const sendReceiptEmailServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      customerCompany?: string;
      orderId: string;
      captureId?: string;
      itemName: string;
      amount: number;
      currency?: string;
      paymentMethod?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    try {
      const res = await sendPaymentReceiptEmail(data);
      return res;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

export function formatOrderInvoiceNumber(orderId: string, createdAt?: string): string {
  if (orderId.startsWith("QAS-")) return orderId;
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  const rawId = orderId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `QAS-${year}-${rawId.padStart(6, "0")}`;
}

/**
 * Lookup order by internal ID, PayPal order ID, or capture ID
 */
export const lookupOrderServerFn = createServerFn({ method: "POST" })
  .validator((data: { identifier: string }) => data)
  .handler(async ({ data }) => {
    try {
      if (!data.identifier) {
        return { success: false, error: "Missing order identifier." };
      }
      const order = await getOrderByAnyIdFromDb(data.identifier);
      if (!order) {
        return { success: false, error: "Order not found." };
      }
      return { success: true, order };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

/**
 * Generate official PDF receipt buffer for in-browser download
 */
export const downloadReceiptPdfServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      orderNumber: string;
      issueDate?: string | undefined;
      paymentDate?: string | undefined;
      paymentTime?: string | undefined;
      customerName: string;
      customerEmail: string;
      customerCompany?: string | undefined;
      billingAddress?: string | undefined;
      serviceName: string;
      packageDescription?: string | undefined;
      amount: number;
      currency?: string | undefined;
      paymentMethod?: string | undefined;
      transactionId: string;
    }) => data
  )
  .handler(async ({ data }) => {
    try {
      const buffer = await generateInvoicePdfBuffer({
        orderNumber: data.orderNumber,
        issueDate: data.issueDate,
        paymentDate: data.paymentDate,
        paymentTime: data.paymentTime,
        paymentStatus: "PAID",
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerCompany: data.customerCompany,
        billingAddress: data.billingAddress || "United States",
        serviceName: data.serviceName,
        packageDescription: data.packageDescription || "60 Seconds",
        qty: 1,
        amount: data.amount,
        currency: data.currency || "USD",
        subtotal: data.amount,
        tax: 0,
        total: data.amount,
        paymentMethod: data.paymentMethod || "PayPal",
        transactionId: data.transactionId,
      });

      return {
        success: true,
        filename: `Receipt_${data.orderNumber}.pdf`,
        base64: buffer.toString("base64"),
      };
    } catch (error: any) {
      console.error("PDF Receipt generation failed:", error);
      return { success: false, error: error.message };
    }
  });

/**
 * Server-authoritative Payment Tab Security PIN Verification.
 * The secret PIN is verified on the backend and NEVER exposed in client-side code bundles.
 */
export const verifyPaymentPinServerFn = createServerFn({ method: "POST" })
  .validator((data: { pin: string }) => data)
  .handler(async ({ data }) => {
    try {
      if (!data || typeof data.pin !== "string") {
        return { success: false, error: "PIN is required." };
      }

      const expectedPin = process.env.ADMIN_PAYMENT_PIN || "Admin@8080";
      const isMatch = data.pin.trim() === expectedPin.trim();

      if (isMatch) {
        return { success: true };
      }
      return { success: false, error: "Incorrect security PIN. Please try again." };
    } catch (error: any) {
      console.error("PIN verification error on server:", error);
      return { success: false, error: "Failed to verify security PIN." };
    }
  });

/**
 * Client Broadcast helper for real-time order synchronization across tabs.
 */
export function broadcastOrderEvent(event: {
  type: "NEW_ORDER" | "UPDATE_ORDER" | "DELETE_ORDER";
  order?: Order;
  id?: string;
}) {
  if (typeof window === "undefined") return;
  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("ai_studio_orders_sync");
      bc.postMessage(event);
      bc.close();
    }
    window.dispatchEvent(new CustomEvent("ai_studio_order_event", { detail: event }));
  } catch (e) {
    console.error("Broadcast order event failed:", e);
  }
}

