import type { Request, Response } from "express";
import path from "path";
import multer from "multer";

const uploadVideo = (req: Request, res: Response) => {
    console.log('Video processed successfully by controller:', req.file);

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

const getAllVideo = (req: Request, res: Response) => {
  console.log("Fetching all videos");
}

const getVideo = (req: Request, res: Response) => {
  console.log("Fetching video:");
}


export {
  uploadVideo,
  getAllVideo,
  getVideo
}