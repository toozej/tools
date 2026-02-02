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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          <label htmlFor="yaml-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            YAML Input
          </label>
          <textarea
            id="yaml-input"
            value={yamlInput}
            onChange={(e) => setYamlInput(e.target.value)}
            className="w-full h-64 p-3 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-sm bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
            placeholder="Paste your YAML here or upload a file..."
          />
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <input
              type="file"
              accept=".yaml,.yml"
              onChange={handleFileUpload}
              className="flex-1 block w-full text-sm text-slate-500 dark:text-slate-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 dark:file:bg-blue-900/20 file:text-blue-700 dark:file:text-blue-400
              hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30 cursor-pointer"
            />
            <select
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
              className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition min-w-[120px]"
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value={6}>6 spaces</option>
            </select>
          </div>
          <button
            onClick={validateAndFormat}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Validate & Format
          </button>
        </div>

        {/* Output Section */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Output
          </label>
          {validationError && (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg">
              <p className="font-semibold">Error</p>
              <p>{validationError}</p>
            </div>
          )}
          <textarea
            value={formattedYaml}
            readOnly
            className="w-full h-64 p-3 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-sm bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            placeholder="Formatted YAML will appear here..."
          />
          <div className="flex gap-3">
            <button
              onClick={copyToClipboard}
              disabled={!formattedYaml}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={downloadYaml}
              disabled={!formattedYaml}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Download YAML
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}