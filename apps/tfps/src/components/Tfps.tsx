'use client';

import { useState, useCallback, useMemo } from 'react';

// Types for Terraform JSON plan format
interface ResourceChange {
  address: string;
  module_address?: string;
  mode: 'managed' | 'data';
  type: string;
  name: string;
  provider_name: string;
  change: {
    actions: ('create' | 'read' | 'update' | 'delete' | 'no-op')[];
    after?: Record<string, unknown>;
    after_unknown?: Record<string, unknown>;
    before?: Record<string, unknown>;
  };
}

interface PlanOutput {
  format_version: string;
  terraform_version: string;
  planned_values?: {
    root_module?: {
      resources?: ResourceChange[];
      child_modules?: Array<{
        address: string;
        resources?: ResourceChange[];
      }>;
    };
  };
  resource_changes?: ResourceChange[];
  prior_state?: {
    format_version: string;
    terraform_version: string;
  };
}

interface ParsedChange {
  resourceModule: string;
  address: string;
  type: string;
  name: string;
  action: 'create' | 'update' | 'delete' | 'replace' | 'read';
  isDestructive: boolean;
  // Full resource data for expandable details
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  afterUnknown?: Record<string, unknown>;
}

type InputMode = 'file' | 'json' | 'text';

// Parse JSON plan format
function parseJsonPlan(json: PlanOutput): ParsedChange[] {
  const changes: ParsedChange[] = [];
  const resourceChanges = json.resource_changes || [];

  for (const rc of resourceChanges) {
    const actions = rc.change.actions;
    let action: ParsedChange['action'] = 'create';
    let isDestructive = false;

    // Determine the primary action
    if (actions.includes('delete') && actions.includes('create')) {
      action = 'replace';
      isDestructive = true;
    } else if (actions.includes('delete')) {
      action = 'delete';
      isDestructive = true;
    } else if (actions.includes('create')) {
      action = 'create';
    } else if (actions.includes('update')) {
      action = 'update';
    } else if (actions.includes('read')) {
      action = 'read';
    } else {
      continue; // Skip no-op
    }

    // Extract module from address
    const moduleMatch = rc.address.match(/^module\.([^\.]+)/);
    const resourceModule = moduleMatch ? `module.${moduleMatch[1]}` : 'root';

    changes.push({
      resourceModule,
      address: rc.address,
      type: rc.type,
      name: rc.name,
      action,
      isDestructive,
      before: rc.change.before,
      after: rc.change.after,
      afterUnknown: rc.change.after_unknown,
    });
  }

  return changes;
}

// Parse text plan format
function parseTextPlan(text: string): ParsedChange[] {
  const changes: ParsedChange[] = [];
  const lines = text.split('\n');

  // Regex patterns for different plan formats
  const planPattern = /^(\s*)#?\s*(.+?)\s+will be (created|updated|destroyed|replaced)/i;
  const actionPattern = /^(\s*)([+-~])\s+(?:resource\s+)?"?([^"\s]+)"?\s+"([^"]+)"/i;
  const modulePattern = /module\.([^\.]+)/;

  let currentModule = 'root';

  for (const line of lines) {
    // Check for module context
    const moduleMatch = line.match(modulePattern);
    if (moduleMatch && line.includes('module.')) {
      currentModule = `module.${moduleMatch[1]}`;
    }

    // Try to match plan summary lines
    const planMatch = line.match(planPattern);
    if (planMatch) {
      const address = planMatch[2].trim();
      const actionText = planMatch[3].toLowerCase();

      let action: ParsedChange['action'] = 'update';
      let isDestructive = false;

      if (actionText === 'created') {
        action = 'create';
      } else if (actionText === 'destroyed') {
        action = 'delete';
        isDestructive = true;
      } else if (actionText === 'replaced') {
        action = 'replace';
        isDestructive = true;
      }

      // Parse type and name from address
      const parts = address.split('.');
      const type = parts[0] || 'unknown';
      const name = parts.slice(1).join('.') || 'unknown';

      changes.push({
        resourceModule: currentModule,
        address,
        type,
        name,
        action,
        isDestructive,
      });
      continue;
    }

    // Try to match action lines (+/-/~)
    const actionMatch = line.match(actionPattern);
    if (actionMatch) {
      const symbol = actionMatch[2];
      const type = actionMatch[3];
      const name = actionMatch[4];

      let action: ParsedChange['action'] = 'update';
      let isDestructive = false;

      if (symbol === '+') {
        action = 'create';
      } else if (symbol === '-') {
        action = 'delete';
        isDestructive = true;
      } else if (symbol === '~' || symbol === '+/-') {
        action = 'update';
      }

      changes.push({
        resourceModule: currentModule,
        address: `${type}.${name}`,
        type,
        name,
        action,
        isDestructive,
      });
    }
  }

  return changes;
}

// Get action emoji
function getActionEmoji(action: ParsedChange['action']): string {
  switch (action) {
    case 'create':
      return '➕';
    case 'update':
      return '🔄';
    case 'replace':
      return '♻️';
    case 'delete':
      return '❌';
    case 'read':
      return '📖';
    default:
      return '❓';
  }
}

// Get action label
function getActionLabel(action: ParsedChange['action']): string {
  switch (action) {
    case 'create':
      return 'Add';
    case 'update':
      return 'Change';
    case 'replace':
      return 'Replace';
    case 'delete':
      return 'Destroy';
    case 'read':
      return 'Read';
    default:
      return 'Unknown';
  }
}

// Group changes by module
function groupByModule(changes: ParsedChange[]): Map<string, ParsedChange[]> {
  const groups = new Map<string, ParsedChange[]>();

  for (const change of changes) {
    const existing = groups.get(change.resourceModule) || [];
    existing.push(change);
    groups.set(change.resourceModule, existing);
  }

  return groups;
}

// Generate markdown output
function generateMarkdown(changes: ParsedChange[]): string {
  const groups = groupByModule(changes);
  const lines: string[] = [];

  lines.push('# Terraform Plan Summary\n');

  // Summary counts
  const counts = {
    create: changes.filter(c => c.action === 'create').length,
    update: changes.filter(c => c.action === 'update').length,
    replace: changes.filter(c => c.action === 'replace').length,
    delete: changes.filter(c => c.action === 'delete').length,
  };

  lines.push('## Summary\n');
  lines.push(`- ➕ **Add**: ${counts.create}`);
  lines.push(`- 🔄 **Change**: ${counts.update}`);
  lines.push(`- ♻️ **Replace**: ${counts.replace}`);
  lines.push(`- ❌ **Destroy**: ${counts.delete}`);
  lines.push('');

  // Group by module
  lines.push('## Changes by Module\n');

  for (const [resourceModule, moduleChanges] of groups) {
    lines.push(`### ${resourceModule}\n`);

    for (const change of moduleChanges) {
      const emoji = getActionEmoji(change.action);
      const label = getActionLabel(change.action);
      const warning = change.isDestructive ? ' ⚠️' : '';
      lines.push(`- ${emoji} **${label}**${warning}: \`${change.address}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Generate plaintext output
function generatePlaintext(changes: ParsedChange[]): string {
  const groups = groupByModule(changes);
  const lines: string[] = [];

  lines.push('Terraform Plan Summary');
  lines.push('='.repeat(50));
  lines.push('');

  // Summary counts
  const counts = {
    create: changes.filter(c => c.action === 'create').length,
    update: changes.filter(c => c.action === 'update').length,
    replace: changes.filter(c => c.action === 'replace').length,
    delete: changes.filter(c => c.action === 'delete').length,
  };

  lines.push('Summary:');
  lines.push(`- Add: ${counts.create}`);
  lines.push(`- Change: ${counts.update}`);
  lines.push(`- Replace: ${counts.replace}`);
  lines.push(`- Destroy: ${counts.delete}`);
  lines.push('');

  // Group by module
  lines.push('Changes by Module:');
  lines.push('-'.repeat(50));

  for (const [resourceModule, moduleChanges] of groups) {
    lines.push('');
    lines.push(`[${resourceModule}]`);

    for (const change of moduleChanges) {
      const label = getActionLabel(change.action).toUpperCase();
      const warning = change.isDestructive ? ' [DESTRUCTIVE]' : '';
      lines.push(`  ${label}${warning}: ${change.address}`);
    }
  }

  return lines.join('\n');
}

export default function Tfps() {
  const [inputMode, setInputMode] = useState<InputMode>('json');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'markdown' | 'plaintext' | null>(null);
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());

  // Parse the input
  const parsedChanges = useMemo((): ParsedChange[] => {
    setError(null);

    if (!input.trim()) {
      return [];
    }

    try {
      if (inputMode === 'json' || inputMode === 'file') {
        // Try to parse as JSON
        const json = JSON.parse(input) as PlanOutput;

        // Validate it looks like a plan
        if (!json.format_version && !json.resource_changes) {
          throw new Error('Input does not appear to be a valid Terraform plan JSON');
        }

        return parseJsonPlan(json);
      } else {
        // Parse as text
        return parseTextPlan(input);
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format. Please check your input or switch to text mode.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to parse input');
      }
      return [];
    }
  }, [input, inputMode]);

  // Group changes by module
  const groupedChanges = useMemo(() => {
    return groupByModule(parsedChanges);
  }, [parsedChanges]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInput(content);

      // Auto-detect mode based on file extension
      if (file.name.endsWith('.json')) {
        setInputMode('json');
      } else {
        setInputMode('text');
      }
    };
    reader.readAsText(file);
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInput(content);

      // Auto-detect mode based on file extension
      if (file.name.endsWith('.json')) {
        setInputMode('json');
      } else {
        setInputMode('text');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (format: 'markdown' | 'plaintext') => {
    const text = format === 'markdown' ? generateMarkdown(parsedChanges) : generatePlaintext(parsedChanges);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    }
  }, [parsedChanges]);

  // Clear input
  const clearInput = useCallback(() => {
    setInput('');
    setError(null);
  }, []);

  // Toggle expanded state for a change
  const toggleExpanded = useCallback((address: string) => {
    setExpandedChanges(prev => {
      const next = new Set(prev);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
  }, []);

  // Format JSON for display
  const formatJsonDisplay = (obj: Record<string, unknown> | undefined): string => {
    if (!obj) return '';
    return JSON.stringify(obj, null, 2);
  };

  // Compute diff between before and after
  const getChangedKeys = (before?: Record<string, unknown>, after?: Record<string, unknown>): Set<string> => {
    const changedKeys = new Set<string>();
    
    if (!before && !after) return changedKeys;
    
    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);
    
    for (const key of allKeys) {
      const beforeVal = before?.[key];
      const afterVal = after?.[key];
      
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changedKeys.add(key);
      }
    }
    
    return changedKeys;
  };

  // Load example
  const loadExample = useCallback(() => {
    const exampleJson: PlanOutput = {
      format_version: "1.0",
      terraform_version: "1.5.0",
      resource_changes: [
        {
          address: "aws_instance.example",
          mode: "managed",
          type: "aws_instance",
          name: "example",
          provider_name: "aws",
          change: {
            actions: ["create"],
            after: {
              ami: "ami-0c55b159cbfafe1f0",
              instance_type: "t3.micro",
              tags: {
                Name: "example-instance",
                Environment: "production"
              },
              vpc_security_group_ids: ["sg-12345678"],
              subnet_id: "subnet-12345678"
            }
          }
        },
        {
          address: "module.vpc.aws_subnet.public[0]",
          module_address: "module.vpc",
          mode: "managed",
          type: "aws_subnet",
          name: "public",
          provider_name: "aws",
          change: {
            actions: ["update"],
            before: {
              vpc_id: "vpc-12345678",
              cidr_block: "10.0.1.0/24",
              availability_zone: "us-east-1a",
              tags: {
                Name: "public-subnet-0",
                Type: "public"
              }
            },
            after: {
              vpc_id: "vpc-12345678",
              cidr_block: "10.0.1.0/24",
              availability_zone: "us-east-1a",
              tags: {
                Name: "public-subnet-0",
                Type: "public",
                Environment: "production"
              }
            }
          }
        },
        {
          address: "module.vpc.aws_nat_gateway.main",
          module_address: "module.vpc",
          mode: "managed",
          type: "aws_nat_gateway",
          name: "main",
          provider_name: "aws",
          change: {
            actions: ["delete", "create"],
            before: {
              allocation_id: "eipalloc-old",
              subnet_id: "subnet-old",
              tags: {
                Name: "old-nat-gateway"
              }
            },
            after: {
              allocation_id: "eipalloc-new",
              subnet_id: "subnet-new",
              tags: {
                Name: "main-nat-gateway",
                Environment: "production"
              }
            }
          }
        },
        {
          address: "aws_security_group.old",
          mode: "managed",
          type: "aws_security_group",
          name: "old",
          provider_name: "aws",
          change: {
            actions: ["delete"],
            before: {
              name: "old-security-group",
              description: "Old security group to be removed",
              vpc_id: "vpc-12345678",
              ingress: [
                {
                  from_port: 22,
                  to_port: 22,
                  protocol: "tcp",
                  cidr_blocks: ["0.0.0.0/0"]
                }
              ]
            }
          }
        },
        {
          address: "module.database.aws_db_instance.primary",
          module_address: "module.database",
          mode: "managed",
          type: "aws_db_instance",
          name: "primary",
          provider_name: "aws",
          change: {
            actions: ["create"],
            after: {
              engine: "postgres",
              engine_version: "14.5",
              instance_class: "db.t3.micro",
              allocated_storage: 20,
              db_name: "mydb",
              username: "dbadmin",
              vpc_security_group_ids: ["sg-87654321"],
              db_subnet_group_name: "main",
              tags: {
                Name: "primary-db",
                Environment: "production"
              }
            }
          }
        }
      ]
    };

    setInput(JSON.stringify(exampleJson, null, 2));
    setInputMode('json');
  }, []);

  // Summary counts
  const summary = useMemo(() => ({
    create: parsedChanges.filter(c => c.action === 'create').length,
    update: parsedChanges.filter(c => c.action === 'update').length,
    replace: parsedChanges.filter(c => c.action === 'replace').length,
    delete: parsedChanges.filter(c => c.action === 'delete').length,
    total: parsedChanges.length,
    destructive: parsedChanges.filter(c => c.isDestructive).length,
  }), [parsedChanges]);

  return (
    <div className="space-y-6">
      {/* Input Mode Selection */}
      <div className="flex flex-wrap gap-2 items-center justify-center">
        {[
          { mode: 'file' as InputMode, label: '📁 File Upload', icon: '📁' },
          { mode: 'json' as InputMode, label: '{ } Paste JSON', icon: '{}' },
          { mode: 'text' as InputMode, label: '📝 Paste Text', icon: '📝' },
        ].map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => setInputMode(mode)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              inputMode === mode
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="space-y-4">
        {inputMode === 'file' ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-12 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer bg-white dark:bg-slate-800"
          >
            <input
              type="file"
              accept=".json,.tfplan,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl shadow-lg">
                📁
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-lg font-medium mb-2">
                Drag & drop a plan file here
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                or click to browse (JSON, .tfplan, or .txt)
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {inputMode === 'json' ? 'Plan JSON (from terraform show -json)' : 'Plan Output (from terraform plan)'}
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-64 p-4 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200"
              placeholder={
                inputMode === 'json'
                  ? 'Paste the output of `terraform show -json plan.tfplan` here...'
                  : 'Paste the output of `terraform plan` here...'
              }
            />
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Summary */}
      {parsedChanges.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center border border-green-100 dark:border-green-800">
              <div className="text-3xl mb-1">➕</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.create}</div>
              <div className="text-sm text-green-700 dark:text-green-300">Add</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center border border-blue-100 dark:border-blue-800">
              <div className="text-3xl mb-1">🔄</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.update}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Change</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 text-center border border-yellow-100 dark:border-yellow-800">
              <div className="text-3xl mb-1">♻️</div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summary.replace}</div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">Replace</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center border border-red-100 dark:border-red-800">
              <div className="text-3xl mb-1">❌</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.delete}</div>
              <div className="text-sm text-red-700 dark:text-red-300">Destroy</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-600">
              <div className="text-3xl mb-1">📊</div>
              <div className="text-2xl font-bold text-slate-700 dark:text-white">{summary.total}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300">Total</div>
            </div>
          </div>

          {summary.destructive > 0 && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-red-700 dark:text-red-300 font-semibold">
                ⚠️ Warning: {summary.destructive} destructive action{summary.destructive > 1 ? 's' : ''} detected!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Changes by Module */}
      {parsedChanges.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Changes by Module</h2>
          <div className="space-y-6">
            {Array.from(groupedChanges.entries()).map(([module, changes]) => (
              <div key={module} className="space-y-2">
                <h3 className="text-lg font-medium text-blue-600 dark:text-blue-400 border-b border-slate-200 dark:border-slate-700 pb-2">
                  {module}
                </h3>
                <ul className="space-y-2">
                  {changes.map((change, index) => {
                    const isExpanded = expandedChanges.has(change.address);
                    const hasDetails = change.before || change.after;
                    const changedKeys = hasDetails ? getChangedKeys(change.before, change.after) : new Set<string>();
                    
                    return (
                      <li key={`${change.address}-${index}`} className="space-y-0">
                        {/* Clickable row */}
                        <div
                          onClick={() => hasDetails && toggleExpanded(change.address)}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                            hasDetails ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700' : ''
                          } ${
                            change.isDestructive
                              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                              : 'bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600'
                          }`}
                        >
                          {/* Expand/collapse indicator */}
                          {hasDetails && (
                            <span className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                              ▶
                            </span>
                          )}
                          <span className="text-xl">{getActionEmoji(change.action)}</span>
                          <span className={`font-medium ${
                            change.isDestructive ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {getActionLabel(change.action)}
                          </span>
                          {change.isDestructive && (
                            <span className="text-red-500 dark:text-red-400 text-sm">⚠️ Destructive</span>
                          )}
                          <code className="ml-auto text-sm text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {change.address}
                          </code>
                        </div>
                        
                        {/* Expandable details panel */}
                        {isExpanded && hasDetails && (
                          <div className={`mt-1 p-4 rounded-b-xl border border-t-0 ${
                            change.isDestructive
                              ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                              : 'bg-slate-50/50 dark:bg-slate-700/30 border-slate-100 dark:border-slate-600'
                          }`}>
                            {/* Show action-specific content */}
                            {change.action === 'create' && change.after && (
                              <div>
                                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                  <span className="text-green-500">+</span> Resource Configuration (to be created)
                                </h4>
                                <pre className="text-xs font-mono bg-slate-900 dark:bg-slate-950 text-green-400 p-3 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                                  {formatJsonDisplay(change.after)}
                                </pre>
                              </div>
                            )}
                            
                            {change.action === 'delete' && change.before && (
                              <div>
                                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                  <span className="text-red-500">-</span> Resource Configuration (to be deleted)
                                </h4>
                                <pre className="text-xs font-mono bg-slate-900 dark:bg-slate-950 text-red-400 p-3 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                                  {formatJsonDisplay(change.before)}
                                </pre>
                              </div>
                            )}
                            
                            {change.action === 'update' && (change.before || change.after) && (
                              <div className="space-y-4">
                                {change.before && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                      <span className="text-red-500">-</span> Before
                                    </h4>
                                    <pre className="text-xs font-mono bg-slate-900 dark:bg-slate-950 text-red-400 p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                                      {formatJsonDisplay(change.before)}
                                    </pre>
                                  </div>
                                )}
                                {change.after && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                      <span className="text-green-500">+</span> After
                                    </h4>
                                    <pre className="text-xs font-mono bg-slate-900 dark:bg-slate-950 text-green-400 p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                                      {formatJsonDisplay(change.after)}
                                    </pre>
                                  </div>
                                )}
                                {changedKeys.size > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                      <span className="text-yellow-500">~</span> Changed Keys
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                      {Array.from(changedKeys).map(key => (
                                        <span key={key} className="text-xs font-mono bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded">
                                          {key}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {change.action === 'replace' && (change.before || change.after) && (
                              <div className="space-y-4">
                                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
                                  ⚠️ This resource will be destroyed and recreated
                                </div>
                                {change.before && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                      <span className="text-red-500">-</span> Current State (will be destroyed)
                                    </h4>
                                    <pre className="text-xs font-mono bg-slate-900 dark:bg-slate-950 text-red-400 p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                                      {formatJsonDisplay(change.before)}
                                    </pre>
                                  </div>
                                )}
                                {change.after && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                      <span className="text-green-500">+</span> New State (will be created)
                                    </h4>
                                    <pre className="text-xs font-mono bg-slate-900 dark:bg-slate-950 text-green-400 p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                                      {formatJsonDisplay(change.after)}
                                    </pre>
                                  </div>
                                )}
                                {changedKeys.size > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                      <span className="text-yellow-500">~</span> Changed Keys (forcing replacement)
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                      {Array.from(changedKeys).map(key => (
                                        <span key={key} className="text-xs font-mono bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded">
                                          {key}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Buttons */}
      {parsedChanges.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => copyToClipboard('markdown')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
          >
            {copied === 'markdown' ? '✓ Copied!' : '📋 Copy Markdown'}
          </button>
          <button
            onClick={() => copyToClipboard('plaintext')}
            className="px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all duration-200 font-medium border border-slate-200 dark:border-slate-700"
          >
            {copied === 'plaintext' ? '✓ Copied!' : '📋 Copy Plaintext'}
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={loadExample}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors shadow-lg shadow-purple-500/25"
        >
          Load Example
        </button>
        <button
          onClick={clearInput}
          className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
