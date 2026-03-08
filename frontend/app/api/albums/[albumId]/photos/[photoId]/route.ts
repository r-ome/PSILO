import { NextRequest, NextResponse } from "next/server";
import { env } from "@/app/lib/env.server";
import logger from "@/app/lib/logger";
import { getValidToken } from "@/app/lib/auth/token";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ albumId: string; photoId: string }> },
) {
  const { albumId, photoId } = await params;
  logger.info(
    { method: "DELETE", route: `/api/albums/${albumId}/photos/${photoId}` },
    "request",
  );

  const accessToken = await getValidToken("access_token");
  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(
      `${env.BACKEND_API_URL}/albums/${albumId}/photos/${photoId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    logger.error({ err }, "unhandled error");
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
