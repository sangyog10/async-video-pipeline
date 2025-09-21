import { Router } from "express";
import { uploadVideo, getAllVideo, getVideo } from "../controllers/videoController.js";
const router = Router();
router.post("/", uploadVideo);
router.get("/", getAllVideo);
router.get("/:videoId", getVideo);
export default router;
