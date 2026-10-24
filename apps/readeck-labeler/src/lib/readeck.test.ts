import { afterEach, expect, test } from "bun:test";
import { addLabelsToBookmark, fetchArticle, fetchBookmark, fetchUnlabeledBookmarks, generateLabels, getConfig } from "./readeck";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const readeck = { url: "https://readeck.example", apiToken: "readeck-token" };
const llm = { apiUrl: "https://api.openai.com/v1/chat/completions", apiToken: "llm-token", model: "test-model" };
const bookmark = { id: "abc", url: "https://example.com", title: "Gardening", description: "Grow herbs", labels: [] };

test("uses server values when form fields are empty", () => {
  const keys = ["READECK_URL", "READECK_API_TOKEN", "LLM_API_URL", "LLM_API_TOKEN", "LLM_MODEL"] as const;
  const old = keys.map((key) => process.env[key]);
  try {
    process.env.READECK_URL = "https://readeck.example/";
    process.env.READECK_API_TOKEN = "secret";
    process.env.LLM_API_URL = llm.apiUrl;
    process.env.LLM_API_TOKEN = llm.apiToken;
    process.env.LLM_MODEL = llm.model;
    expect(getConfig({ readeckUrl: "", readeckToken: "" }, true)).toEqual({
      readeck: { url: "https://readeck.example", apiToken: "secret" },
      llm,
    });
  } finally {
    keys.forEach((key, index) => { if (old[index] === undefined) delete process.env[key]; else process.env[key] = old[index]; });
  }
});

test("finds unlabeled bookmarks across offset pages", async () => {
  const offsets: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = new URL(String(input));
    expect(url.searchParams.get("has_labels")).toBe("false");
    offsets.push(url.searchParams.get("offset") || "");
    const page = offsets.length === 1
      ? Array.from({ length: 100 }, (_, index) => ({ ...bookmark, id: String(index) }))
      : [{ ...bookmark, id: "last" }, { ...bookmark, id: "labeled", labels: ["old"] }];
    return Response.json(page);
  }) as typeof fetch;
  const found = await fetchUnlabeledBookmarks(readeck);
  expect(offsets).toEqual(["0", "100"]);
  expect(found).toHaveLength(101);
  expect(found.at(-1)?.id).toBe("last");
});

test("uses saved article text and adds generated labels", async () => {
  const requests: { url: string; method: string; body?: unknown }[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method, body });
    if (url.endsWith("/article.md")) return new Response("Full saved article about growing basil.");
    if (url === llm.apiUrl) return Response.json({ choices: [{ message: { content: "gardening\n3d-printing\ngardening" } }] });
    if (method === "PATCH") return Response.json({ id: bookmark.id });
    return Response.json(bookmark);
  }) as typeof fetch;
  const current = await fetchBookmark(readeck, bookmark.id);
  const article = await fetchArticle(readeck, bookmark.id);
  const labels = await generateLabels(llm, current, article, 2);
  await addLabelsToBookmark(readeck, bookmark.id, labels);
  expect(requests[1].url).toEndWith("/api/bookmarks/abc/article.md");
  expect(JSON.stringify(requests[2].body)).toContain("Full saved article about growing basil.");
  expect(labels).toEqual(["gardening", "3d-printing"]);
  expect(requests[3].body).toEqual({ add_labels: labels });
});

test("supports the Anthropic Messages response", async () => {
  globalThis.fetch = (async (_input, init) => {
    expect((init?.headers as Record<string, string>)["anthropic-version"]).toBe("2023-06-01");
    expect(JSON.parse(String(init?.body)).max_tokens).toBe(256);
    return Response.json({ content: [{ type: "text", text: "gardening\nherbs" }] });
  }) as typeof fetch;
  expect(await generateLabels({ ...llm, apiUrl: "https://api.anthropic.com/v1/messages" }, bookmark, "article", 1)).toEqual(["gardening"]);
});
