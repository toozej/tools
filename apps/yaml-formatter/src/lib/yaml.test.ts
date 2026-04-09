import { describe, test, expect } from 'bun:test';
import { validateYaml, formatYaml, validateAndFormatYaml } from './yaml';

describe('validateYaml', () => {
  test('returns valid for proper YAML', () => {
    const result = validateYaml('name: test\nvalue: 123');
    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({ name: 'test', value: 123 });
  });

  test('returns error for invalid YAML syntax', () => {
    const result = validateYaml('name: test\n  value: invalid');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('returns error for empty input', () => {
    const result = validateYaml('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Input is empty');
  });

  test('returns error for whitespace only', () => {
    const result = validateYaml('   \n  \t  ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Input is empty');
  });

  test('parses simple key-value pairs', () => {
    const result = validateYaml('key: value');
    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({ key: 'value' });
  });

  test('parses nested objects', () => {
    const result = validateYaml('parent:\n  child: value');
    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({ parent: { child: 'value' } });
  });

  test('parses arrays', () => {
    const result = validateYaml('- item1\n- item2\n- item3');
    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual(['item1', 'item2', 'item3']);
  });

  test('parses complex nested structure', () => {
    const yaml = `
users:
  - name: alice
    age: 30
  - name: bob
    age: 25
settings:
  theme: dark
  version: 1.0
`;
    const result = validateYaml(yaml);
    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({
      users: [
        { name: 'alice', age: 30 },
        { name: 'bob', age: 25 },
      ],
      settings: { theme: 'dark', version: 1 },
    });
  });
});

describe('formatYaml', () => {
  test('formats object with default indent', () => {
    const result = formatYaml({ name: 'test', value: 123 });
    expect(result.success).toBe(true);
    expect(result.formatted).toContain('name: test');
    expect(result.formatted).toContain('value: 123');
  });

  test('formats object with custom indent', () => {
    const result = formatYaml({ parent: { child: 'value' } }, 4);
    expect(result.success).toBe(true);
    expect(result.formatted).toContain('parent:');
    expect(result.formatted).toContain('    child: value');
  });

  test('formats nested object with indent', () => {
    const result = formatYaml({ parent: { child: 'value' } }, 2);
    expect(result.success).toBe(true);
    expect(result.formatted).toBe('parent:\n  child: value\n');
  });

  test('returns error for undefined input', () => {
    const result = formatYaml(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toBe('No data to format');
  });

  test('returns error for null input', () => {
    const result = formatYaml(null as unknown as undefined);
    expect(result.success).toBe(false);
    expect(result.error).toBe('No data to format');
  });

  test('handles array input', () => {
    const result = formatYaml(['item1', 'item2']);
    expect(result.success).toBe(true);
    expect(result.formatted).toContain('- item1');
  });
});

describe('validateAndFormatYaml', () => {
  test('validates and formats valid YAML', () => {
    const result = validateAndFormatYaml('name: test', 2);
    expect(result.success).toBe(true);
    expect(result.formatted).toContain('name: test');
  });

  test('returns error for invalid YAML', () => {
    const result = validateAndFormatYaml('invalid: yaml: syntax:', 2);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('returns error for empty input', () => {
    const result = validateAndFormatYaml('', 2);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Input is empty');
  });

  test('uses custom indent for nested structure', () => {
    const result = validateAndFormatYaml('parent:\n  child: value', 4);
    expect(result.success).toBe(true);
    expect(result.formatted).toContain('parent:');
    expect(result.formatted).toContain('    child: value');
  });

  test('preserves data types', () => {
    const result = validateAndFormatYaml('bool: true\nnum: 42\nstr: hello', 2);
    expect(result.success).toBe(true);
    expect(result.formatted).toContain('bool: true');
    expect(result.formatted).toContain('num: 42');
    expect(result.formatted).toContain('str: hello');
  });
});