import { compressVideo } from "./compressVideo.js";
import { createGif } from "./createGif.js";
import { createThumbnail } from "./createThumbnail.js";
import { extractAudio } from "./extractAudio.js";
import { resizeVideo } from "./resizeVideo.js";
import { trimVideo } from "./trimVideo.js";
import { addWatermark } from "./addWatermark.js";
import type { GifOptions } from "./createGif.js";
import type { WatermarkOptions, WatermarkPosition } from "./addWatermark.js";

export { compressVideo, createGif, createThumbnail, extractAudio, resizeVideo, trimVideo, addWatermark };
export type { GifOptions, WatermarkOptions, WatermarkPosition };
