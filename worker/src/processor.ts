import { Job } from "bullmq";

export const processVideoJob = async (job: Job) => {
  const { videoId } = job.data;

  console.log(`Processing the Job: ${videoId}`);

  await new Promise((resolve) => setTimeout(resolve, 10000));

  console.log("Successfully processed the job");
};
