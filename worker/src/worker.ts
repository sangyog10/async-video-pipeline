import dotnev from 'dotenv'
import db from './db/database.js'
import { Job, Worker } from 'bullmq'
import { redisConnection } from './config/redis.config.js'
import { processVideoJob } from './processor.js'
import { deliverWebhook } from './webhookDeliverer.js'
import { VideoQueueName } from './types/video.type.js'
import { webhookDeliveryQueue, WebhookDeliveryQueueName } from './config/webhookQueue.config.js'
import { logger } from './config/logger.config.js'
import {
    jobsStartedTotal,
    jobsCompletedTotal,
    jobsFailedTotal,
    jobDurationHistogram,
    webhookDeliveriesTotal,
    startQueueMetricsPolling,
} from './config/metrics.config.js'
import { startMetricsServer } from './config/metricsServer.js'

dotnev.config()


const worker = new Worker(VideoQueueName, processVideoJob, { connection: redisConnection });

worker.on('active', (job: Job) => {
    jobsStartedTotal.labels(job.name).inc();
});

worker.on('completed', (job: Job) => {
    jobsCompletedTotal.labels(job.name).inc();
    if (job.finishedOn && job.processedOn) {
        jobDurationHistogram.labels(job.name).observe((job.finishedOn - job.processedOn) / 1000);
    }
    logger.info({ jobId: job.id, jobType: job.name }, 'Job completed successfully');
});

worker.on("failed", async (job?: Job) => {
    if (!job) return;
    jobsFailedTotal.labels(job.name).inc();
    logger.error({ jobId: job.id, jobType: job.name }, 'Job permanently failed after all retries');

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
            logger.info({ videoId: job.data.videoId }, 'Scheduled failure webhook');
        } catch (error) {
            logger.error({ err: error, videoId: job.data.videoId }, 'Failed to schedule failure webhook');
        }
    }
})

// Second consumer: delivers signed webhook notifications to the caller
const webhookWorker = new Worker(WebhookDeliveryQueueName, deliverWebhook, { connection: redisConnection });

webhookWorker.on('completed', (job: Job) => {
    webhookDeliveriesTotal.labels(job.data?.event || 'unknown', 'success').inc();
    logger.info({ jobId: job.id, event: job.data?.event }, 'Webhook delivery completed');
})

webhookWorker.on('failed', (job?: Job) => {
    webhookDeliveriesTotal.labels(job?.data?.event || 'unknown', 'failed').inc();
    logger.error({ jobId: job?.id, event: job?.data?.event }, 'Webhook delivery failed permanently');
})


const startServer = async () => {
    try {
        await db.connect()
        startMetricsServer(Number(process.env.METRICS_PORT) || 9100)
        startQueueMetricsPolling()
        logger.info('Worker server started successfully')
    } catch (error) {
        logger.error({ err: error }, 'Failed to start the worker server.');
        process.exit(1);
    }
}

startServer()
