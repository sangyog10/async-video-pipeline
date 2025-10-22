import { Router } from "express";
import upload from "../config/multer.config.js";
import { handleUploadErrors } from "../middlewares/multerError.js";
import { uploadVideo, getAllVideo, getVideo } from "../controller/videoController.js";

const router = Router()

router.post("/upload",upload.single('video'),handleUploadErrors, uploadVideo)
router.get("/", getAllVideo)
router.get("/:videoId", getVideo)

export default router