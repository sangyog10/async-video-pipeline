import express from 'express'
import dotnev from 'dotenv'


dotnev.config()


const app = express()

const PORT = process.env.PORT
app.listen(PORT, ()=>{
    console.log(`Server is running in port ${PORT}`)
})