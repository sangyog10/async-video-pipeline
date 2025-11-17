import express from 'express'
import dotnev from 'dotenv'

import db from './db/database.js'
import apiRouter from './routes/index.js'
import { createBucket } from './config/aws.config.js'
import { VideoBucket } from './types/bucketName.js'
import { retryFailedQueueAdditions } from './cron.js'

dotnev.config()

const app = express()

app.get("/", (req, res) => {
    res.json({ message: "API is working" })
})
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

setInterval(retryFailedQueueAdditions, 5 * 60 * 1000); //run this job every 5 min


startServer()
