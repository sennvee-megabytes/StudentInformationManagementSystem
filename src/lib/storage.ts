import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const ASSETS_BUCKET = "assets";

const globalForS3 = globalThis as unknown as { s3Client?: S3Client };

/**
 * Branch-aware S3 client wired to Neon Object Storage (`AWS_*` env vars injected by `neon deploy`).
 * Per the `neon-object-storage` skill, `forcePathStyle: true` is required because Neon uses path-style addressing.
 */
export function getStorageClient(): S3Client {
  if (!globalForS3.s3Client) {
    globalForS3.s3Client = new S3Client({
      forcePathStyle: true,
    });
  }
  return globalForS3.s3Client;
}

export async function uploadAsset(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
) {
  const s3 = getStorageClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: ASSETS_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return { bucket: ASSETS_BUCKET, key };
}

export async function downloadAsset(key: string): Promise<Uint8Array> {
  const s3 = getStorageClient();
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: ASSETS_BUCKET,
      Key: key,
    })
  );
  if (!res.Body) {
    throw new Error(`Empty object body for key: ${key}`);
  }
  return res.Body.transformToByteArray();
}

export async function getAssetPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const s3 = getStorageClient();
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: ASSETS_BUCKET,
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  );
}

export async function assetExists(key: string): Promise<boolean> {
  const s3 = getStorageClient();
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: ASSETS_BUCKET,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteAsset(key: string): Promise<void> {
  const s3 = getStorageClient();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: ASSETS_BUCKET,
      Key: key,
    })
  );
}
