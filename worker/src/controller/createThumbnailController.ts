import path from "path";
import fs from "fs";
import { createThumbnail } from "../lib/index.js";

export const handleThumbnailCreation = async (videoPath: string, timestamp:number) => {
    const videoName = path.basename(videoPath, path.extname(videoPath));
    const outputDir = "./uploads";
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const targetThumbnailPath = path.join(outputDir, `${videoName}_thumbnail.png`);
    await createThumbnail(videoPath, targetThumbnailPath, timestamp); 
    return targetThumbnailPath;
};

