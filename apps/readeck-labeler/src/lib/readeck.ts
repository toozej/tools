export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string;
  labels: string[];
}

export interface ReadeckConfig {
  url: string;
  apiToken: string;
}

export interface LLMConfig {
  apiUrl: string;
  apiToken: string;
  model: string;
}

export function getConfig(input: Record<string, unknown>, llm = false): {
  readeck: ReadeckConfig;
  llm?: LLMConfig;
} {
  const value = (key: string, env: string) => {
    const supplied = input[key];
    return typeof supplied === "string" && supplied.trim() ? supplied.trim() : process.env[env]?.trim() || "";
  };
  const readeck = {
    url: value("readeckUrl", "READECK_URL").replace(/\/+$/, ""),
    apiToken: value("readeckToken", "READECK_API_TOKEN"),
  };
  if (!readeck.url || !readeck.apiToken) {
    throw new Error("Set the Readeck URL and API token in the form or environment.");
  }
  validateUrl(readeck.url, "Readeck URL");
  if (!llm) return { readeck };

  const config = {
    apiUrl: value("llmUrl", "LLM_API_URL"),
    apiToken: value("llmToken", "LLM_API_TOKEN"),
    model: value("llmModel", "LLM_MODEL"),
  };
  if (!config.apiUrl || !config.apiToken || !config.model) {
    throw new Error("Set the LLM API URL, model, and token in the form or environment.");
  }
  validateUrl(config.apiUrl, "LLM API URL");
  return { readeck, llm: config };
}

function validateUrl(value: string, name: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch {
    throw new Error(`${name} must be an HTTP or HTTPS URL without embedded credentials.`);
  }
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

async function requireOk(response: Response, action: string) {
  if (!response.ok) throw new Error(`${action} failed (HTTP ${response.status}).`);
}

export async function fetchUnlabeledBookmarks(config: ReadeckConfig): Promise<Bookmark[]> {
  const bookmarks: Bookmark[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const query = new URLSearchParams({ has_labels: "false", limit: String(limit), offset: String(offset) });
    const response = await fetch(`${config.url}/api/bookmarks?${query}`, {
      headers: headers(config.apiToken),
      cache: "no-store",
    });
    await requireOk(response, "Fetch bookmarks");
    const page: unknown = await response.json();
    if (!Array.isArray(page)) throw new Error("Readeck returned an invalid bookmark list.");
    for (const item of page) {
      if (typeof item?.id !== "string" || !Array.isArray(item.labels)) continue;
      if (item.labels.length !== 0) continue;
      bookmarks.push({
        id: item.id,
        url: typeof item.url === "string" ? item.url : "",
        title: typeof item.title === "string" ? item.title : "",
        description: typeof item.description === "string" ? item.description : "",
        labels: [],
      });
    }
    if (page.length < limit) break;
  }
  return bookmarks;
}

export async function fetchBookmark(config: ReadeckConfig, id: string): Promise<Bookmark> {
  const response = await fetch(`${config.url}/api/bookmarks/${encodeURIComponent(id)}`, {
    headers: headers(config.apiToken),
    cache: "no-store",
  });
  await requireOk(response, "Fetch bookmark");
  const data = await response.json();
  if (!data || !Array.isArray(data.labels)) throw new Error("Readeck returned an invalid bookmark.");
  return {
    id,
    url: typeof data.url === "string" ? data.url : "",
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : "",
    labels: data.labels,
  };
}

export async function fetchArticle(config: ReadeckConfig, id: string): Promise<string> {
  const response = await fetch(`${config.url}/api/bookmarks/${encodeURIComponent(id)}/article.md`, {
    headers: { Authorization: `Bearer ${config.apiToken}`, Accept: "text/markdown" },
    cache: "no-store",
  });
  await requireOk(response, "Fetch bookmark article");
  return response.text();
}

export async function addLabelsToBookmark(config: ReadeckConfig, id: string, labels: string[]): Promise<void> {
  const response = await fetch(`${config.url}/api/bookmarks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers(config.apiToken), "Content-Type": "application/json" },
    body: JSON.stringify({ add_labels: labels }),
  });
  await requireOk(response, "Apply labels");
}

export async function generateLabels(config: LLMConfig, bookmark: Bookmark, article: string, maxLabels: number): Promise<string[]> {
  const anthropic = new URL(config.apiUrl).pathname.endsWith("/messages");
  const system = `Choose up to ${maxLabels} relevant, concise labels for the bookmark. Use lowercase words and hyphens. Return one label per line. Do not include bullets or other text.`;
  const user = `Title: ${bookmark.title}\nURL: ${bookmark.url}\nDescription: ${bookmark.description}\nArticle:\n${article.slice(0, 16000)}`;
  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      ...(anthropic ? { "anthropic-version": "2023-06-01" } : {}),
    },
    body: JSON.stringify(anthropic ? {
      model: config.model,
      max_tokens: 256,
      system,
      messages: [{ role: "user", content: user }],
    } : {
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  await requireOk(response, "Generate labels");
  const data = await response.json();
  const content = anthropic ? data?.content?.filter((part: { type: string }) => part.type === "text").map((part: { text: string }) => part.text).join("\n") : data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("The LLM returned no label text. Check the endpoint format.");
  const labels = [...new Set(content.split(/\r?\n|,/).map((line: string) =>
    line.trim().replace(/^(?:[-*]\s+|\d+[.)]\s+)/, "").toLowerCase().replace(/\s+/g, "-")
  ).filter((line: string) => /^[\p{L}\p{N}][\p{L}\p{N}-]{0,49}$/u.test(line)))].slice(0, maxLabels);
  if (labels.length === 0) throw new Error("The LLM returned no valid labels.");
  return labels;
}
