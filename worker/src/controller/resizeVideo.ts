import path from "path";
import fs from "fs";
import { resizeVideo } from "../lib/FF.js";

export const handleVideoResize = async (
  videoPath: string,
  width: number,
  height: number
) => {
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const outputDir = "./uploads";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const targetVideoPath = path.join(outputDir, `${videoName}-${width}x${height}.mp4`);
  await resizeVideo(videoPath, targetVideoPath, width, height);
  return targetVideoPath;
};