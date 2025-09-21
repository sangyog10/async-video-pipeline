import { Router } from "express";
import { uploadVideo, getAllVideo, getVideo} from "../controllers/videoController.ts";
import upload from "../lib/multer.config.ts";
import { handleUploadErrors } from "../middlewares/multerError.ts";

const router = Router()

router.post("/upload",upload.single('video'),handleUploadErrors, uploadVideo)
router.get("/", getAllVideo)
router.get("/:videoId", getVideo)

export default router