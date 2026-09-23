// Server-side PayPal REST API integration for Quickupp AI Studio
// Never import this file on client/browser.

function getPayPalConfig() {
  const clientId =
    process.env.PAYPAL_CLIENT_ID ||
    process.env.VITE_PAYPAL_CLIENT_ID ||
    "";
  const clientSecret =
    process.env.PAYPAL_CLIENT_SECRET ||
    process.env.VITE_PAYPAL_CLIENT_SECRET ||
    "";
  const rawEnv = (
    process.env.PAYPAL_ENVIRONMENT ||
    process.env.VITE_PAYPAL_ENVIRONMENT ||
    "sandbox"
  ).toLowerCase();

  const isLive = rawEnv === "live" || rawEnv === "production";
  const baseUrl = isLive
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    environment: isLive ? "live" : "sandbox",
    baseUrl,
  };
}

export function getPublicPayPalConfig() {
  const { clientId, environment } = getPayPalConfig();
  return {
    clientId,
    environment,
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Retrieves PayPal OAuth2 Access Token using Client ID and Secret.
 * Uses in-memory token cache to prevent redundant token requests.
 */
export async function getPayPalAccessToken(): Promise<string> {
  const { clientId, clientSecret, baseUrl } = getPayPalConfig();

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal API credentials missing. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in environment variables."
    );
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.token;
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("PayPal OAuth2 token generation failed:", res.status, errText);
    throw new Error(`PayPal authentication error (${res.status}): Failed to authenticate with PayPal.`);
  }

  const data = (await res.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };

  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

export interface CreateOrderParams {
  amount: number;
  currency?: string;
  itemName: string;
  customId?: string;
  customerName?: string;
  customerEmail?: string;
}

/**
 * Creates a PayPal Order server-side with intent CAPTURE and validated amount.
 */
export async function createPayPalOrderApi(params: {
  amount: number;
  currency?: string;
  itemName: string;
  customId?: string;
  customerName?: string;
  customerEmail?: string;
}) {
  const { baseUrl } = getPayPalConfig();
  const token = await getPayPalAccessToken();

  const formattedAmount = params.amount.toFixed(2);
  const currency = params.currency || "USD";

  const payload: Record<string, any> = {
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: params.customId || undefined,
        description: params.itemName.slice(0, 127),
        amount: {
          currency_code: currency,
          value: formattedAmount,
          breakdown: {
            item_total: {
              currency_code: currency,
              value: formattedAmount,
            },
          },
        },
        items: [
          {
            name: params.itemName.slice(0, 127),
            unit_amount: {
              currency_code: currency,
              value: formattedAmount,
            },
            quantity: "1",
            category: "DIGITAL_GOODS",
          },
        ],
      },
    ],
    application_context: {
      brand_name: "Quickupp AI Studio",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
      shipping_preference: "NO_SHIPPING",
    },
  };

  if (params.customerEmail || params.customerName) {
    payload.payer = {
      email_address: params.customerEmail || undefined,
      name: params.customerName
        ? {
            given_name: params.customerName.split(" ")[0] || "Customer",
            surname: params.customerName.split(" ").slice(1).join(" ") || undefined,
          }
        : undefined,
    };
  }

  const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("PayPal Create Order API Error:", res.status, errorBody);
    throw new Error(`PayPal Order Creation failed (${res.status}).`);
  }

  const orderData = await res.json();
  return orderData as {
    id: string;
    status: string;
    links: Array<{ href: string; rel: string; method: string }>;
  };
}

/**
 * Captures an approved PayPal Order server-side and verifies the response.
 */
export async function capturePayPalOrderApi(orderId: string) {
  const { baseUrl } = getPayPalConfig();
  const token = await getPayPalAccessToken();

  const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("PayPal Capture Order API Error:", res.status, errorBody);
    throw new Error(`PayPal Payment Capture failed (${res.status}).`);
  }

  const captureData = (await res.json()) as {
    id: string;
    status: string;
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{
          id: string;
          status: string;
          amount?: { currency_code: string; value: string };
        }>;
      };
    }>;
    payer?: {
      email_address?: string;
      name?: { given_name?: string; surname?: string };
    };
  };

  return captureData;
}
