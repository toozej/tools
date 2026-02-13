import { NextRequest, NextResponse } from "next/server";
import { isTokenEnabled, hasEnvToken, disableToken, enableToken } from "@/lib/github";

export async function GET() {
  return NextResponse.json({
    enabled: isTokenEnabled(),
    envPresent: hasEnvToken(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "disable") {
      disableToken();
      return NextResponse.json({
        success: true,
        enabled: false,
        envPresent: hasEnvToken(),
      });
    }

    if (action === "enable") {
      enableToken();
      const enabled = isTokenEnabled();
      return NextResponse.json({
        success: true,
        enabled,
        envPresent: hasEnvToken(),
        message: enabled ? "Token enabled from environment" : "Token not available in environment",
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'enable' or 'disable'." },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
