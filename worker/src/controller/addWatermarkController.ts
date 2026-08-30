import path from "path";
import fs from "fs";
import { addWatermark } from "../lib/index.js";
import type { WatermarkOptions } from "../lib/index.js";

export const handleAddWatermark = async (
  videoPath: string,
  watermarkPath: string,
  options: WatermarkOptions,
  onProgress?: (progress: number) => void
) => {
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const outputDir = "./uploads";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const targetWatermarkedPath = path.join(outputDir, `${videoName}_watermarked.mp4`);
  await addWatermark(videoPath, watermarkPath, targetWatermarkedPath, options, onProgress);
  return targetWatermarkedPath;
};
