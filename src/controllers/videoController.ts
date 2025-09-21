import type{ Request, Response } from "express";

const uploadVideo = (req:Request, res:Response) => {
    console.log("Uploading video")
}

const getAllVideo = (req:Request, res:Response) => {
  console.log("Fetching all videos");
}

const getVideo = (req:Request, res:Response) => {
  console.log("Fetching video:");
}


export {
    uploadVideo,
    getAllVideo,
    getVideo
}