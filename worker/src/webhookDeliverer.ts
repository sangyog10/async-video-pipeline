import { Job } from "bullmq";
import crypto from "node:crypto";
import db from "./db/database.js";

export interface WebhookDeliveryData {
  eventId: string;
  event: string;
  videoId: number;
  url: string;
  secret?: string;
  status: string;
  downloadUrl?: string;
}

/**
 * Deliver a webhook notification with HMAC-SHA256 signing and a 10s timeout.
 * Non-2xx responses or network errors throw so BullMQ retries with backoff.
 */
export const deliverWebhook = async (job: Job): Promise<void> => {
  const { eventId, event, videoId, url, secret, status, downloadUrl } = job.data as WebhookDeliveryData;

  const payload = {
    event,
    data: {
      videoId,
      status,
      ...(downloadUrl ? { downloadUrl } : {}),
    },
  };
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secret || "").update(body).digest("hex");

  await upsertDelivery(eventId, videoId, event, url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Event-ID": eventId,
        "X-Webhook-Signature": signature,
      },
      body,
      signal: controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timeout);
    const message = error?.message || "Webhook delivery failed";
    await recordAttempt(eventId, message, 0);
    throw error;
  }

  clearTimeout(timeout);

  if (!response.ok) {
    const message = `Webhook returned HTTP ${response.status}`;
    await recordAttempt(eventId, message, response.status);
    throw new Error(message);
  }

  await recordAttempt(eventId, null, response.status);
};

async function upsertDelivery(eventId: string, videoId: number, event: string, url: string): Promise<void> {
  await db.query(
    `INSERT INTO webhook_deliveries (event_id, video_id, event, url, status)
     VALUES ($1, $2, $3, $4, 'PENDING')
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, videoId, event, url]
  );
}

async function recordAttempt(eventId: string, error: string | null, httpStatus: number): Promise<void> {
  const status = error ? "FAILED" : "SUCCESS";
  await db.query(
    `UPDATE webhook_deliveries
     SET status = $1, http_status = $2, error = $3, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
     WHERE event_id = $4`,
    [status, httpStatus || null, error, eventId]
  );
}
