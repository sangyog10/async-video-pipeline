import express from 'express'
import dotnev from 'dotenv'
import cors from 'cors'
import rateLimit from 'express-rate-limit'

import db from './db/database.js'
import apiRouter from './routes/index.js'
import { createBucket } from './config/aws.config.js'
import { VideoBucket } from './types/bucketName.js'
import { retryFailedQueueAdditions } from './cron.js'

dotnev.config()

const app = express()

import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger.config.js';

app.use(cors());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 50, // Limit each IP to 50 requests per `window` 
})

app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.json({ message: "API is working" })
})

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
app.use("/api/v1", apiRouter)


const PORT = process.env.PORT || 3000

const startServer = async () => {
    try {
        await db.connect()
        await createBucket(VideoBucket)
        app.listen(PORT, () => {
            console.log(`Server is ready and listening on PORT: ${PORT}`);
        });
    } catch (error) {
        console.error('Database connection failed. Server not starting.');
        process.exit(1);
    }
}

setInterval(() => {
    retryFailedQueueAdditions().catch(err => console.error("Cron job failed:", err));
}, 5 * 60 * 1000); //run this job every 5 min


startServer()
