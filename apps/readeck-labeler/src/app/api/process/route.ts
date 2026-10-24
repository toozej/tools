import { NextRequest, NextResponse } from "next/server";
import { addLabelsToBookmark, fetchArticle, fetchBookmark, generateLabels, getConfig } from "@/lib/readeck";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body?.bookmarkId;
    const maxLabels = body?.maxLabels;
    if (typeof id !== "string" || !id || id.length > 100 || !Number.isInteger(maxLabels) || maxLabels < 1 || maxLabels > 10) {
      return NextResponse.json({ error: "Provide a bookmark ID and a label limit from 1 to 10." }, { status: 400 });
    }
    const { readeck, llm } = getConfig(body, true);
    if (!llm) throw new Error("LLM configuration is missing.");
    const bookmark = await fetchBookmark(readeck, id);
    if (bookmark.labels.length > 0) {
      return NextResponse.json({ error: "This bookmark already has labels. Fetch the list again." }, { status: 409 });
    }
    const article = await fetchArticle(readeck, id);
    const labels = await generateLabels(llm, bookmark, article, maxLabels);
    await addLabelsToBookmark(readeck, id, labels);
    return NextResponse.json({ bookmarkId: id, title: bookmark.title, labels, success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not process bookmark." },
      { status: 400 }
    );
  }
}
