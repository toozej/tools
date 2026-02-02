import { NextRequest, NextResponse } from "next/server";
import { fetchRepoStatus } from "@/lib/repo-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const token = searchParams.get("token");
  // Force parameter bypasses cache - reserved for future use
  // const force = searchParams.get("force") === "true";

  if (!username) {
    return NextResponse.json(
      { error: "Username is required" },
      { status: 400 }
    );
  }

  try {
    // Use provided token, or fall back to GITHUB_TOKEN env var
    const authToken = token || process.env.GITHUB_TOKEN;
    const result = await fetchRepoStatus(username, authToken);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching repo status:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch repository data";
    
    // Return specific error codes for client-side handling
    if (errorMessage.includes("401") || errorMessage.includes("Bad credentials")) {
      return NextResponse.json(
        { error: "Invalid Personal Access Token. Please check your token and try again." },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
