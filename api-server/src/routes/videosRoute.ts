import { Router } from "express";
import upload from "../config/multer.config.js";
import { handleUploadErrors } from "../middlewares/multerError.js";
import { extractAudioFromVideo, getAllVideo, getVideoIdAndDownloadVideo, resizeVideo,compressVideo ,createThumbnail} from "../controller/videoController.js";

const router = Router()

router.post("/extract-audio",upload.single('video'),handleUploadErrors, extractAudioFromVideo)

router.post("/resize",upload.single('video'),handleUploadErrors, resizeVideo)

router.post("/compress",upload.single('video'),handleUploadErrors, compressVideo)

router.post("/create-thumbnail",upload.single('video'),handleUploadErrors, createThumbnail)


router.get("/", getAllVideo)
router.get("/:videoId", getVideoIdAndDownloadVideo)

export default router