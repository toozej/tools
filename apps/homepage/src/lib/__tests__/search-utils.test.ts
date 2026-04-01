import { describe, test, expect } from "bun:test";
import {
  levenshteinDistance,
  calculateSimilarity,
  matchesTags,
  normalizeForSearch,
  getCreditDisplay,
  type App,
} from "../search-utils";

describe("levenshteinDistance", () => {
  test("identical strings return 0", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
    expect(levenshteinDistance("", "")).toBe(0);
    expect(levenshteinDistance("a", "a")).toBe(0);
  });

  test("completely different strings", () => {
    expect(levenshteinDistance("abc", "xyz")).toBe(3);
  });

  test("single character difference", () => {
    expect(levenshteinDistance("cat", "hat")).toBe(1);
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });

  test("empty string vs non-empty", () => {
    expect(levenshteinDistance("", "hello")).toBe(5);
    expect(levenshteinDistance("hello", "")).toBe(5);
  });

  test("single insertion", () => {
    expect(levenshteinDistance("test", "tests")).toBe(1);
  });

  test("single deletion", () => {
    expect(levenshteinDistance("tests", "test")).toBe(1);
  });

  test("symmetric property", () => {
    expect(levenshteinDistance("abc", "ab")).toBe(levenshteinDistance("ab", "abc"));
  });
});

describe("calculateSimilarity", () => {
  test("exact substring match returns 0", () => {
    expect(calculateSimilarity("hello", "hello world")).toBe(0);
    expect(calculateSimilarity("test", "this is a test")).toBe(0);
  });

  test("case insensitive exact match", () => {
    expect(calculateSimilarity("Hello", "HELLO WORLD")).toBe(0);
    expect(calculateSimilarity("TEST", "test")).toBe(0);
  });

  test("fuzzy match returns positive number", () => {
    const score = calculateSimilarity("hllo", "hello");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(5);
  });

  test("no match returns high distance", () => {
    const score = calculateSimilarity("xyz", "hello world");
    expect(score).toBeGreaterThan(0);
  });

  test("trims query whitespace", () => {
    expect(calculateSimilarity("  hello  ", "hello world")).toBe(0);
  });
});

describe("matchesTags", () => {
  test("exact tag match", () => {
    expect(matchesTags("go", ["go", "typescript", "python"])).toBe(true);
  });

  test("substring tag match", () => {
    expect(matchesTags("script", ["typescript", "python"])).toBe(true);
  });

  test("query contains tag", () => {
    expect(matchesTags("typescript tools", ["typescript"])).toBe(true);
  });

  test("case insensitive matching", () => {
    expect(matchesTags("GO", ["go", "typescript"])).toBe(true);
    expect(matchesTags("go", ["GO", "TYPESCRIPT"])).toBe(true);
  });

  test("no match returns false", () => {
    expect(matchesTags("rust", ["go", "typescript", "python"])).toBe(false);
  });

  test("empty tags array returns false", () => {
    expect(matchesTags("go", [])).toBe(false);
  });

  test("fuzzy tag match within threshold", () => {
    expect(matchesTags("golam", ["golang"])).toBe(true);
  });

  test("trims query whitespace", () => {
    expect(matchesTags("  go  ", ["go", "typescript"])).toBe(true);
  });
});

describe("normalizeForSearch", () => {
  test("converts to lowercase", () => {
    expect(normalizeForSearch("Hello World")).toBe("hello world");
  });

  test("strips special characters", () => {
    expect(normalizeForSearch("hello!@#$%world")).toBe("helloworld");
    expect(normalizeForSearch("test-app_name.v2")).toBe("testappnamev2");
  });

  test("preserves alphanumeric and spaces", () => {
    expect(normalizeForSearch("hello world 123")).toBe("hello world 123");
  });

  test("handles mixed case with special chars", () => {
    expect(normalizeForSearch("My-App_Name!")).toBe("myappname");
  });

  test("empty string returns empty", () => {
    expect(normalizeForSearch("")).toBe("");
  });

  test("only special characters returns empty", () => {
    expect(normalizeForSearch("!@#$%")).toBe("");
  });
});

describe("getCreditDisplay", () => {
  const baseApp: App = {
    name: "test-app",
    title: "Test App",
    description: "A test app",
    tags: [],
    url: "https://example.com",
    credits: [],
    has_credits: false,
  };

  test("returns author when present", () => {
    const app: App = {
      ...baseApp,
      author: { name: "Author Name", url: "https://author.com" },
      credits: [{ name: "Credit Name", url: "https://credit.com" }],
    };
    const result = getCreditDisplay(app);
    expect(result.name).toBe("Author Name");
    expect(result.url).toBe("https://author.com");
  });

  test("returns first credit when no author", () => {
    const app: App = {
      ...baseApp,
      credits: [{ name: "Credit Name", url: "https://credit.com" }],
      has_credits: true,
    };
    const result = getCreditDisplay(app);
    expect(result.name).toBe("Credit Name");
    expect(result.url).toBe("https://credit.com");
  });

  test("returns default when no author or credits", () => {
    const result = getCreditDisplay(baseApp);
    expect(result.name).toBe("toozej");
    expect(result.url).toBeUndefined();
  });

  test("author without url", () => {
    const app: App = {
      ...baseApp,
      author: { name: "Author Name" },
    };
    const result = getCreditDisplay(app);
    expect(result.name).toBe("Author Name");
    expect(result.url).toBeUndefined();
  });

  test("credit without url", () => {
    const app: App = {
      ...baseApp,
      credits: [{ name: "Credit Name" }],
      has_credits: true,
    };
    const result = getCreditDisplay(app);
    expect(result.name).toBe("Credit Name");
    expect(result.url).toBeUndefined();
  });

  test("author takes priority over credits", () => {
    const app: App = {
      ...baseApp,
      author: { name: "Author" },
      credits: [{ name: "Credit" }],
      has_credits: true,
    };
    const result = getCreditDisplay(app);
    expect(result.name).toBe("Author");
  });
});
