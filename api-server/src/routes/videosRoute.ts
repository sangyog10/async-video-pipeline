import { Router } from "express";
import upload from "../config/multer.config.js";
import { handleUploadErrors } from "../middlewares/multerError.js";
import { uploadLimiter, statusLimiter } from "../config/rateLimit.config.js";
import { extractAudioFromVideo, getAllVideo, getVideoIdAndDownloadVideo, resizeVideo, compressVideo, createThumbnail, trimVideo, createGif, addWatermark, getUploadUrl } from "../controller/videoController.js";

const router = Router();

/**
 * @swagger
 * /videos/presigned-url:
 *   post:
 *     summary: Get a presigned URL for uploading a file
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: The name of the file
 *               fileType:
 *                 type: string
 *                 description: The MIME type of the file
 *     responses:
 *       200:
 *         description: Presigned URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                 key:
 *                   type: string
 *                 bucket:
 *                   type: string
 *       400:
 *         description: Bad request (missing fileName or fileType)
 *       500:
 *         description: Internal server error
 */
router.post("/presigned-url", uploadLimiter, getUploadUrl);

/**
 * @swagger
 * components:
 *   schemas:
 *     Video:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the video
 *         original_bucket:
 *           type: string
 *           description: The S3 bucket where the original video is stored
 *         original_object_key:
 *           type: string
 *           description: The S3 key of the original video
 *         status:
 *           type: string
 *           description: The processing status of the video
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date the video was uploaded
 */

/**
 * @swagger
 * /videos/extract-audio:
 *   post:
 *     summary: Extract audio from a video
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: The video file to upload
 *               clientId:
 *                 type: string
 *                 description: The ID of the client
 *     responses:
 *       202:
 *         description: Video uploaded and processing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   $ref: '#/components/schemas/Video'
 *       400:
 *         description: Bad request (missing file or clientId)
 *       500:
 *         description: Internal server error
 */
router.post("/extract-audio", uploadLimiter, upload.single('video'), handleUploadErrors, extractAudioFromVideo);

/**
 * @swagger
 * /videos/resize:
 *   post:
 *     summary: Resize a video
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: The video file to upload
 *               clientId:
 *                 type: string
 *                 description: The ID of the client
 *               height:
 *                 type: integer
 *                 description: The target height
 *               width:
 *                 type: integer
 *                 description: The target width
 *     responses:
 *       202:
 *         description: Video uploaded and processing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   $ref: '#/components/schemas/Video'
 *       400:
 *         description: Bad request (missing file, clientId, height, or width)
 *       500:
 *         description: Internal server error
 */
router.post("/resize", uploadLimiter, upload.single('video'), handleUploadErrors, resizeVideo);

/**
 * @swagger
 * /videos/compress:
 *   post:
 *     summary: Compress a video
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: The video file to upload
 *               clientId:
 *                 type: string
 *                 description: The ID of the client
 *               compression:
 *                 type: integer
 *                 description: Compression rate (default 28)
 *     responses:
 *       202:
 *         description: Video uploaded and processing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   $ref: '#/components/schemas/Video'
 *       400:
 *         description: Bad request (missing file or clientId)
 *       500:
 *         description: Internal server error
 */
router.post("/compress", uploadLimiter, upload.single('video'), handleUploadErrors, compressVideo);

/**
 * @swagger
 * /videos/create-thumbnail:
 *   post:
 *     summary: Create a thumbnail from a video
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: The video file to upload
 *               clientId:
 *                 type: string
 *                 description: The ID of the client
 *               timestamp:
 *                 type: integer
 *                 description: Timestamp in seconds for the thumbnail
 *     responses:
 *       202:
 *         description: Video uploaded and processing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   $ref: '#/components/schemas/Video'
 *       400:
 *         description: Bad request (missing file, clientId, or timestamp)
 *       500:
 *         description: Internal server error
 */
router.post("/create-thumbnail", uploadLimiter, upload.single('video'), handleUploadErrors, createThumbnail);

/**
 * @swagger
 * /videos/trim:
 *   post:
 *     summary: Trim a video to a time range
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: The video file to upload
 *               clientId:
 *                 type: string
 *                 description: The ID of the client
 *               startTime:
 *                 type: integer
 *                 description: Start time in seconds (>= 0)
 *               endTime:
 *                 type: integer
 *                 description: End time in seconds (must be greater than startTime)
 *     responses:
 *       202:
 *         description: Video uploaded and processing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   $ref: '#/components/schemas/Video'
 *       400:
 *         description: Bad request (missing file, clientId, startTime, or endTime)
 *       500:
 *         description: Internal server error
 */
router.post("/trim", uploadLimiter, upload.single('video'), handleUploadErrors, trimVideo);

/**
 * @swagger
 * /videos/create-gif:
 *   post:
 *     summary: Create a looping GIF from a video
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: The video file to upload
 *               clientId:
 *                 type: string
 *                 description: The ID of the client
 *               fps:
 *                 type: integer
 *                 description: Frames per second (default 10)
 *               width:
 *                 type: integer
 *                 description: Output width in pixels, height auto (default 480)
 *               startTime:
 *                 type: integer
 *                 description: Start time in seconds (default 0)
 *               duration:
 *                 type: integer
 *                 description: Duration in seconds (default: whole video)
 *     responses:
 *       202:
 *         description: Video uploaded and processing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   $ref: '#/components/schemas/Video'
 *       400:
 *         description: Bad request (missing file, clientId, or invalid params)
 *       500:
 *         description: Internal server error
 */
router.post("/create-gif", uploadLimiter, upload.single('video'), handleUploadErrors, createGif);

/**
 * @swagger
 * /videos/add-watermark:
 *   post:
 *     summary: Overlay a watermark image onto a video
 *     description: Upload the watermark image first via the presigned URL endpoint, then pass its bucket/key along with the video.
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: The ID of the client
 *               bucket:
 *                 type: string
 *                 description: Bucket of the pre-uploaded video
 *               key:
 *                 type: string
 *                 description: Key of the pre-uploaded video
 *               fileName:
 *                 type: string
 *                 description: Original video file name
 *               watermarkBucket:
 *                 type: string
 *                 description: Bucket of the pre-uploaded watermark image
 *               watermarkKey:
 *                 type: string
 *                 description: Key of the pre-uploaded watermark image
 *               position:
 *                 type: string
 *                 enum: [top-left, top-right, center, bottom-left, bottom-right]
 *                 description: Watermark position (default bottom-right)
 *               opacity:
 *                 type: number
 *                 description: Opacity 0-1 (default 1)
 *               watermarkWidth:
 *                 type: integer
 *                 description: Target watermark width in px, height auto (default: original size)
 *     responses:
 *       202:
 *         description: Video uploaded and processing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   $ref: '#/components/schemas/Video'
 *       400:
 *         description: Bad request (missing clientId, watermarkBucket, or invalid params)
 *       500:
 *         description: Internal server error
 */
router.post("/add-watermark", uploadLimiter, upload.single('video'), handleUploadErrors, addWatermark);

/**
 * @swagger
 * /videos:
 *   get:
 *     summary: Get all videos
 *     tags: [Videos]
 *     responses:
 *       200:
 *         description: List of all videos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 video:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Video'
 *       500:
 *         description: Internal server error
 */
router.get("/", statusLimiter, getAllVideo);

/**
 * @swagger
 * /videos/{videoId}:
 *   get:
 *     summary: Get a video by ID
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         schema:
 *           type: string
 *         required: true
 *         description: The video ID
 *     responses:
 *       200:
 *         description: Video details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 video:
 *                   $ref: '#/components/schemas/Video'
 *       500:
 *         description: Internal server error
 */
router.get("/:videoId", statusLimiter, getVideoIdAndDownloadVideo);

export default router;