export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL parameter is required' };
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

export function validateText(text: unknown): ValidationResult {
  if (!text) {
    return { valid: false, error: 'Text is required' };
  }

  if (typeof text !== 'string') {
    return { valid: false, error: 'Text must be a string' };
  }

  if (text.trim().length === 0) {
    return { valid: false, error: 'Text cannot be empty' };
  }

  return { valid: true };
}

export function validateRequiredEnvVars(
  vars: string[]
): { valid: boolean; missing: string[] } {
  const missing = vars.filter((v) => !process.env[v]);
  return {
    valid: missing.length === 0,
    missing,
  };
}
