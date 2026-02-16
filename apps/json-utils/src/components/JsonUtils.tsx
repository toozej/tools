'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import yaml from 'js-yaml';

type Mode = 'auto' | 'format' | 'yaml' | 'diff' | 'incomplete';

interface DiffResult {
  type: 'added' | 'removed' | 'modified';
  path: string;
  value?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
}

// Deep diff function for JSON comparison (defined outside component to avoid recursion issues)
function deepDiff(obj1: unknown, obj2: unknown, path = ''): DiffResult[] {
  const diffs: DiffResult[] = [];

  if (obj1 === obj2) return diffs;

  // Type mismatch
  if (typeof obj1 !== typeof obj2 || Array.isArray(obj1) !== Array.isArray(obj2)) {
    diffs.push({ type: 'modified', path, oldValue: obj1, newValue: obj2 });
    return diffs;
  }

  // Both are arrays
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

  // Both are objects
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

  // Primitive values that differ
  diffs.push({ type: 'modified', path, oldValue: obj1, newValue: obj2 });
  return diffs;
}

// Format incomplete JSON
function formatIncompleteJson(jsonString: string, indent: number): string {
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

// Check if input is valid JSON
function isValidJson(str: string): boolean {
  if (!str.trim()) return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// Check if input looks like incomplete JSON
function isIncompleteJson(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && !isValidJson(trimmed)) {
    return true;
  }
  return false;
}

// Get initial values from localStorage
function getInitialValue(key: string): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(key) || '';
}

export default function JsonUtils() {
  const [leftInput, setLeftInput] = useState(() => getInitialValue('json-utils-left'));
  const [rightInput, setRightInput] = useState(() => getInitialValue('json-utils-right'));
  const [mode, setMode] = useState<Mode>('auto');
  const [yamlStyle, setYamlStyle] = useState<'block' | 'flow' | 'quote'>('block');
  const [indentSize, setIndentSize] = useState(2);
  const [copied, setCopied] = useState(false);

  // Save input to localStorage
  useEffect(() => {
    localStorage.setItem('json-utils-left', leftInput);
  }, [leftInput]);

  useEffect(() => {
    localStorage.setItem('json-utils-right', rightInput);
  }, [rightInput]);

  // Detect mode based on input
  const detectedMode = useMemo((): Mode => {
    if (mode !== 'auto') return mode;
    
    const leftTrimmed = leftInput.trim();
    const rightTrimmed = rightInput.trim();
    
    // If both inputs have content, use diff mode
    if (leftTrimmed && rightTrimmed) {
      return 'diff';
    }
    
    // If left input is incomplete JSON, use incomplete mode
    if (isIncompleteJson(leftTrimmed)) {
      return 'incomplete';
    }
    
    // If left input is valid JSON, default to format mode
    if (isValidJson(leftTrimmed)) {
      return 'format';
    }
    
    return 'format';
  }, [mode, leftInput, rightInput]);

  // Compute output based on mode
  const { output, error } = useMemo(() => {
    const currentMode = detectedMode;
    const leftTrimmed = leftInput.trim();
    const rightTrimmed = rightInput.trim();

    if (!leftTrimmed && currentMode !== 'diff') {
      return { output: '', error: '' };
    }

    try {
      switch (currentMode) {
        case 'format': {
          if (!leftTrimmed) return { output: '', error: '' };
          const parsed = JSON.parse(leftTrimmed);
          return { output: JSON.stringify(parsed, null, indentSize), error: '' };
        }

        case 'yaml': {
          if (!leftTrimmed) return { output: '', error: '' };
          const parsed = JSON.parse(leftTrimmed);
          const options: yaml.DumpOptions = {
            indent: indentSize,
            noArrayIndent: false,
          };
          if (yamlStyle === 'flow') {
            options.flowLevel = 1;
          } else if (yamlStyle === 'quote') {
            options.styles = { '!!str': 'double' };
          }
          return { output: yaml.dump(parsed, options), error: '' };
        }

        case 'diff': {
          if (!leftTrimmed || !rightTrimmed) {
            return { output: '', error: 'Please provide JSON in both panels for diff mode' };
          }
          let obj1: unknown, obj2: unknown;
          try {
            obj1 = JSON.parse(leftTrimmed);
          } catch {
            return { output: '', error: 'Invalid JSON in left panel' };
          }
          try {
            obj2 = JSON.parse(rightTrimmed);
          } catch {
            return { output: '', error: 'Invalid JSON in right panel' };
          }
          const diffs = deepDiff(obj1, obj2);
          if (diffs.length === 0) {
            return { output: '✓ The JSON documents are identical', error: '' };
          } else {
            const diffText = diffs.map(d => {
              if (d.type === 'added') {
                return `+ ${d.path}: ${JSON.stringify(d.value)}`;
              } else if (d.type === 'removed') {
                return `- ${d.path}: ${JSON.stringify(d.value)}`;
              } else {
                return `± ${d.path}: ${JSON.stringify(d.oldValue)} → ${JSON.stringify(d.newValue)}`;
              }
            }).join('\n');
            return { output: diffText, error: '' };
          }
        }

        case 'incomplete': {
          return { output: formatIncompleteJson(leftTrimmed, indentSize), error: '' };
        }

        default:
          return { output: '', error: '' };
      }
    } catch (err) {
      return { output: '', error: err instanceof Error ? err.message : String(err) };
    }
  }, [leftInput, rightInput, detectedMode, indentSize, yamlStyle]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = output;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [output]);

  // Clear all
  const clearAll = useCallback(() => {
    setLeftInput('');
    setRightInput('');
  }, []);

  // Swap inputs (for diff mode)
  const swapInputs = useCallback(() => {
    setLeftInput(rightInput);
    setRightInput(leftInput);
  }, [leftInput, rightInput]);

  // Load example
  const loadExample = useCallback(() => {
    setLeftInput(JSON.stringify({
      name: "JSON Utils",
      version: "1.0.0",
      features: ["format", "yaml", "diff", "incomplete"],
      config: {
        indent: 2,
        theme: "dark"
      }
    }, null, 2));
    setRightInput('');
  }, []);

  // Load diff example
  const loadDiffExample = useCallback(() => {
    setLeftInput(JSON.stringify({
      users: [
        { id: 1, name: "Alice", age: 30 },
        { id: 2, name: "Bob", age: 25 }
      ]
    }, null, 2));
    setRightInput(JSON.stringify({
      users: [
        { id: 1, name: "Alice", age: 31 },
        { id: 2, name: "Bob", age: 25 },
        { id: 3, name: "Charlie", age: 35 }
      ]
    }, null, 2));
  }, []);

  // Load incomplete JSON example
  const loadIncompleteExample = useCallback(() => {
    setLeftInput('{"pelican":{"name":"Brown Pelican","features":{"wingspan":"2.3 meters","colors":["brown","white"]},"habitat":"coastal');
    setRightInput('');
  }, []);

  // Get mode label
  const getModeLabel = (m: Mode): string => {
    switch (m) {
      case 'auto': return 'Auto Detect';
      case 'format': return 'Format JSON';
      case 'yaml': return 'JSON → YAML';
      case 'diff': return 'JSON Diff';
      case 'incomplete': return 'Incomplete JSON';
    }
  };

  const isDiffMode = detectedMode === 'diff';

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <div className="flex flex-wrap gap-2 items-center justify-center">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Mode:</span>
        {(['auto', 'format', 'yaml', 'diff', 'incomplete'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {getModeLabel(m)}
          </button>
        ))}
      </div>

      {/* Detected Mode Indicator (for auto mode) */}
      {mode === 'auto' && (
        <div className="text-center text-sm text-slate-500 dark:text-slate-400">
          Detected: <span className="font-medium text-blue-600 dark:text-blue-400">{getModeLabel(detectedMode)}</span>
        </div>
      )}

      {/* Options */}
      <div className="flex flex-wrap gap-4 items-center justify-center">
        <div className="flex items-center gap-2">
          <label htmlFor="indent" className="text-sm text-slate-600 dark:text-slate-400">Indent:</label>
          <select
            id="indent"
            value={indentSize}
            onChange={(e) => setIndentSize(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
          >
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
          </select>
        </div>
        
        {detectedMode === 'yaml' && (
          <div className="flex items-center gap-2">
            <label htmlFor="yamlStyle" className="text-sm text-slate-600 dark:text-slate-400">YAML Style:</label>
            <select
              id="yamlStyle"
              value={yamlStyle}
              onChange={(e) => setYamlStyle(e.target.value as 'block' | 'flow' | 'quote')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
            >
              <option value="block">Block</option>
              <option value="flow">Flow (Compact)</option>
              <option value="quote">Quoted Strings</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Panel */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {isDiffMode ? 'JSON 1 (Original)' : 'Input'}
          </label>
          <textarea
            value={leftInput}
            onChange={(e) => setLeftInput(e.target.value)}
            className="w-full h-80 p-3 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder={isDiffMode ? "Paste first JSON here..." : "Paste JSON here..."}
          />
        </div>

        {/* Right Panel */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {isDiffMode ? 'JSON 2 (Modified)' : 'Output'}
          </label>
          {isDiffMode ? (
            <textarea
              value={rightInput}
              onChange={(e) => setRightInput(e.target.value)}
              className="w-full h-80 p-3 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Paste second JSON here..."
            />
          ) : (
            <div className="relative">
              <textarea
                value={output}
                readOnly
                className="w-full h-80 p-3 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-sm bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                placeholder="Output will appear here..."
              />
              {output && (
                <button
                  onClick={copyToClipboard}
                  className="absolute top-2 right-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Diff Output (when in diff mode) */}
      {isDiffMode && output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Diff Result</label>
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <pre className={`w-full p-4 border rounded-lg font-mono text-sm overflow-auto max-h-64 ${
            output.startsWith('✓') 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300'
              : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
          }`}>
            {output}
          </pre>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={loadExample}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Load JSON Example
        </button>
        <button
          onClick={loadDiffExample}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          Load Diff Example
        </button>
        <button
          onClick={loadIncompleteExample}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          Load Incomplete Example
        </button>
        {isDiffMode && (
          <button
            onClick={swapInputs}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Swap Inputs
          </button>
        )}
        <button
          onClick={clearAll}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Status Bar */}
      <div className="text-center text-sm text-slate-500 dark:text-slate-400">
        {leftInput && (
          <span className="mr-4">
            Left: {leftInput.length} chars {isValidJson(leftInput) ? '✓ Valid JSON' : isIncompleteJson(leftInput) ? '⚠ Incomplete' : '✗ Invalid'}
          </span>
        )}
        {rightInput && (
          <span className="mr-4">
            Right: {rightInput.length} chars {isValidJson(rightInput) ? '✓ Valid JSON' : '✗ Invalid'}
          </span>
        )}
        {output && <span>Output: {output.length} chars</span>}
      </div>
    </div>
  );
}
