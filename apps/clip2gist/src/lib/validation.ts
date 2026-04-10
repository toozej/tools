export interface CreateGistPayload {
  content: string;
  filename?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateCreateGistPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { content, filename } = payload as CreateGistPayload;

  if (content === undefined || content === null || content === '') {
    return { valid: false, error: 'Content is required' };
  }

  if (typeof content !== 'string') {
    return { valid: false, error: 'Content must be a string' };
  }

  if (content.trim() === '') {
    return { valid: false, error: 'Content is required' };
  }

  if (filename !== undefined && filename !== null && filename !== '') {
    if (typeof filename !== 'string') {
      return { valid: false, error: 'Filename must be a string' };
    }

    if (filename.includes('/') || filename.includes('\0')) {
      return { valid: false, error: 'Filename contains invalid characters' };
    }
  }

  return { valid: true };
}

export function sanitizeFilename(filename: string | undefined): string {
  if (!filename || filename.trim() === '') {
    return 'gist.txt';
  }

  let sanitized = filename.replace(/[\/\\\0]/g, '');
  
  if (sanitized.length === 0) {
    return 'gist.txt';
  }

  return sanitized;
}
