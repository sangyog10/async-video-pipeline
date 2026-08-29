import { Queue, QueueOptions, DefaultJobOptions } from "bullmq";
import { redisConnection } from "./redis.config.js";
import { VideoQueueName } from "../types/video.type.js";

const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: {
    age: 3600,
    count: 1000,
  },
  removeOnFail: {
    age: 24 * 3600,
  },
};

const queueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: defaultJobOptions,
};

export const videoProcessingQueue = new Queue(VideoQueueName, queueOptions);
