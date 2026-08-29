import { videoProcessingQueue } from "./config/queue.config.js";
import db from "./db/database.js";
import { Video } from "./types/videoType.js";

export async function retryFailedQueueAdditions() {
  const failedVideos = await db.query<Video>(
    "SELECT * FROM Video WHERE status = 'QUEUE_FAILED' AND created_at > NOW() - INTERVAL '24 hours'"
  );

  for (const video of failedVideos) {
    if (!video.job_type || !video.job_params) {
      console.error(`Video ${video.id} is QUEUE_FAILED but missing job metadata; skipping`);
      continue;
    }

    try {
      await videoProcessingQueue.add(video.job_type, video.job_params, {
        jobId: `video-${video.id}`,
      });
      await db.query(
        'UPDATE Video SET status = $1 WHERE id = $2',
        ['UPLOADED', video.id]
      );
    } catch (error) {
      console.error(`Still failing to queue video ${video.id}:`, error);
    }
  }
}
