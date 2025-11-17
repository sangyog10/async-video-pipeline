import { S3Client, CreateBucketCommand, PutObjectCommand, PutObjectCommandOutput, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';


const s3Client = new S3Client({
  endpoint: 'http://minio:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER!,
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD!,
  },
  forcePathStyle: true //for minio
});

export async function createBucket(bucketName: string): Promise<void> {
  try {
    await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
    console.log(`Bucket ${bucketName} created`);
  } catch (err: any) {
    if (err.name !== 'BucketAlreadyOwnedByYou') {
      console.error('Error creating bucket:', err);
    }
  }
}

export async function uploadVideoToAws(
  bucketName: string,
  key: string,
  buffer: Buffer,
  contentType: string = 'video/mp4'
): Promise<PutObjectCommandOutput> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  try {
    const result = await s3Client.send(command);
    return result;
  } catch (err) {
    console.error('Upload error:', err);
    throw err;
  }
}

export async function deleteVideoFromAws(
  bucketName: string,
  key: string
): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key
  })

  try {
    await s3Client.send(command)
    console.log(`Successfully deleted ${key} from ${bucketName}`);
  } catch (error) {
    console.error('S3 Delete error:', error);
    throw error;
  }
}

export async function downloadVideoFromAws(
  bucketName: string,
  key: string,
  destinationDir: string = "./uploads"
): Promise<string> {
  try {
    // Ensure destination directory exists
    if (!existsSync(destinationDir)) {
      mkdirSync(destinationDir, { recursive: true });
    }

    const destinationPath = join(destinationDir, key);

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) throw new Error("No file body returned from S3");

    const writeStream = createWriteStream(destinationPath);

    await new Promise<void>((resolve, reject) => {
      (response.Body as NodeJS.ReadableStream)
        .on("error", reject) //error while reading from s3
        .pipe(writeStream)
        .on("error", reject) //error while writing to disk
        .on("close", resolve);
    });

    console.log(`File downloaded successfully to ${destinationPath}`);
    return destinationPath;
  } catch (err) {
    console.error("Error downloading file:", err);
    throw err;
  }
}

export async function getPresignedDownloadUrl(
  bucketName: string,
  key: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  // Generate a URL valid for 1 hour (3600 seconds)
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
}