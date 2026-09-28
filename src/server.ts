import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const captured = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(captured);
  const detail = captured instanceof Error ? captured.message : String(captured);
  return new Response(renderErrorPage(detail), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.hostname === "www.quickuppaistudio.in" || url.hostname === "www.quickuppaistudio.com" || url.hostname === "quickuppaistudio.com") {
        url.hostname = "quickuppaistudio.in";
        url.protocol = "https:";
        return Response.redirect(url.toString(), 301);
      }

      // Calendly Webhook & Direct Integration Endpoint
      if (url.pathname === "/api/calendly-webhook" || url.pathname === "/api/calendly") {
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
          });
        }

        if (request.method === "GET") {
          return new Response(
            JSON.stringify({
              status: "active",
              service: "Quickupp AI Studio Calendly Webhook Service",
              endpoint: url.pathname,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            }
          );
        }

        if (request.method === "POST") {
          try {
            const body = await request.json();
            const { saveCalendlyMeeting, saveLead, addActivityLog, saveCRMNotification } = await import("./lib/db");

            const eventType = body.event || "invitee.created";
            const payload = body.payload || body;
            const invitee = payload.invitee || payload;
            const scheduledEvent = payload.scheduled_event || payload.event || {};

            const clientName = invitee.name || payload.name || payload.client_name || "Calendly Client";
            const clientEmail = invitee.email || payload.email || "client@calendly.com";
            const clientPhone = invitee.text_reminder_number || payload.phone || "";
            const startTime = scheduledEvent.start_time || payload.start_time || new Date().toISOString();
            const eventTitle = scheduledEvent.name || payload.meeting_type || "AI Video Strategy Call (30 min)";
            const joinUrl =
              scheduledEvent.location?.join_url ||
              payload.meeting_link ||
              payload.join_url ||
              "https://calendly.com/quickuppaistudio";

            const parsedDate = new Date(startTime);
            const meetingDate = !isNaN(parsedDate.getTime())
              ? parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const meetingTime = !isNaN(parsedDate.getTime())
              ? parsedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + " EST"
              : "3:00 PM EST";

            let status = "scheduled";
            if (eventType.includes("canceled") || eventType.includes("cancelled")) {
              status = "cancelled";
            } else if (eventType.includes("rescheduled")) {
              status = "rescheduled";
            }

            const meeting = await saveCalendlyMeeting({
              client_name: clientName,
              email: clientEmail,
              phone: clientPhone,
              meeting_date: meetingDate,
              meeting_time: meetingTime,
              meeting_status: status,
              meeting_link: joinUrl,
              meeting_type: eventTitle,
              notes: `Received via Calendly Webhook (${eventType})`,
            });

            await saveCRMNotification({
              type: status === "cancelled" ? "meeting_cancelled" : "meeting_new",
              title: status === "cancelled" ? "Meeting Cancelled" : "New Calendly Meeting Booked",
              message: `${clientName} scheduled a strategy call for ${meetingDate} at ${meetingTime}`,
              entity_id: meeting.id,
              actor: "Calendly",
            });

            return new Response(
              JSON.stringify({ success: true, meeting_id: meeting.id }),
              {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
              }
            );
          } catch (err: any) {
            console.error("Calendly Webhook error in server.ts:", err);
            return new Response(JSON.stringify({ success: false, error: err.message }), {
              status: 500,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
          }
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      const headers = new Headers(normalized.headers);
      headers.set("X-Robots-Tag", "index, follow");
      return new Response(normalized.body, {
        status: normalized.status,
        statusText: normalized.statusText,
        headers,
      });
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : String(error);
      return new Response(renderErrorPage(detail), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8", "X-Robots-Tag": "index, follow" },
      });
    }
  },
};
