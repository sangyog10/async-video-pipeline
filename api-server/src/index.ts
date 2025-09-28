import express from 'express'
import dotnev from 'dotenv'

import apiRouter from './routes/index.js'

dotnev.config()

const app = express()


app.use("/api/v1", apiRouter)


const PORT = process.env.PORT || 3000
app.listen(PORT, ()=>{
    console.log(`Server is running in port ${PORT}`)
})
