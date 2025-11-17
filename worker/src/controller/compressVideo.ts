import path from "path";
import fs from "fs";
import { compressVideo } from "../lib/FF.js";

export const handleVideoCompression = async (videoPath: string, compressionRate:number) => {
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const outputDir = "./uploads";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const targetCompressedPath = path.join(outputDir, `${videoName}_compressed.mp4`);
  await compressVideo(videoPath, targetCompressedPath,compressionRate);
  return targetCompressedPath;
};

