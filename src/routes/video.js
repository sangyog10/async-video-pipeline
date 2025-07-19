const express = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const videoController = require('../controllers/video');

const router = express.Router();

// Public routes (no authentication required)
router.get('/get-video-asset', asyncHandler(videoController.getVideoAsset));

// Protected routes (authentication required)
router.get('/videos', authenticateJWT, asyncHandler(videoController.getVideos));
router.post('/upload-video', authenticateJWT, asyncHandler(videoController.uploadVideo));
router.patch('/video/extract-audio', authenticateJWT, asyncHandler(videoController.extractAudio));
router.put('/video/resize', authenticateJWT, asyncHandler(videoController.resizeVideo));

module.exports = router;