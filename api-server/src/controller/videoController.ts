import type { Request, Response } from "express";
import { VideoService } from "../services/videoService.js";

const videoService = new VideoService();

const uploadVideo = async(req: Request, res: Response) => {
    console.log('Video processed successfully by controller:', req.file);
    await videoService.uploadVideo()
    res.status(200).json({
        message: 'Video uploaded successfully!',
        fileInfo: {
            filename: req.file!.filename,
            path: req.file!.path,
            size: req.file!.size,
            mimetype: req.file!.mimetype
        }
    });
}

const getAllVideo = async(req: Request, res: Response) => {
    const videos = await videoService.getAllVideo()
    return res.status(200).json({
        message: "Success",
        video: videos
    })
}

const getVideo = async(req: Request, res: Response) => {
    const video = await videoService.getVideoById()
    return res.status(200).json({
        message: "Success",
        video: video
    })
}


export {
    uploadVideo,
    getAllVideo,
    getVideo
}