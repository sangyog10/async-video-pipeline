import path from "path";
import fs from "fs";
import { trimVideo } from "../lib/index.js";

export const handleVideoTrim = async (
  videoPath: string,
  startTime: number,
  endTime: number,
  onProgress?: (progress: number) => void
) => {
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const outputDir = "./uploads";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const targetTrimmedPath = path.join(outputDir, `${videoName}_trimmed.mp4`);
  await trimVideo(videoPath, targetTrimmedPath, startTime, endTime, onProgress);
  return targetTrimmedPath;
};
