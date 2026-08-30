import { EventEmitter } from "node:events";
import { QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import { VideoQueueName } from "../types/videoType.js";

const redisOptions = {
  port: parseInt(process.env.REDIS_PORT || '6379'),
  host: process.env.REDIS_HOST || 'localhost',
  maxRetriesPerRequest: null,
};

// QueueEvents needs its own dedicated connection (it must not share the
// queue's Redis client). A single shared instance is used by every SSE
// connection to avoid one Redis client per connection.
const queueEvents = new QueueEvents(VideoQueueName, {
  connection: new Redis(redisOptions),
});

queueEvents.on('error', (err) => {
  console.error('QueueEvents error:', err);
});

// In-process hub that fans queue events out to subscribed SSE connections
const hub = new EventEmitter();

const parseVideoId = (jobId: string | undefined): string | null => {
  if (!jobId) return null;
  const prefix = 'video-';
  if (!jobId.startsWith(prefix)) return null; // skip delete-* jobs etc.
  return jobId.slice(prefix.length);
};

queueEvents.on('progress', ({ jobId, data }) => {
  const videoId = parseVideoId(jobId);
  if (videoId) hub.emit(`progress:${videoId}`, data);
});

queueEvents.on('completed', ({ jobId }) => {
  const videoId = parseVideoId(jobId);
  if (videoId) hub.emit(`completed:${videoId}`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  const videoId = parseVideoId(jobId);
  if (videoId) hub.emit(`failed:${videoId}`, failedReason);
});

export interface VideoSubscription {
  onProgress: (progress: number) => void;
  onCompleted: () => void;
  onFailed: (reason?: string) => void;
}

export function subscribeToVideo(videoId: string, handlers: VideoSubscription): void {
  hub.on(`progress:${videoId}`, handlers.onProgress);
  hub.on(`completed:${videoId}`, handlers.onCompleted);
  hub.on(`failed:${videoId}`, handlers.onFailed);
}

export function unsubscribeFromVideo(videoId: string, handlers: VideoSubscription): void {
  hub.off(`progress:${videoId}`, handlers.onProgress);
  hub.off(`completed:${videoId}`, handlers.onCompleted);
  hub.off(`failed:${videoId}`, handlers.onFailed);
}
