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
  updateOrderStatus as updateOrderStatusInDb,
  deleteOrder as deleteOrderFromDb,
  type Order,
  type PaymentStatus,
} from "./db";

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
      if (captures && captures.length > 0) {
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
