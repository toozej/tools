export interface DiffResult {
  type: 'added' | 'removed' | 'modified';
  path: string;
  value?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
}

export function deepDiff(obj1: unknown, obj2: unknown, path = ''): DiffResult[] {
  const diffs: DiffResult[] = [];

  if (obj1 === obj2) return diffs;

  if (typeof obj1 !== typeof obj2 || Array.isArray(obj1) !== Array.isArray(obj2)) {
    diffs.push({ type: 'modified', path, oldValue: obj1, newValue: obj2 });
    return diffs;
  }

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    const maxLen = Math.max(obj1.length, obj2.length);
    for (let i = 0; i < maxLen; i++) {
      const newPath = `${path}[${i}]`;
      if (i >= obj1.length) {
        diffs.push({ type: 'added', path: newPath, value: obj2[i] });
      } else if (i >= obj2.length) {
        diffs.push({ type: 'removed', path: newPath, value: obj1[i] });
      } else {
        diffs.push(...deepDiff(obj1[i], obj2[i], newPath));
      }
    }
    return diffs;
  }

  if (typeof obj1 === 'object' && obj1 !== null && typeof obj2 === 'object' && obj2 !== null) {
    const allKeys = new Set([...Object.keys(obj1 as Record<string, unknown>), ...Object.keys(obj2 as Record<string, unknown>)]);
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      if (!(key in (obj1 as Record<string, unknown>))) {
        diffs.push({ type: 'added', path: newPath, value: (obj2 as Record<string, unknown>)[key] });
      } else if (!(key in (obj2 as Record<string, unknown>))) {
        diffs.push({ type: 'removed', path: newPath, value: (obj1 as Record<string, unknown>)[key] });
      } else {
        diffs.push(...deepDiff(
          (obj1 as Record<string, unknown>)[key],
          (obj2 as Record<string, unknown>)[key],
          newPath
        ));
      }
    }
    return diffs;
  }

  diffs.push({ type: 'modified', path, oldValue: obj1, newValue: obj2 });
  return diffs;
}

export function formatIncompleteJson(jsonString: string, indent: number): string {
  let result = '';
  let indentLevel = 0;
  let inString = false;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];
    const prevChar = i > 0 ? jsonString[i - 1] : '';

    if (char === '"' && prevChar !== '\\') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      result += char;
    } else {
      switch (char) {
        case '{':
        case '[':
          result += char;
          indentLevel++;
          result += '\n' + ' '.repeat(indentLevel * indent);
          break;
        case '}':
        case ']':
          indentLevel = Math.max(0, indentLevel - 1);
          result = result.trimEnd();
          result += '\n' + ' '.repeat(indentLevel * indent) + char;
          break;
        case ',':
          result += char;
          result += '\n' + ' '.repeat(indentLevel * indent);
          break;
        case ':':
          result += ': ';
          break;
        case ' ':
        case '\n':
        case '\r':
        case '\t':
          break;
        default:
          result += char;
      }
    }
  }

  return result;
}

export function isValidJson(str: string): boolean {
  if (!str.trim()) return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function isIncompleteJson(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && !isValidJson(trimmed)) {
    return true;
  }
  return false;
}
