export type Card = {
  target: string;
  taboo: string[];
};

export function shuffleDeck<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

export function getNextCardIndex(currentIndex: number, deckLength: number): number | null {
  if (currentIndex < deckLength - 1) {
    return currentIndex + 1;
  }
  return null;
}

export function determineWinner(teams: { name: string; score: number }[]): string | 'tie' | null {
  if (teams.length < 2) return null;
  
  const [team1, team2] = teams;
  
  if (team1.score > team2.score) return team1.name;
  if (team2.score > team1.score) return team2.name;
  return 'tie';
}

export function isValidTeamName(name: string): boolean {
  return name.trim().length > 0;
}

export function canStartGame(teams: { name: string; score: number }[]): boolean {
  return teams.length >= 2 && teams.every(t => isValidTeamName(t.name));
}

export function calculateScore(
  teams: { name: string; score: number }[],
  teamIndex: number,
  points: number
): { name: string; score: number }[] {
  return teams.map((t, i) => 
    i === teamIndex ? { ...t, score: t.score + points } : t
  );
}