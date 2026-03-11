import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  RestoreObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq, and, inArray } from "drizzle-orm";
import { createDb } from "../../shared/db";
import {
  photos,
  retrievalBatches,
  retrievalRequests,
} from "../../shared/schema";

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const RESTORE_RETENTION_DAYS = parseInt(process.env.RESTORE_RETENTION_DAYS ?? "7", 10);

function respond(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * Parses the S3 Restore header to determine if a restored copy is available.
 * Header format: `ongoing-request="false", expiry-date="..."` (restored)
 *                `ongoing-request="true"` (in progress)
 */
function isRestoredCopyAvailable(restore: string | undefined): boolean {
  if (!restore) return false;
  return restore.includes('ongoing-request="false"');
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const sub = event.requestContext.authorizer.jwt.claims["sub"] as string;

  let body: {
    keys?: string[];
    tier?: string;
    albumId?: string;
    batchType?: string;
  };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return respond(400, { message: "Invalid JSON body" });
  }

  const { keys, tier = "Standard", albumId, batchType } = body;

  if (!keys || !Array.isArray(keys) || keys.length === 0) {
    return respond(400, { message: "keys array is required" });
  }

  const db = createDb();

  // Verify ownership: all keys must belong to the authenticated user
  const dbPhotos = await db
    .select()
    .from(photos)
    .where(and(inArray(photos.s3Key, keys), eq(photos.userId, sub)));

  if (dbPhotos.length !== keys.length) {
    return respond(403, { message: "Forbidden" });
  }

  const standardUrls: { key: string; url: string }[] = [];
  const glacierPhotosTracking: Array<{ photo: (typeof dbPhotos)[0] }> = [];
  let glacierInitiated = false;
  let glacierAlreadyInProgress = false;

  await Promise.all(
    dbPhotos.map(async (photo) => {
      // Always check the real S3 state — the DB storageClass may lag behind
      // if the EventBridge lifecycle-transition event hasn't fired yet.
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: photo.s3Key }),
      );

      const actualStorageClass = head.StorageClass ?? "STANDARD";
      const isGlacier =
        actualStorageClass === "GLACIER" ||
        actualStorageClass === "DEEP_ARCHIVE";

      if (!isGlacier || isRestoredCopyAvailable(head.Restore)) {
        // Either genuinely STANDARD, or a Glacier restore has already completed
        // and a temporary copy is available — serve a presigned URL.
        const url = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: photo.s3Key,
            ResponseContentDisposition: `attachment; filename="${photo.filename}"`,
          }),
          { expiresIn: 3600 },
        );
        standardUrls.push({ key: photo.s3Key, url });
      } else {
        // Object is in Glacier and not yet restored — initiate a restore.
        try {
          await s3.send(
            new RestoreObjectCommand({
              Bucket: BUCKET_NAME,
              Key: photo.s3Key,
              RestoreRequest: {
                Days: RESTORE_RETENTION_DAYS,
                GlacierJobParameters: {
                  Tier: tier as "Expedited" | "Standard" | "Bulk",
                },
              },
            }),
          );
          glacierInitiated = true;
          glacierPhotosTracking.push({ photo });
        } catch (err: unknown) {
          if (
            err &&
            typeof err === "object" &&
            "name" in err &&
            err.name === "RestoreAlreadyInProgress"
          ) {
            glacierAlreadyInProgress = true;
            glacierPhotosTracking.push({ photo });
          } else {
            throw err;
          }
        }
      }
    }),
  );

  // Create tracking records if any Glacier restores were initiated or already in progress
  if (glacierPhotosTracking.length > 0) {
    const detectedBatchType =
      batchType ?? (keys.length === 1 ? "SINGLE" : "MANUAL");
    const tierUppercase = tier.toUpperCase();
    const totalSize = glacierPhotosTracking.reduce(
      (sum, { photo }) => sum + (photo.size ?? 0),
      0,
    );

    const [batch] = await db
      .insert(retrievalBatches)
      .values({
        userId: sub,
        batchType: detectedBatchType,
        sourceId: albumId ?? null,
        retrievalTier: tierUppercase,
        status: "PENDING",
        totalFiles: glacierPhotosTracking.length,
        totalSize,
      })
      .returning();

    await db.insert(retrievalRequests).values(
      glacierPhotosTracking.map(({ photo }) => ({
        batchId: batch.id,
        userId: sub,
        photoId: photo.id,
        s3Key: photo.s3Key,
        fileSize: photo.size ?? 0,
        status: "PENDING",
      })),
    );
  }

  return respond(200, {
    standardUrls,
    glacierInitiated,
    glacierAlreadyInProgress,
  });
};
