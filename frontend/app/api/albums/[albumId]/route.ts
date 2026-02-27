import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/app/lib/env.server";
import logger from "@/app/lib/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const { albumId } = await params;
  logger.info({ method: "GET", route: `/api/albums/${albumId}` }, "request");

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${env.BACKEND_API_URL}/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    logger.error({ err }, "unhandled error");
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
