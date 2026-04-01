export interface Credit {
  name: string;
  description?: string;
  url?: string;
}

export interface Author {
  name: string;
  url?: string;
}

export interface App {
  name: string;
  title: string;
  description: string;
  tags: string[];
  url: string;
  credits: Credit[];
  has_credits: boolean;
  author?: Author;
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function calculateSimilarity(query: string, text: string): number {
  const queryLower = query.toLowerCase().trim();
  const textLower = text.toLowerCase();

  if (textLower.includes(queryLower)) {
    return 0;
  }

  const distance = levenshteinDistance(queryLower, textLower.substring(0, queryLower.length + 20));
  return distance;
}

export function matchesTags(query: string, tags: string[]): boolean {
  const queryLower = query.toLowerCase().trim();
  return tags.some((tag) => {
    const tagLower = tag.toLowerCase();
    if (tagLower.includes(queryLower)) return true;
    if (queryLower.includes(tagLower)) return true;
    return levenshteinDistance(queryLower, tagLower) <= Math.max(2, queryLower.length / 3);
  });
}

export function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
}

export function getCreditDisplay(app: App): { name: string; url?: string } {
  if (app.author) {
    return { name: app.author.name, url: app.author.url };
  }
  if (app.credits && app.credits.length > 0) {
    return { name: app.credits[0].name, url: app.credits[0].url };
  }
  return { name: "toozej" };
}
