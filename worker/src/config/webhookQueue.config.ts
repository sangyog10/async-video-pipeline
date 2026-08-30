import { Queue } from "bullmq";
import { redisConnection } from "./redis.config.js";

export const WebhookDeliveryQueueName = "webhook-delivery";

export const webhookDeliveryQueue = new Queue(WebhookDeliveryQueueName, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 30000, // 30s initial, grows with backoff
    },
    removeOnComplete: {
      age: 24 * 3600,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
});
