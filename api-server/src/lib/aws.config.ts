import { S3Client, CreateBucketCommand,PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';


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


export async function uploadVideoToAws(bucketName: string, key: string, buffer: Buffer, contentType: string = 'video/mp4'): Promise<string | undefined> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1hr signed URL
    return url;
  } catch (err) {
    console.error('Upload error:', err);
  }
}