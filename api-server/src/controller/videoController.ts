import type { Request, Response } from "express";
import { VideoService } from "../services/videoService.js";
import { JobStatus, VideoEditType } from "../types/videoType.js";
import { videoProcessingQueue } from "../config/queue.config.js";
import db from "../db/database.js";

const videoService = new VideoService();

export const extractAudioFromVideo = async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const { clientId } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        const videoRecord = await videoService.uploadVideo(req.file, clientId);
        console.log("Video uploaded successfully");

        const { original_bucket, original_object_key } = videoRecord;
        try {
            await videoProcessingQueue.add(VideoEditType.EXTRACT_AUDIO, {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
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
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const { clientId, height, width } = req.body;

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

        const videoRecord = await videoService.uploadVideo(req.file, clientId);
        console.log("Video uploaded successfully");

        const { original_bucket, original_object_key } = videoRecord;
        try {
            await videoProcessingQueue.add(VideoEditType.RESIZE_VIDEO, {
                videoId: videoRecord.id,
                bucket: original_bucket,
                key: original_object_key,
                dimension
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

export const getVideo = async (req: Request, res: Response) => {
    try {
        const videoId = req.params.videoId;
        const video = await videoService.getVideoById(videoId);
        return res.status(200).json({
            message: "Success",
            video: video
        });
    } catch (error) {
        console.error("Failed to get video:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
