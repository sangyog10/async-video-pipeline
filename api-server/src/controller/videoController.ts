import type { Request, Response } from "express";
import { VideoService } from "../services/videoService.js";

const videoService = new VideoService();

const uploadVideo = async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const result = await videoService.uploadVideo(req.file);
    console.log("Video uploaded successfully")
    res.status(200).json({
        message: 'Video uploaded successfully!',
        url: result.url,
        fileInfo: {
            filename: req.file!.originalname,
            size: req.file!.size,
            mimetype: req.file!.mimetype
        }
    });
};

const getAllVideo = async (req: Request, res: Response) => {
    const videos = await videoService.getAllVideo();
    return res.status(200).json({
        message: "Success",
        video: videos
    });
};

const getVideo = async (req: Request, res: Response) => {
    const video = await videoService.getVideoById();
    return res.status(200).json({
        message: "Success",
        video: video
    });
};

export {
    uploadVideo,
    getAllVideo,
    getVideo
};