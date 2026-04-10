import yaml from 'js-yaml';

export interface ValidateResult {
  valid: boolean;
  error?: string;
  parsed?: unknown;
}

export interface FormatResult {
  success: boolean;
  formatted?: string;
  error?: string;
}

export function validateYaml(input: string): ValidateResult {
  if (!input || input.trim() === '') {
    return { valid: false, error: 'Input is empty' };
  }

  try {
    const parsed = yaml.load(input);
    return { valid: true, parsed };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function formatYaml(parsed: unknown, indent: number = 2): FormatResult {
  if (parsed === undefined || parsed === null) {
    return { success: false, error: 'No data to format' };
  }

  try {
    const formatted = yaml.dump(parsed, { indent });
    return { success: true, formatted };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function validateAndFormatYaml(input: string, indent: number = 2): FormatResult {
  const validation = validateYaml(input);

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return formatYaml(validation.parsed, indent);
}