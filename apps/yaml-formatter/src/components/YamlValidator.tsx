'use client';

import { useState, useEffect } from 'react';
import yaml from 'js-yaml';

export default function YamlValidator() {
  const [yamlInput, setYamlInput] = useState('');
  const [validationError, setValidationError] = useState('');
  const [formattedYaml, setFormattedYaml] = useState('');
  const [spacing, setSpacing] = useState(2);

  useEffect(() => {
    const saved = localStorage.getItem('yaml-input');
    if (saved) {
      setYamlInput(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('yaml-input', yamlInput);
  }, [yamlInput]);

  const validateAndFormat = () => {
    try {
      const parsed = yaml.load(yamlInput);
      setValidationError('');
      const formatted = yaml.dump(parsed, { indent: spacing });
      setFormattedYaml(formatted);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : String(error));
      setFormattedYaml('');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setYamlInput(content);
      };
      reader.readAsText(file);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formattedYaml);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = formattedYaml;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const downloadYaml = () => {
    const blob = new Blob([formattedYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formatted.yaml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold text-center">YAML Validator</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">YAML Input</label>
          <textarea
            value={yamlInput}
            onChange={(e) => setYamlInput(e.target.value)}
            className="w-full h-64 p-2 border rounded font-mono text-sm"
            placeholder="Paste your YAML here or upload a file..."
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="file"
              accept=".yaml,.yml"
              onChange={handleFileUpload}
              className="flex-1"
            />
            <select
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
              className="p-2 border rounded"
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value={6}>6 spaces</option>
            </select>
            <button
              onClick={validateAndFormat}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Validate & Format
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Output</label>
          {validationError && (
            <div className="p-2 bg-red-100 text-red-700 rounded">
              Error: {validationError}
            </div>
          )}
          <textarea
            value={formattedYaml}
            readOnly
            className="w-full h-64 p-2 border rounded font-mono text-sm bg-gray-50"
            placeholder="Formatted YAML will appear here..."
          />
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              disabled={!formattedYaml}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={downloadYaml}
              disabled={!formattedYaml}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Download YAML
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}