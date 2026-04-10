import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { validateUrl, validateText, validateRequiredEnvVars } from './validation';

describe('validateUrl', () => {
  it('should return valid for a valid https URL', () => {
    const result = validateUrl('https://example.com');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return valid for a valid http URL', () => {
    const result = validateUrl('http://example.com');
    expect(result.valid).toBe(true);
  });

  it('should return invalid for missing URL', () => {
    const result = validateUrl('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL parameter is required');
  });

  it('should return invalid for null URL', () => {
    const result = validateUrl(null as any);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL parameter is required');
  });

  it('should return invalid for undefined URL', () => {
    const result = validateUrl(undefined as any);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL parameter is required');
  });

  it('should return invalid for invalid URL format', () => {
    const result = validateUrl('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid URL format');
  });

  it('should return invalid for non-http protocol', () => {
    const result = validateUrl('ftp://example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL must use http or https protocol');
  });

  it('should return invalid for file protocol', () => {
    const result = validateUrl('file:///path/to/file');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL must use http or https protocol');
  });

  it('should return valid for URL with path', () => {
    const result = validateUrl('https://example.com/path/to/page');
    expect(result.valid).toBe(true);
  });

  it('should return valid for URL with query params', () => {
    const result = validateUrl('https://example.com?query=value');
    expect(result.valid).toBe(true);
  });

  it('should return valid for URL with port', () => {
    const result = validateUrl('https://example.com:8080');
    expect(result.valid).toBe(true);
  });
});

describe('validateText', () => {
  it('should return valid for non-empty text', () => {
    const result = validateText('Hello world');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return invalid for missing text', () => {
    const result = validateText('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Text is required');
  });

  it('should return invalid for null text', () => {
    const result = validateText(null as any);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Text is required');
  });

  it('should return invalid for undefined text', () => {
    const result = validateText(undefined as any);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Text is required');
  });

  it('should return invalid for whitespace-only text', () => {
    const result = validateText('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Text cannot be empty');
  });

  it('should return invalid for non-string text', () => {
    const result = validateText(123 as any);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Text must be a string');
  });

  it('should return invalid for object text', () => {
    const result = validateText({ text: 'hello' } as any);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Text must be a string');
  });

  it('should return valid for text with leading/trailing whitespace', () => {
    const result = validateText('  Hello world  ');
    expect(result.valid).toBe(true);
  });

  it('should return valid for multiline text', () => {
    const result = validateText('Line 1\nLine 2\nLine 3');
    expect(result.valid).toBe(true);
  });
});

describe('validateRequiredEnvVars', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return valid when all vars are set', () => {
    process.env.TEST_VAR = 'value';
    const result = validateRequiredEnvVars(['TEST_VAR']);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('should return invalid when some vars are missing', () => {
    delete process.env.MISSING_VAR;
    const result = validateRequiredEnvVars(['MISSING_VAR']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['MISSING_VAR']);
  });

  it('should return invalid when multiple vars are missing', () => {
    delete process.env.VAR1;
    delete process.env.VAR2;
    const result = validateRequiredEnvVars(['VAR1', 'VAR2']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['VAR1', 'VAR2']);
  });

  it('should return valid when no vars are required', () => {
    const result = validateRequiredEnvVars([]);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('should return valid when all of multiple vars are set', () => {
    process.env.VAR1 = 'value1';
    process.env.VAR2 = 'value2';
    const result = validateRequiredEnvVars(['VAR1', 'VAR2']);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });
});
