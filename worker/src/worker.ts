import dotnev from 'dotenv'
import db from './db/database.js'
import { Job, Worker } from 'bullmq'
import { redisConnection } from './config/redis.config.js'
import { processVideoJob } from './processor.js'
import { VideoQueueName } from './types/video.type.js'


dotnev.config()


const worker = new Worker(VideoQueueName, processVideoJob, {connection:redisConnection});

worker.on('completed',(job:Job)=>{
    console.log(`Job with Id:${job.id} completed successfully`)
})

worker.on("failed", ()=>{
    console.log(`Error in processing the job`)
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
