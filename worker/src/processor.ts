import { Job } from "bullmq";
import db from "./db/database.js";
import { downloadVideoFromAws } from "./config/aws.config.js";

const destinationPath = './uploads'

export const processVideoJob = async (job: Job) => {
  const { videoId, bucketName, key, work } = job.data;

  // update db status to processing
  await db.query(
    'UPDATE Video SET status = $1 WHERE id = $2',
    ['PROCESSING', videoId]
  );

  // fetch video from s3
  await downloadVideoFromAws(bucketName, key, destinationPath)

  // send video to ffmpeg for editing according to the user's request

  //update status to completed and upload video to s3

  //delete video locally

  //if anything fails, update status to failed and delete video 
};
