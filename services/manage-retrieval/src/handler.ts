import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { eq, desc } from "drizzle-orm";
import { createDb } from "../../shared/db";
import { retrievalBatches, retrievalRequests, photos } from "../../shared/schema";

function respond(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const sub = event.requestContext.authorizer.jwt.claims["sub"] as string;
  const routeKey = event.routeKey;
  const db = createDb();

  if (routeKey === "GET /retrieval/batches") {
    const batches = await db
      .select()
      .from(retrievalBatches)
      .where(eq(retrievalBatches.userId, sub))
      .orderBy(desc(retrievalBatches.requestedAt));

    return respond(200, { batches });
  }

  if (routeKey === "GET /retrieval/batches/{batchId}") {
    const batchId = event.pathParameters?.batchId;
    if (!batchId) return respond(400, { message: "Missing batchId" });

    const [batch] = await db
      .select()
      .from(retrievalBatches)
      .where(eq(retrievalBatches.id, batchId))
      .limit(1);

    if (!batch) return respond(404, { message: "Not found" });
    if (batch.userId !== sub) return respond(403, { message: "Forbidden" });

    const requests = await db
      .select({
        id: retrievalRequests.id,
        batchId: retrievalRequests.batchId,
        photoId: retrievalRequests.photoId,
        s3Key: retrievalRequests.s3Key,
        filename: photos.filename,
        fileSize: retrievalRequests.fileSize,
        status: retrievalRequests.status,
        retrievalLink: retrievalRequests.retrievalLink,
        requestedAt: retrievalRequests.requestedAt,
        availableAt: retrievalRequests.availableAt,
        expiresAt: retrievalRequests.expiresAt,
      })
      .from(retrievalRequests)
      .leftJoin(photos, eq(retrievalRequests.photoId, photos.id))
      .where(eq(retrievalRequests.batchId, batchId));

    return respond(200, { batch, requests });
  }

  return respond(404, { message: "Not found" });
};
