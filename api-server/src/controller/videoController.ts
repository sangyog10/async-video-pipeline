import type { Request, Response } from "express";
import { VideoService } from "../services/videoService.js";
import { VideoEditType } from "../types/videoType.js";

import { getPresignedUploadUrl } from "../config/aws.config.js";
import { VideoBucket } from "../types/bucketName.js";
import { isSafeWebhookUrl } from "../utils/webhook.js";
import { subscribeToVideo, unsubscribeFromVideo } from "../config/sseHub.js";

const videoService = new VideoService();

const validateWebhook = async (webhookUrl?: string): Promise<string | null> => {
    if (webhookUrl && !(await isSafeWebhookUrl(webhookUrl))) {
        return 'webhookUrl must be a public http(s) URL';
    }
    return null;
};

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
        const { clientId, bucket, key, fileName, webhookUrl, webhookSecret } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        const webhookError = await validateWebhook(webhookUrl);
        if (webhookError) {
            return res.status(400).json({ error: webhookError });
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
                key,
                webhookUrl,
                webhookSecret
            });
            console.log("Video registered successfully (pre-uploaded)");
        } else if (req.file) {
            // Legacy upload flow
            videoRecord = await videoService.uploadVideo(req.file, clientId, webhookUrl, webhookSecret);
            console.log("Video uploaded successfully");
        } else {
            return res.status(400).json({ error: 'No file uploaded or bucket/key provided' });
        }

        const { original_bucket, original_object_key } = videoRecord;
        await videoService.enqueueVideoJob(
            videoRecord,
            VideoEditType.EXTRACT_AUDIO,
            {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
            }
        );
        console.log("Video added to the queue and updated the status");

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
        const { clientId, height, width, bucket, key, fileName, webhookUrl, webhookSecret } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        const webhookError = await validateWebhook(webhookUrl);
        if (webhookError) {
            return res.status(400).json({ error: webhookError });
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
                key,
                webhookUrl,
                webhookSecret
            });
            console.log("Video registered successfully (pre-uploaded)");
        }
        else if (req.file) {
            // Legacy upload flow
            videoRecord = await videoService.uploadVideo(req.file, clientId, webhookUrl, webhookSecret);
            console.log("Video uploaded successfully");
        }
        else {
            return res.status(400).json({ error: 'No file uploaded or bucket/key provided' });
        }

        const { original_bucket, original_object_key } = videoRecord;
        await videoService.enqueueVideoJob(
            videoRecord,
            VideoEditType.RESIZE_VIDEO,
            {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
                dimension,
            }
        );
        console.log("Video added to the queue and updated the status");

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
        const { clientId, compression, preset, bucket, key, fileName, webhookUrl, webhookSecret } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        const webhookError = await validateWebhook(webhookUrl);
        if (webhookError) {
            return res.status(400).json({ error: webhookError });
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
                key,
                webhookUrl,
                webhookSecret
            });
            console.log("Video registered successfully (pre-uploaded)");
        } else if (req.file) {
            // Legacy upload flow
            videoRecord = await videoService.uploadVideo(req.file, clientId, webhookUrl, webhookSecret);
            console.log("Video uploaded successfully for compression");
        } else {
            return res.status(400).json({ error: 'No file uploaded or bucket/key provided' });
        }

        const { original_bucket, original_object_key } = videoRecord;
        await videoService.enqueueVideoJob(
            videoRecord,
            VideoEditType.COMPRESS_VIDEO,
            {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
                compressionRate: compressionRate,
                preset: preset || "ultrafast",
            }
        );
        console.log("Video added to the queue and updated the status");

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
        const { clientId, timestamp, bucket, key, fileName, webhookUrl, webhookSecret } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        const webhookError = await validateWebhook(webhookUrl);
        if (webhookError) {
            return res.status(400).json({ error: webhookError });
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
                key,
                webhookUrl,
                webhookSecret
            });
            console.log("Video registered successfully (pre-uploaded)");
        } else if (req.file) {
            // Legacy upload flow
            videoRecord = await videoService.uploadVideo(req.file, clientId, webhookUrl, webhookSecret);
            console.log("Video uploaded successfully for thumbnail creation");
        } else {
            return res.status(400).json({ error: 'No file uploaded or bucket/key provided' });
        }

        const { original_bucket, original_object_key } = videoRecord;
        await videoService.enqueueVideoJob(
            videoRecord,
            VideoEditType.CREATE_THUMBNAIL,
            {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
                timestamp: timestamp,
            }
        );
        console.log("Video added to the queue and updated the status");

        res.status(202).json({
            message: 'Video uploaded and being processed, please come back later!',
            result: videoRecord
        });

    } catch (error) {
        console.error("Upload failed:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const trimVideo = async (req: Request, res: Response) => {
    try {
        const { clientId, startTime, endTime, bucket, key, fileName, webhookUrl, webhookSecret } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        const webhookError = await validateWebhook(webhookUrl);
        if (webhookError) {
            return res.status(400).json({ error: webhookError });
        }

        if (startTime === undefined || endTime === undefined) {
            return res.status(400).json({ error: 'Please provide startTime and endTime in seconds' });
        }

        const start = Number(startTime);
        const end = Number(endTime);

        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
            return res.status(400).json({ error: 'startTime must be >= 0 and endTime must be greater than startTime' });
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
                key,
                webhookUrl,
                webhookSecret
            });
            console.log("Video registered successfully (pre-uploaded)");
        } else if (req.file) {
            // Legacy upload flow
            videoRecord = await videoService.uploadVideo(req.file, clientId, webhookUrl, webhookSecret);
            console.log("Video uploaded successfully for trimming");
        } else {
            return res.status(400).json({ error: 'No file uploaded or bucket/key provided' });
        }

        const { original_bucket, original_object_key } = videoRecord;
        await videoService.enqueueVideoJob(
            videoRecord,
            VideoEditType.TRIM_VIDEO,
            {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
                startTime: start,
                endTime: end,
            }
        );
        console.log("Video added to the queue and updated the status");

        res.status(202).json({
            message: 'Video uploaded and being processed, please come back later!',
            result: videoRecord
        });

    } catch (error) {
        console.error("Upload failed:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const createGif = async (req: Request, res: Response) => {
    try {
        const { clientId, fps, width, startTime, duration, bucket, key, fileName, webhookUrl, webhookSecret } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        const webhookError = await validateWebhook(webhookUrl);
        if (webhookError) {
            return res.status(400).json({ error: webhookError });
        }

        const gifFps = fps === undefined ? 10 : Number(fps);
        const gifWidth = width === undefined ? 480 : Number(width);
        const gifStartTime = startTime === undefined ? 0 : Number(startTime);
        const gifDuration = duration === undefined ? undefined : Number(duration);

        if (!Number.isFinite(gifFps) || gifFps <= 0 || gifFps > 60) {
            return res.status(400).json({ error: 'fps must be a number between 1 and 60' });
        }
        if (!Number.isFinite(gifWidth) || gifWidth <= 0 || gifWidth > 1920) {
            return res.status(400).json({ error: 'width must be a number between 1 and 1920' });
        }
        if (!Number.isFinite(gifStartTime) || gifStartTime < 0) {
            return res.status(400).json({ error: 'startTime must be a number >= 0' });
        }
        if (gifDuration !== undefined && (!Number.isFinite(gifDuration) || gifDuration <= 0)) {
            return res.status(400).json({ error: 'duration must be a positive number' });
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
                key,
                webhookUrl,
                webhookSecret
            });
            console.log("Video registered successfully (pre-uploaded)");
        } else if (req.file) {
            // Legacy upload flow
            videoRecord = await videoService.uploadVideo(req.file, clientId, webhookUrl, webhookSecret);
            console.log("Video uploaded successfully for GIF creation");
        } else {
            return res.status(400).json({ error: 'No file uploaded or bucket/key provided' });
        }

        const { original_bucket, original_object_key } = videoRecord;
        await videoService.enqueueVideoJob(
            videoRecord,
            VideoEditType.CREATE_GIF,
            {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
                fps: gifFps,
                width: gifWidth,
                startTime: gifStartTime,
                duration: gifDuration,
            }
        );
        console.log("Video added to the queue and updated the status");

        res.status(202).json({
            message: 'Video uploaded and being processed, please come back later!',
            result: videoRecord
        });

    } catch (error) {
        console.error("Upload failed:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const VALID_WATERMARK_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

export const addWatermark = async (req: Request, res: Response) => {
    try {
        const { clientId, position, opacity, watermarkWidth, bucket, key, fileName, watermarkBucket, watermarkKey, webhookUrl, webhookSecret } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        const webhookError = await validateWebhook(webhookUrl);
        if (webhookError) {
            return res.status(400).json({ error: webhookError });
        }

        if (!watermarkBucket || !watermarkKey) {
            return res.status(400).json({ error: 'watermarkBucket and watermarkKey are required (upload the watermark image first)' });
        }

        const pos = position || 'bottom-right';
        if (!VALID_WATERMARK_POSITIONS.includes(pos)) {
            return res.status(400).json({ error: `position must be one of: ${VALID_WATERMARK_POSITIONS.join(', ')}` });
        }

        const opacityValue = opacity === undefined ? 1 : Number(opacity);
        if (!Number.isFinite(opacityValue) || opacityValue < 0 || opacityValue > 1) {
            return res.status(400).json({ error: 'opacity must be a number between 0 and 1' });
        }

        const widthValue = watermarkWidth === undefined ? undefined : Number(watermarkWidth);
        if (widthValue !== undefined && (!Number.isFinite(widthValue) || widthValue <= 0 || widthValue > 1920)) {
            return res.status(400).json({ error: 'watermarkWidth must be a number between 1 and 1920' });
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
                key,
                webhookUrl,
                webhookSecret
            });
            console.log("Video registered successfully (pre-uploaded)");
        } else if (req.file) {
            // Legacy upload flow
            videoRecord = await videoService.uploadVideo(req.file, clientId, webhookUrl, webhookSecret);
            console.log("Video uploaded successfully for watermarking");
        } else {
            return res.status(400).json({ error: 'No file uploaded or bucket/key provided' });
        }

        const { original_bucket, original_object_key } = videoRecord;
        await videoService.enqueueVideoJob(
            videoRecord,
            VideoEditType.ADD_WATERMARK,
            {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
                watermarkBucket,
                watermarkKey,
                position: pos,
                opacity: opacityValue,
                watermarkWidth: widthValue,
            }
        );
        console.log("Video added to the queue and updated the status");

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

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'QUEUE_FAILED', 'DELETED'];

export const streamVideoStatus = async (req: Request, res: Response) => {
    const videoId = req.params.videoId;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let initial: any;
    try {
        initial = await videoService.getVideoByIdAndDownloadVideo(videoId);
    } catch (error: any) {
        send('error', { message: error.message || 'Video not found' });
        res.end();
        return;
    }

    send('snapshot', initial);

    // If the job already finished, the snapshot is the final state
    if (TERMINAL_STATUSES.includes(initial?.status)) {
        res.end();
        return;
    }

    const handlers = {
        onProgress: (progress: number) => send('progress', { progress }),
        onCompleted: async () => {
            const final = await videoService.getVideoByIdAndDownloadVideo(videoId);
            send('completed', final);
            res.end();
        },
        onFailed: async () => {
            const final = await videoService.getVideoByIdAndDownloadVideo(videoId);
            send('failed', final);
            res.end();
        },
    };

    subscribeToVideo(videoId, handlers);

    // Heartbeat keeps proxies/load balancers from closing the idle connection
    const heartbeat = setInterval(() => {
        res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribeFromVideo(videoId, handlers);
    });
};
