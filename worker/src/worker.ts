import dotnev from 'dotenv'
import db from './db/database.js'
import { Job, Worker } from 'bullmq'
import { redisConnection } from './config/redis.config.js'
import { processVideoJob } from './processor.js'
import { deliverWebhook } from './webhookDeliverer.js'
import { VideoQueueName } from './types/video.type.js'
import { webhookDeliveryQueue, WebhookDeliveryQueueName } from './config/webhookQueue.config.js'

dotnev.config()


const worker = new Worker(VideoQueueName, processVideoJob, { connection: redisConnection });

worker.on('completed', (job: Job) => {
    console.log(`Job with Id:${job.id} completed successfully`)
})

worker.on("failed", async (job?: Job) => {
    if (!job) return;
    console.log(`Job ${job.id} permanently failed after all retries`);

    // Notify the caller via webhook when one is configured.
    // Fires only on final failure (retries exhausted), not transient retries.
    if (job.data?.webhookUrl) {
        try {
            await webhookDeliveryQueue.add("webhook-delivery", {
                eventId: `wh-${job.data.videoId}-${Date.now()}`,
                event: "video.failed",
                videoId: job.data.videoId,
                url: job.data.webhookUrl,
                secret: job.data.webhookSecret,
                status: "FAILED",
            });
            console.log(`Scheduled failure webhook for video ${job.data.videoId}`);
        } catch (error) {
            console.error(`Failed to schedule failure webhook for video ${job.data.videoId}:`, error);
        }
    }
})

// Second consumer: delivers signed webhook notifications to the caller
const webhookWorker = new Worker(WebhookDeliveryQueueName, deliverWebhook, { connection: redisConnection });

webhookWorker.on('completed', (job: Job) => {
    console.log(`Webhook delivery ${job.id} completed successfully`)
})

webhookWorker.on('failed', (job?: Job) => {
    console.error(`Webhook delivery ${job?.id} failed permanently after all retries`)
})


const startServer = async () => {
    try {
        await db.connect()
        console.log("Worker server started successfully")
    } catch (error) {
        console.error('Failed to start the worker server.');
        process.exit(1);
    }
}

startServer()
