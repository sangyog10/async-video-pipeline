import express from 'express'
import dotnev from 'dotenv'

import db from './db/database.js'
import apiRouter from './routes/index.js'

dotnev.config()

const app = express()


app.use("/api/v1", apiRouter)


const PORT = process.env.PORT || 3000

const startServer = async () => {
    try {
        await db.connect()
        app.listen(PORT, () => {
            console.log(`Server is ready and listening on PORT: ${PORT}`);
        });
    } catch (error) {
        console.error('Database connection failed. Server not starting.');
        process.exit(1);
    }
}

startServer()
