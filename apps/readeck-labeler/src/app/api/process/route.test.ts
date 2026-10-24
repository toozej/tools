import { afterEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { POST } from "./route";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function request(maxLabels: number) {
  return new NextRequest("http://localhost/readeck-labeler/api/process", {
    method: "POST",
    body: JSON.stringify({
      readeckUrl: "https://readeck.example",
      readeckToken: "readeck-token",
      llmUrl: "https://api.openai.com/v1/chat/completions",
      llmToken: "llm-token",
      llmModel: "test-model",
      bookmarkId: "abc",
      maxLabels,
    }),
  });
}

test("processes one saved article and applies its labels", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    calls.push(`${init?.method || "GET"} ${url}`);
    if (url.endsWith("/article.md")) return new Response("Saved article text");
    if (url.includes("openai.com")) {
      expect(JSON.parse(String(init?.body)).messages[1].content).toContain("Saved article text");
      return Response.json({ choices: [{ message: { content: "reading\nbooks" } }] });
    }
    if (init?.method === "PATCH") {
      expect(JSON.parse(String(init.body))).toEqual({ add_labels: ["reading", "books"] });
      return Response.json({ id: "abc" });
    }
    return Response.json({ id: "abc", title: "A book", url: "https://example.com", description: "", labels: [] });
  }) as typeof fetch;
  const response = await POST(request(2));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ bookmarkId: "abc", title: "A book", labels: ["reading", "books"], success: true });
  expect(calls).toHaveLength(4);
});

test("rejects an invalid label limit before API calls", async () => {
  globalThis.fetch = (() => { throw new Error("Unexpected API request"); }) as unknown as typeof fetch;
  const response = await POST(request(11));
  expect(response.status).toBe(400);
});

test("does not apply labels when a bookmark already has labels", async () => {
  let count = 0;
  globalThis.fetch = (async () => {
    count++;
    return Response.json({ id: "abc", labels: ["existing"] });
  }) as unknown as typeof fetch;
  const response = await POST(request(2));
  expect(response.status).toBe(409);
  expect(count).toBe(1);
});
