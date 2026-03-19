import { extractUsername } from './route';
import { describe, test, expect } from 'vitest';

// Test cases for extractUsername function
describe('extractUsername', () => {
  test('returns username when given plain username', () => {
    expect(extractUsername('aciano')).toBe('aciano');
    expect(extractUsername('user-name_123')).toBe('user-name_123');
  });

  test('extracts username from full Lomography Homes URL', () => {
    expect(extractUsername('https://www.lomography.com/homes/aciano/photos')).toBe('aciano');
    expect(extractUsername('https://www.lomography.com/homes/testuser/albums')).toBe('testuser');
  });

  test('extracts username from partial URL containing homes', () => {
    expect(extractUsername('homes/aciano/photos')).toBe('aciano');
  });

  test('returns null for invalid input', () => {
    expect(extractUsername('')).toBeNull();
    expect(extractUsername('   ')).toBeNull();
    expect(extractUsername('https://example.com/path')).toBeNull();
    expect(extractUsername('not-a-valid-url')).toBeNull();
    expect(extractUsername('https://www.lomography.com/housers/testuser/albums')).toBeNull(); // Wrong path
  });

  test('handles URLs with query parameters', () => {
    expect(extractUsername('https://www.lomography.com/homes/aciano/photos?page=1')).toBe('aciano');
  });

  test('handles URLs with trailing slash', () => {
    expect(extractUsername('https://www.lomography.com/homes/aciano/')).toBe('aciano');
  });
});