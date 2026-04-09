import { describe, it, expect } from 'bun:test';
import {
  getNextCardIndex,
  determineWinner,
  isValidTeamName,
  canStartGame,
  calculateScore,
} from './game-utils';

describe('getNextCardIndex', () => {
  it('returns next index when not at end of deck', () => {
    expect(getNextCardIndex(0, 10)).toBe(1);
    expect(getNextCardIndex(5, 10)).toBe(6);
  });

  it('returns null when at last card', () => {
    expect(getNextCardIndex(9, 10)).toBe(null);
  });

  it('returns null when index equals deck length - 1', () => {
    expect(getNextCardIndex(0, 1)).toBe(null);
  });

  it('handles empty deck', () => {
    expect(getNextCardIndex(0, 0)).toBe(null);
  });
});

describe('determineWinner', () => {
  it('returns team1 name when team1 has higher score', () => {
    const teams = [
      { name: 'Team A', score: 5 },
      { name: 'Team B', score: 3 },
    ];
    expect(determineWinner(teams)).toBe('Team A');
  });

  it('returns team2 name when team2 has higher score', () => {
    const teams = [
      { name: 'Team A', score: 3 },
      { name: 'Team B', score: 7 },
    ];
    expect(determineWinner(teams)).toBe('Team B');
  });

  it('returns tie when scores are equal', () => {
    const teams = [
      { name: 'Team A', score: 5 },
      { name: 'Team B', score: 5 },
    ];
    expect(determineWinner(teams)).toBe('tie');
  });

  it('returns null when teams array has fewer than 2 elements', () => {
    expect(determineWinner([{ name: 'Team A', score: 5 }])).toBe(null);
    expect(determineWinner([])).toBe(null);
  });
});

describe('isValidTeamName', () => {
  it('returns true for non-empty name', () => {
    expect(isValidTeamName('Team A')).toBe(true);
    expect(isValidTeamName('A')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isValidTeamName('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(isValidTeamName('   ')).toBe(false);
  });

  it('returns false for string with only newlines', () => {
    expect(isValidTeamName('\n\t')).toBe(false);
  });
});

describe('canStartGame', () => {
  it('returns true when both teams have valid names', () => {
    const teams = [
      { name: 'Team A', score: 0 },
      { name: 'Team B', score: 0 },
    ];
    expect(canStartGame(teams)).toBe(true);
  });

  it('returns false when one team has empty name', () => {
    const teams = [
      { name: 'Team A', score: 0 },
      { name: '', score: 0 },
    ];
    expect(canStartGame(teams)).toBe(false);
  });

  it('returns false when one team has whitespace-only name', () => {
    const teams = [
      { name: 'Team A', score: 0 },
      { name: '   ', score: 0 },
    ];
    expect(canStartGame(teams)).toBe(false);
  });

  it('returns false when teams array has fewer than 2 elements', () => {
    expect(canStartGame([{ name: 'Team A', score: 0 }])).toBe(false);
  });
});

describe('calculateScore', () => {
  it('adds points to specified team', () => {
    const teams = [
      { name: 'Team A', score: 5 },
      { name: 'Team B', score: 3 },
    ];
    const result = calculateScore(teams, 0, 2);
    expect(result[0].score).toBe(7);
    expect(result[1].score).toBe(3);
  });

  it('does not modify original array', () => {
    const teams = [
      { name: 'Team A', score: 5 },
      { name: 'Team B', score: 3 },
    ];
    calculateScore(teams, 0, 2);
    expect(teams[0].score).toBe(5);
  });

  it('handles negative points', () => {
    const teams = [
      { name: 'Team A', score: 5 },
      { name: 'Team B', score: 3 },
    ];
    const result = calculateScore(teams, 1, -1);
    expect(result[1].score).toBe(2);
  });
});