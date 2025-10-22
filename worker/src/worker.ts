import dotnev from 'dotenv'
import db from './db/database.js'


dotnev.config()



const startServer = async () => {
    try {
        await db.connect()
        console.log("Worker started successfully")
    } catch (error) {
        console.error('Failed to start the worker service.');
        process.exit(1);
    }
}

startServer()
