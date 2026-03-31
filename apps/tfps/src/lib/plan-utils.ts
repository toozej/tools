export interface ResourceChange {
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

export interface PlanOutput {
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

export interface ParsedChange {
  resourceModule: string;
  address: string;
  type: string;
  name: string;
  action: 'create' | 'update' | 'delete' | 'replace' | 'read';
  isDestructive: boolean;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  afterUnknown?: Record<string, unknown>;
}

export type InputMode = 'file' | 'json' | 'text';

export function parseJsonPlan(json: PlanOutput): ParsedChange[] {
  const changes: ParsedChange[] = [];
  const resourceChanges = json.resource_changes || [];

  for (const rc of resourceChanges) {
    const actions = rc.change.actions;
    let action: ParsedChange['action'] = 'create';
    let isDestructive = false;

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
      continue;
    }

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

export function parseTextPlan(text: string): ParsedChange[] {
  const changes: ParsedChange[] = [];
  const lines = text.split('\n');

  const planPattern = /^(\s*)#?\s*(.+?)\s+will be (created|updated|destroyed|replaced)/i;
  const actionPattern = /^(\s*)([+-~])\s+(?:resource\s+)?"?([^"\s]+)"?\s+"([^"]+)"/i;
  const modulePattern = /module\.([^\.]+)/;

  let currentModule = 'root';

  for (const line of lines) {
    const moduleMatch = line.match(modulePattern);
    if (moduleMatch && line.includes('module.')) {
      currentModule = `module.${moduleMatch[1]}`;
    }

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

export function getActionEmoji(action: ParsedChange['action']): string {
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

export function getActionLabel(action: ParsedChange['action']): string {
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

export function groupByModule(changes: ParsedChange[]): Map<string, ParsedChange[]> {
  const groups = new Map<string, ParsedChange[]>();

  for (const change of changes) {
    const existing = groups.get(change.resourceModule) || [];
    existing.push(change);
    groups.set(change.resourceModule, existing);
  }

  return groups;
}

export function generateMarkdown(changes: ParsedChange[]): string {
  const groups = groupByModule(changes);
  const lines: string[] = [];

  lines.push('# Terraform Plan Summary\n');

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

export function generatePlaintext(changes: ParsedChange[]): string {
  const groups = groupByModule(changes);
  const lines: string[] = [];

  lines.push('Terraform Plan Summary');
  lines.push('='.repeat(50));
  lines.push('');

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
