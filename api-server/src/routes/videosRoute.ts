import { Router } from "express";
import { uploadVideo, getAllVideo, getVideo} from "../services/videoService.js";
import upload from "../lib/multer.config.js";
import { handleUploadErrors } from "../middlewares/multerError.js";

const router = Router()

router.post("/upload",upload.single('video'),handleUploadErrors, uploadVideo)
router.get("/", getAllVideo)
router.get("/:videoId", getVideo)

export default router