import { Router } from 'express'
import videoRoute from './videosRoute.js'

const router = Router()

router.use("/videos",videoRoute)




export default router