import { DefaultJobOptions, Queue, QueueOptions } from "bullmq";
import { redisConnection } from "./redis.config.js";
import { VideoQueueName } from "../types/videoType.js";


const defaultJobOptions: DefaultJobOptions = {
    attempts: 3, // Retry failed jobs 3 times
    backoff: {     // Exponential backoff strategy
        type: 'exponential',
        delay: 5000, // 5 seconds
    },
    removeOnComplete: { // Keep completed jobs for 1 hour
        age: 3600,
        count: 1000,
    },
    removeOnFail: { // Keep failed jobs for 24 hours
        age: 24 * 3600,
    },
};

const queueOptions: QueueOptions = {
    connection: redisConnection,
    defaultJobOptions: defaultJobOptions
}

export const videoProcessingQueue = new Queue(VideoQueueName, queueOptions)

