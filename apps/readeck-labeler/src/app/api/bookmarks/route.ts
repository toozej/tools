import { NextRequest, NextResponse } from "next/server";
import { fetchUnlabeledBookmarks, getConfig } from "@/lib/readeck";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { readeck } = getConfig(body);
    const bookmarks = await fetchUnlabeledBookmarks(readeck);
    return NextResponse.json({ bookmarks, count: bookmarks.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not fetch bookmarks." },
      { status: 400 }
    );
  }
}
