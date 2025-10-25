import { Job } from "bullmq";
import db from "./db/database.js";
import { downloadVideoFromAws } from "./config/aws.config.js";

export const processVideoJob = async (job: Job) => {
  const { videoId } = job.data;

  // update db status to processing

  // fetch video from s3

  // send video to ffmpeg for editing according to the user's request

  //update status to completed

  //if anything fails, update status to failed
};
