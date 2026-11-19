import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    checked: 0,
    cancelled: 0,
    message: "Automatic order expiry and reservation cleanup are disabled.",
    executedAt: new Date().toISOString(),
  });
}
