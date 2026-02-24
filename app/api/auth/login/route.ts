import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required!" },
      { status: 400 },
    );
  }

  if (email === "something@gmail.com" && password === "password") {
    return NextResponse.json(
      { message: "success", user: { email } },
      { status: 200 },
    );
  }

  return NextResponse.json({ error: "Invalid Credentials!" }, { status: 400 });
}
