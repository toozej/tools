import { describe, test, expect } from "bun:test";
import {
  validateCreateGistPayload,
  sanitizeFilename,
  type CreateGistPayload,
} from "../validation";

describe("validateCreateGistPayload", () => {
  test("valid payload returns valid result", () => {
    const payload: CreateGistPayload = { content: "hello world" };
    const result = validateCreateGistPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("valid payload with filename returns valid result", () => {
    const payload: CreateGistPayload = { content: "hello world", filename: "test.txt" };
    const result = validateCreateGistPayload(payload);
    expect(result.valid).toBe(true);
  });

  test("null payload returns invalid", () => {
    const result = validateCreateGistPayload(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid request body");
  });

  test("undefined payload returns invalid", () => {
    const result = validateCreateGistPayload(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid request body");
  });

  test("non-object payload returns invalid", () => {
    const result = validateCreateGistPayload("string");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid request body");
  });

  test("empty content returns invalid", () => {
    const payload: CreateGistPayload = { content: "" };
    const result = validateCreateGistPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Content is required");
  });

  test("null content returns invalid", () => {
    const payload = { content: null } as unknown as CreateGistPayload;
    const result = validateCreateGistPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Content is required");
  });

  test("undefined content returns invalid", () => {
    const payload = { content: undefined } as unknown as CreateGistPayload;
    const result = validateCreateGistPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Content is required");
  });

  test("non-string content returns invalid", () => {
    const payload = { content: 123 } as unknown as CreateGistPayload;
    const result = validateCreateGistPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Content must be a string");
  });

  test("non-string filename returns invalid", () => {
    const payload = { content: "hello", filename: 123 } as unknown as CreateGistPayload;
    const result = validateCreateGistPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Filename must be a string");
  });

  test("filename with slash returns invalid", () => {
    const payload: CreateGistPayload = { content: "hello", filename: "test/file.txt" };
    const result = validateCreateGistPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Filename contains invalid characters");
  });

  test("filename with null character returns invalid", () => {
    const payload: CreateGistPayload = { content: "hello", filename: "test\0file.txt" };
    const result = validateCreateGistPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Filename contains invalid characters");
  });

  test("empty filename is valid", () => {
    const payload: CreateGistPayload = { content: "hello", filename: "" };
    const result = validateCreateGistPayload(payload);
    expect(result.valid).toBe(true);
  });

  test("whitespace-only content returns invalid", () => {
    const payload: CreateGistPayload = { content: "   " };
    const result = validateCreateGistPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Content is required");
  });
});

describe("sanitizeFilename", () => {
  test("undefined returns default filename", () => {
    expect(sanitizeFilename(undefined)).toBe("gist.txt");
  });

  test("empty string returns default filename", () => {
    expect(sanitizeFilename("")).toBe("gist.txt");
  });

  test("whitespace-only returns default filename", () => {
    expect(sanitizeFilename("   ")).toBe("gist.txt");
  });

  test("valid filename is preserved", () => {
    expect(sanitizeFilename("test.txt")).toBe("test.txt");
  });

  test("filename with path separators is sanitized", () => {
    expect(sanitizeFilename("test/file.txt")).toBe("testfile.txt");
    expect(sanitizeFilename("test\\file.txt")).toBe("testfile.txt");
  });

  test("filename with null character is sanitized", () => {
    expect(sanitizeFilename("test\0file.txt")).toBe("testfile.txt");
  });

  test("only invalid characters returns default filename", () => {
    expect(sanitizeFilename("///")).toBe("gist.txt");
    expect(sanitizeFilename("\\\\\\")).toBe("gist.txt");
  });

  test("filename starting with dot is preserved", () => {
    expect(sanitizeFilename(".env")).toBe(".env");
  });

  test("filename with spaces is preserved", () => {
    expect(sanitizeFilename("my file.txt")).toBe("my file.txt");
  });
});
