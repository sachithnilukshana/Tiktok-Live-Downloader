import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const s3 = new S3Client({
  endpoint: config.b2.endpoint,
  region: config.b2.region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.b2.accessKeyId,
    secretAccessKey: config.b2.secretAccessKey
  }
});

export async function verifyBucket() {
  // Bucket creation is deliberately done in the Backblaze console. The application
  // key can be restricted to one bucket and need not have account-wide permissions.
  await s3.send(new HeadBucketCommand({ Bucket: config.b2.bucket }));
}

export async function uploadRecording(localPath, username, startedAt) {
  const stamp = new Date(startedAt).toISOString().replaceAll(':', '-');
  const key = `${config.b2.prefix}/${username}/${stamp}.mkv`;
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: config.b2.bucket,
      Key: key,
      Body: createReadStream(localPath),
      ContentType: 'video/x-matroska',
      Metadata: { creator: username, recordedat: startedAt }
    },
    queueSize: 3,
    partSize: 16 * 1024 * 1024,
    leavePartsOnError: false
  });
  await upload.done();
  const url = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: config.b2.bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${path.basename(localPath)}"`
  }), { expiresIn: config.b2.linkExpiry });
  return { key, url };
}
