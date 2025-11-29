import type { Request, Response } from "express";
import { VideoService } from "../services/videoService.js";
import { JobStatus, VideoEditType } from "../types/videoType.js";
import { videoProcessingQueue } from "../config/queue.config.js";
import db from "../db/database.js";

import { getPresignedUploadUrl } from "../config/aws.config.js";
import { VideoBucket } from "../types/bucketName.js";

const videoService = new VideoService();

export const getUploadUrl = async (req: Request, res: Response) => {
    try {
        const { fileName, fileType } = req.body;
        if (!fileName || !fileType) {
            return res.status(400).json({ error: 'fileName and fileType are required' });
        }

        const key = `${Date.now()}-${fileName}`;
        const bucketName = VideoBucket;

        const url = await getPresignedUploadUrl(bucketName, key, fileType);

        return res.status(200).json({
            url,
            key,
            bucket: bucketName
        });
    } catch (error) {
        console.error("Failed to generate upload URL:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const extractAudioFromVideo = async (req: Request, res: Response) => {
    try {
        const { clientId, bucket, key, fileName } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        let videoRecord;

        if (bucket && key) {
            // Pre-uploaded file flow
            if (!fileName) {
                return res.status(400).json({ error: 'fileName is required for pre-uploaded files' });
            }
            videoRecord = await videoService.registerVideo({
                title: fileName,
                clientId,
                bucketName: bucket,
                key
            });
            console.log("Video registered successfully (pre-uploaded)");
        } else if (req.file) {
            // Legacy upload flow
            videoRecord = await videoService.uploadVideo(req.file, clientId);
            console.log("Video uploaded successfully");
        } else {
            return res.status(400).json({ error: 'No file uploaded or bucket/key provided' });
        }

        const { original_bucket, original_object_key } = videoRecord;
        try {
            await videoProcessingQueue.add(VideoEditType.EXTRACT_AUDIO, {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
            }, {
                jobId: `video-${videoRecord.id}`
            })
            await db.query(
                'UPDATE Video SET status = $1 WHERE id = $2',
                [JobStatus.UPLOADED, videoRecord.id]
            );
            console.log("Video added to the queue and updated the status")

        } catch (queueError) {
            console.error("Failed to add to queue:", queueError);
            await db.query(
                'UPDATE Video SET status = $1  WHERE id = $2',
                [JobStatus.QUEUE_FAILED, videoRecord.id]
            );
            throw queueError
        }

        res.status(202).json({
            message: 'Video uploaded and being processed, please come back later!',
            result: videoRecord
        });

    } catch (error) {
        console.error("Upload failed:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const resizeVideo = async (req: Request, res: Response) => {
    try {
        const { clientId, height, width, bucket, key, fileName } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        if (!height || !width) {
            return res.status(400).json({ error: 'Please provide height and width' });
        }

        const dimension = {
            height: height,
            width: width
        }

        let videoRecord;

        if (bucket && key) {
            // Pre-uploaded file flow
            if (!fileName) {
                return res.status(400).json({ error: 'fileName is required for pre-uploaded files' });
            }
            videoRecord = await videoService.registerVideo({
                title: fileName,
                clientId,
                bucketName: bucket,
                key
            });
            console.log("Video registered successfully (pre-uploaded)");
        }
        else if (req.file) {
            // Legacy upload flow
            videoRecord = await videoService.uploadVideo(req.file, clientId);
            console.log("Video uploaded successfully");
        }
        else {
            return res.status(400).json({ error: 'No file uploaded or bucket/key provided' });
        }

        const { original_bucket, original_object_key } = videoRecord;
        try {
            await videoProcessingQueue.add(VideoEditType.RESIZE_VIDEO, {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
                dimension
            }, {
                jobId: `video-${videoRecord.id}`
            })
            await db.query(
                'UPDATE Video SET status = $1 WHERE id = $2',
                [JobStatus.UPLOADED, videoRecord.id]
            );
            console.log("Video added to the queue and updated the status")

        } catch (queueError) {
            console.error("Failed to add to queue:", queueError);
            await db.query(
                'UPDATE Video SET status = $1  WHERE id = $2',
                [JobStatus.QUEUE_FAILED, videoRecord.id]
            );
            return videoRecord
        }

        res.status(202).json({
            message: 'Video uploaded and being processed, please come back later!',
            result: videoRecord
        });
    } catch (error) {
        console.error("Upload failed:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const compressVideo = async (req: Request, res: Response) => {
    try {
        let compressionRate: number;
        const { clientId, compression, preset, bucket, key, fileName } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }
        if (!compression) {
            compressionRate = 28; // balanced ratio, medium quality and size
        } else {
            compressionRate = Number(compression);
        }

        let videoRecord;

        if (bucket && key) {
            // Pre-uploaded file flow
            if (!fileName) {
                return res.status(400).json({ error: 'fileName is required for pre-uploaded files' });
            }
            videoRecord = await videoService.registerVideo({
                title: fileName,
                clientId,
                bucketName: bucket,
                key
            });
            console.log("Video registered successfully (pre-uploaded)");
        } else if (req.file) {
            // Legacy upload flow
            videoRecord = await videoService.uploadVideo(req.file, clientId);
            console.log("Video uploaded successfully for compression");
        } else {
            return res.status(400).json({ error: 'No file uploaded or bucket/key provided' });
        }

        const { original_bucket, original_object_key } = videoRecord;
        try {
            await videoProcessingQueue.add(VideoEditType.COMPRESS_VIDEO, {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
                compressionRate: compressionRate,
                preset: preset || "ultrafast"
            }, {
                jobId: `video-${videoRecord.id}`
            })
            await db.query(
                'UPDATE Video SET status = $1 WHERE id = $2',
                [JobStatus.UPLOADED, videoRecord.id]
            );
            console.log("Video added to the queue and updated the status")

        } catch (queueError) {
            console.error("Failed to add to queue:", queueError);
            await db.query(
                'UPDATE Video SET status = $1  WHERE id = $2',
                [JobStatus.QUEUE_FAILED, videoRecord.id]
            );
            throw queueError
        }

        res.status(202).json({
            message: 'Video uploaded and being processed, please come back later!',
            result: videoRecord
        });

    } catch (error) {
        console.error("Upload failed:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const createThumbnail = async (req: Request, res: Response) => {
    try {
        const { clientId, timestamp, bucket, key, fileName } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        if (!timestamp) {
            return res.status(400).json({ error: 'Please provide thumbnail time in seconds' });
        }

        let videoRecord;

        if (bucket && key) {
            // Pre-uploaded file flow
            if (!fileName) {
                return res.status(400).json({ error: 'fileName is required for pre-uploaded files' });
            }
            videoRecord = await videoService.registerVideo({
                title: fileName,
                clientId,
                bucketName: bucket,
                key
            });
            console.log("Video registered successfully (pre-uploaded)");
        } else if (req.file) {
            // Legacy upload flow
            videoRecord = await videoService.uploadVideo(req.file, clientId);
            console.log("Video uploaded successfully for thumbnail creation");
        } else {
            return res.status(400).json({ error: 'No file uploaded or bucket/key provided' });
        }

        const { original_bucket, original_object_key } = videoRecord;
        try {
            await videoProcessingQueue.add(VideoEditType.CREATE_THUMBNAIL, {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
                timestamp: timestamp
            }, {
                jobId: `video-${videoRecord.id}`
            })
            await db.query(
                'UPDATE Video SET status = $1 WHERE id = $2',
                [JobStatus.UPLOADED, videoRecord.id]
            );
            console.log("Video added to the queue and updated the status")

        } catch (queueError) {
            console.error("Failed to add to queue:", queueError);
            await db.query(
                'UPDATE Video SET status = $1  WHERE id = $2',
                [JobStatus.QUEUE_FAILED, videoRecord.id]
            );
            throw queueError
        }

        res.status(202).json({
            message: 'Video uploaded and being processed, please come back later!',
            result: videoRecord
        });

    } catch (error) {
        console.error("Upload failed:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getAllVideo = async (req: Request, res: Response) => {
    try {
        const videos = await videoService.getAllVideo();
        return res.status(200).json({
            message: "Successfully fetched the video",
            video: videos
        });
    } catch (error) {
        console.error("Failed to get all videos:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getVideoIdAndDownloadVideo = async (req: Request, res: Response) => {
    try {
        const videoId = req.params.videoId;
        const result = await videoService.getVideoByIdAndDownloadVideo(videoId);
        return res.status(200).json({
            message: "Success",
            video: result
        });
    } catch (error: any) {
        console.error("Failed to get video:", error);
        return res.status(500).json({ message: error.message });
    }
};
