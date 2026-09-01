import express, { type Request, type Response, type NextFunction } from 'express'
import dotnev from 'dotenv'
import cors from 'cors'
import { pinoHttp } from 'pino-http'

import db from './db/database.js'
import apiRouter from './routes/index.js'
import { createBucket } from './config/aws.config.js'
import { VideoBucket } from './types/bucketName.js'
import { retryFailedQueueAdditions } from './cron.js'
import { logger } from './config/logger.config.js'
import { metricsHandler, httpMetricsMiddleware } from './config/metrics.config.js'
import { healthHandler } from './config/health.config.js'
import { videoProcessingQueue } from './config/queue.config.js'

import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger.config.js';

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

dotnev.config()

const app = express()

app.use(cors());

app.use(pinoHttp({ logger }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prometheus metrics middleware (must run after body parsers, before routes)
app.use(httpMetricsMiddleware);

app.get("/", (req, res) => {
    res.json({ message: "API is working" })
})

app.get("/metrics", metricsHandler);

app.get("/health", healthHandler);

// Bull Board: real-time queue inspector, optionally behind basic auth
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({ queues: [new BullMQAdapter(videoProcessingQueue)], serverAdapter });

const boardAuth = (req: Request, res: Response, next: NextFunction) => {
    const user = process.env.BULL_BOARD_USER;
    const pass = process.env.BULL_BOARD_PASSWORD;
    if (!user || !pass) return next();
    const header = req.headers.authorization || '';
    const expected = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
    if (header === expected) return next();
    res.set('WWW-Authenticate', 'Basic realm="Bull Board"');
    return res.status(401).send('Unauthorized');
};

app.use('/admin/queues', boardAuth, serverAdapter.getRouter());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
app.use("/api/v1", apiRouter)


const PORT = process.env.PORT || 3000

const startServer = async () => {
    try {
        await db.connect()
        await createBucket(VideoBucket)
        app.listen(PORT, () => {
            logger.info({ port: PORT }, 'Server is ready and listening');
        });
    } catch (error) {
        logger.error({ err: error }, 'Database connection failed. Server not starting.');
        process.exit(1);
    }
}

setInterval(() => {
    retryFailedQueueAdditions().catch(err => logger.error({ err }, "Cron job failed"));
}, 5 * 60 * 1000); //run this job every 5 min


startServer()
