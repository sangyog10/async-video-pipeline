import type { Request, Response } from "express";
import { VideoService } from "../services/videoService.js";

const videoService = new VideoService();

const uploadVideo = async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    try{
       const result =  await videoService.uploadVideo(req.file);
        console.log("Video uploaded successfully")

        res.status(200).json({
            message: 'Video uploaded successfully!',
            result:result,
            fileInfo: {
                filename: req.file!.originalname,
                size: req.file!.size,
                mimetype: req.file!.mimetype
            }
        });
    }catch(err){
        console.log("Error occured:", err)
    }
};

const getAllVideo = async (req: Request, res: Response) => {
    const videos = await videoService.getAllVideo();
    return res.status(200).json({
        message: "Successfully fetched the video",
        video: videos
    });
};

const getVideo = async (req: Request, res: Response) => {
    const videoId = req.params.videoId;
    const video = await videoService.getVideoById(videoId);
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