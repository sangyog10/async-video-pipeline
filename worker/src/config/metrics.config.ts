import client from "prom-client";
import { videoProcessingQueue } from "./queue.config.js";
import { webhookDeliveryQueue } from "./webhookQueue.config.js";

export const register = client.register;

client.collectDefaultMetrics({ register });

export const jobsStartedTotal = new client.Counter({
  name: "video_jobs_started_total",
  help: "Total number of video processing jobs started",
  labelNames: ["jobType"],
});

export const jobsCompletedTotal = new client.Counter({
  name: "video_jobs_completed_total",
  help: "Total number of video processing jobs completed",
  labelNames: ["jobType"],
});

export const jobsFailedTotal = new client.Counter({
  name: "video_jobs_failed_total",
  help: "Total number of video processing jobs failed permanently",
  labelNames: ["jobType"],
});

export const jobDurationHistogram = new client.Histogram({
  name: "video_job_duration_seconds",
  help: "Duration of video processing jobs in seconds",
  labelNames: ["jobType"],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1200],
});

export const webhookDeliveriesTotal = new client.Counter({
  name: "webhook_deliveries_total",
  help: "Total webhook delivery attempts by event and outcome",
  labelNames: ["event", "outcome"],
});

export const queueDepthGauge = new client.Gauge({
  name: "video_queue_depth",
  help: "Current number of jobs in each state for a queue",
  labelNames: ["queue", "state"],
});

const QUEUE_STATES = ["waiting", "active", "delayed", "failed", "completed"] as const;

let pollingTimer: NodeJS.Timeout | null = null;

async function collectQueueDepth(): Promise<void> {
  try {
    const [videoCounts, webhookCounts] = await Promise.all([
      videoProcessingQueue.getJobCounts(),
      webhookDeliveryQueue.getJobCounts(),
    ]);
    for (const state of QUEUE_STATES) {
      queueDepthGauge.labels("video-processing", state).set(videoCounts[state] ?? 0);
      queueDepthGauge.labels("webhook-delivery", state).set(webhookCounts[state] ?? 0);
    }
  } catch {
    // transient Redis/queue errors are ignored; the next tick retries
  }
}

export function startQueueMetricsPolling(intervalMs = 15000): void {
  if (pollingTimer) clearInterval(pollingTimer);
  collectQueueDepth();
  pollingTimer = setInterval(collectQueueDepth, intervalMs);
}
