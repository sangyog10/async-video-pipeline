import type { Request, Response } from "express";
import { VideoService } from "../services/videoService.js";

const videoService = new VideoService();

const uploadVideo = async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const { clientId } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        const result = await videoService.uploadVideo(req.file, clientId);

        console.log("Video uploaded successfully");
        res.status(200).json({
            message: 'Video uploaded successfully!',
            result: result
        });

    } catch (error) {
        console.error("Upload failed:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const getAllVideo = async (req: Request, res: Response) => {
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

const getVideo = async (req: Request, res: Response) => {
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

export {
    uploadVideo,
    getAllVideo,
    getVideo
};