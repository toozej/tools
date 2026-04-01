import { describe, test, expect } from "bun:test";
import {
  deepDiff,
  isValidJson,
  isIncompleteJson,
  formatIncompleteJson,
} from "../json-utils";

describe("deepDiff", () => {
  test("returns empty array for identical primitives", () => {
    expect(deepDiff(1, 1)).toEqual([]);
    expect(deepDiff("a", "a")).toEqual([]);
    expect(deepDiff(true, true)).toEqual([]);
    expect(deepDiff(null, null)).toEqual([]);
  });

  test("detects modified primitives", () => {
    expect(deepDiff(1, 2)).toEqual([
      { type: "modified", path: "", oldValue: 1, newValue: 2 },
    ]);
    expect(deepDiff("a", "b")).toEqual([
      { type: "modified", path: "", oldValue: "a", newValue: "b" },
    ]);
  });

  test("detects type mismatch", () => {
    expect(deepDiff(1, "1")).toEqual([
      { type: "modified", path: "", oldValue: 1, newValue: "1" },
    ]);
    expect(deepDiff([], {})).toEqual([
      { type: "modified", path: "", oldValue: [], newValue: {} },
    ]);
  });

  test("returns empty array for identical objects", () => {
    expect(deepDiff({ a: 1 }, { a: 1 })).toEqual([]);
    expect(deepDiff({ a: { b: 2 } }, { a: { b: 2 } })).toEqual([]);
  });

  test("detects modified values in objects", () => {
    expect(deepDiff({ a: 1 }, { a: 2 })).toEqual([
      { type: "modified", path: "a", oldValue: 1, newValue: 2 },
    ]);
  });

  test("detects added keys", () => {
    expect(deepDiff({ a: 1 }, { a: 1, b: 2 })).toEqual([
      { type: "added", path: "b", value: 2 },
    ]);
  });

  test("detects removed keys", () => {
    expect(deepDiff({ a: 1, b: 2 }, { a: 1 })).toEqual([
      { type: "removed", path: "b", value: 2 },
    ]);
  });

  test("handles nested objects", () => {
    const result = deepDiff(
      { a: { b: { c: 1 } } },
      { a: { b: { c: 2 } } }
    );
    expect(result).toEqual([
      { type: "modified", path: "a.b.c", oldValue: 1, newValue: 2 },
    ]);
  });

  test("handles identical arrays", () => {
    expect(deepDiff([1, 2, 3], [1, 2, 3])).toEqual([]);
  });

  test("detects added array elements", () => {
    expect(deepDiff([1, 2], [1, 2, 3])).toEqual([
      { type: "added", path: "[2]", value: 3 },
    ]);
  });

  test("detects removed array elements", () => {
    expect(deepDiff([1, 2, 3], [1, 2])).toEqual([
      { type: "removed", path: "[2]", value: 3 },
    ]);
  });

  test("detects modified array elements", () => {
    expect(deepDiff([1, 2], [1, 5])).toEqual([
      { type: "modified", path: "[1]", oldValue: 2, newValue: 5 },
    ]);
  });

  test("handles arrays of objects", () => {
    const result = deepDiff(
      [{ id: 1, name: "Alice" }],
      [{ id: 1, name: "Bob" }]
    );
    expect(result).toEqual([
      { type: "modified", path: "[0].name", oldValue: "Alice", newValue: "Bob" },
    ]);
  });

  test("handles mixed nested structures", () => {
    const result = deepDiff(
      { users: [{ id: 1 }, { id: 2 }] },
      { users: [{ id: 1 }, { id: 3 }] }
    );
    expect(result).toEqual([
      { type: "modified", path: "users[1].id", oldValue: 2, newValue: 3 },
    ]);
  });

  test("handles empty objects", () => {
    expect(deepDiff({}, { a: 1 })).toEqual([
      { type: "added", path: "a", value: 1 },
    ]);
    expect(deepDiff({ a: 1 }, {})).toEqual([
      { type: "removed", path: "a", value: 1 },
    ]);
  });

  test("handles empty arrays", () => {
    expect(deepDiff([], [1])).toEqual([
      { type: "added", path: "[0]", value: 1 },
    ]);
    expect(deepDiff([1], [])).toEqual([
      { type: "removed", path: "[0]", value: 1 },
    ]);
  });
});

describe("isValidJson", () => {
  test("returns true for valid JSON objects", () => {
    expect(isValidJson('{"a":1}')).toBe(true);
    expect(isValidJson('{}')).toBe(true);
    expect(isValidJson('{"nested":{"b":2}}')).toBe(true);
  });

  test("returns true for valid JSON arrays", () => {
    expect(isValidJson('[1,2,3]')).toBe(true);
    expect(isValidJson('[]')).toBe(true);
    expect(isValidJson('[{"a":1}]')).toBe(true);
  });

  test("returns true for valid JSON primitives", () => {
    expect(isValidJson('"hello"')).toBe(true);
    expect(isValidJson('42')).toBe(true);
    expect(isValidJson('true')).toBe(true);
    expect(isValidJson('false')).toBe(true);
    expect(isValidJson('null')).toBe(true);
  });

  test("returns true for JSON with whitespace", () => {
    expect(isValidJson('  {"a":1}  ')).toBe(true);
    expect(isValidJson('  [1, 2]  ')).toBe(true);
  });

  test("returns false for invalid JSON", () => {
    expect(isValidJson('{a:1}')).toBe(false);
    expect(isValidJson("{'a':1}")).toBe(false);
    expect(isValidJson('{')).toBe(false);
    expect(isValidJson('undefined')).toBe(false);
    expect(isValidJson('')).toBe(false);
    expect(isValidJson('   ')).toBe(false);
  });
});

describe("isIncompleteJson", () => {
  test("returns false for empty string", () => {
    expect(isIncompleteJson("")).toBe(false);
    expect(isIncompleteJson("   ")).toBe(false);
  });

  test("returns false for valid complete JSON", () => {
    expect(isIncompleteJson('{"a":1}')).toBe(false);
    expect(isIncompleteJson('[1,2,3]')).toBe(false);
    expect(isIncompleteJson('"hello"')).toBe(false);
  });

  test("returns true for incomplete object JSON", () => {
    expect(isIncompleteJson('{"a":')).toBe(true);
    expect(isIncompleteJson('{"a":1,"b":')).toBe(true);
    expect(isIncompleteJson('{')).toBe(true);
    expect(isIncompleteJson('{"pelican":{"name":"test"')).toBe(true);
  });

  test("returns true for incomplete array JSON", () => {
    expect(isIncompleteJson('[1,')).toBe(true);
    expect(isIncompleteJson('[{')).toBe(true);
    expect(isIncompleteJson('[')).toBe(true);
  });

  test("returns false for non-JSON strings that don't start with { or [", () => {
    expect(isIncompleteJson('hello')).toBe(false);
    expect(isIncompleteJson('"incomplete')).toBe(false);
  });
});

describe("formatIncompleteJson", () => {
  test("formats simple object with indent 2", () => {
    const input = '{"a":1,"b":2}';
    const result = formatIncompleteJson(input, 2);
    expect(result).toContain('"a"');
    expect(result).toContain('"b"');
    expect(result).toContain("1");
    expect(result).toContain("2");
    expect(result).toContain(": ");
  });

  test("formats simple object with indent 4", () => {
    const input = '{"a":1}';
    const result = formatIncompleteJson(input, 4);
    expect(result).toContain('"a"');
    expect(result).toContain("    ");
  });

  test("formats nested objects with proper indentation", () => {
    const input = '{"a":{"b":1}}';
    const result = formatIncompleteJson(input, 2);
    const lines = result.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    expect(result).toContain('"a"');
    expect(result).toContain('"b"');
  });

  test("formats arrays with proper indentation", () => {
    const input = '[1,2,3]';
    const result = formatIncompleteJson(input, 2);
    expect(result).toContain("1");
    expect(result).toContain("2");
    expect(result).toContain("3");
    expect(result).toContain(",");
  });

  test("handles incomplete JSON gracefully", () => {
    const input = '{"a":1,"b":';
    const result = formatIncompleteJson(input, 2);
    expect(result).toContain('"a"');
    expect(result).toContain('"b"');
    expect(result).toContain("1");
  });

  test("preserves string content with special characters", () => {
    const input = '{"key":"value with spaces"}';
    const result = formatIncompleteJson(input, 2);
    expect(result).toContain("value with spaces");
  });

  test("handles escaped quotes in strings", () => {
    const input = '{"key":"val\\"ue"}';
    const result = formatIncompleteJson(input, 2);
    expect(result).toContain('\\"');
  });

  test("strips existing whitespace", () => {
    const input = '{ "a" : 1 }';
    const result = formatIncompleteJson(input, 2);
    expect(result).not.toContain(" : ");
    expect(result).toContain(": ");
  });

  test("handles deeply nested incomplete JSON", () => {
    const input = '{"a":{"b":{"c":';
    const result = formatIncompleteJson(input, 2);
    expect(result).toContain('"a"');
    expect(result).toContain('"b"');
    expect(result).toContain('"c"');
  });

  test("handles empty input", () => {
    expect(formatIncompleteJson("", 2)).toBe("");
  });
});
