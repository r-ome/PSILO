import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/app/lib/env.server";
import logger from "@/app/lib/logger";

async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("access_token")?.value ?? null;
}

export async function GET() {
  logger.info({ method: "GET", route: "/api/albums" }, "request");

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${env.BACKEND_API_URL}/albums`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    logger.error({ err }, "unhandled error");
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  logger.info({ method: "POST", route: "/api/albums" }, "request");

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  try {
    const response = await fetch(`${env.BACKEND_API_URL}/albums`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    logger.error({ err }, "unhandled error");
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
