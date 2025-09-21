import express from 'express'
import dotnev from 'dotenv'

import videoRoute from './routes/videosRoute.js'


dotnev.config()

const app = express()

app.use("/api/v1/videos",videoRoute)



const PORT = process.env.PORT
app.listen(PORT, ()=>{
    console.log(`Server is running in port ${PORT}`)
})