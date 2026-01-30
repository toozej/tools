"use client";

import { useState, useEffect } from 'react';
import { cards } from '../data/cards';

type Card = { target: string; taboo: string[] };
type Team = { name: string; score: number };

const Game: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([
    { name: '', score: 0 },
    { name: '', score: 0 },
  ]);
  const [gamePhase, setGamePhase] = useState<'setup' | 'playing' | 'end'>('setup');
  const [currentTeam, setCurrentTeam] = useState(0);
  const [deck, setDeck] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);

  const handleTeamNameChange = (index: number, name: string) => {
    setTeams((prev) => prev.map((t, i) => (i === index ? { ...t, name } : t)));
  };

  const startGame = () => {
    if (teams[0].name && teams[1].name) {
      const shuffled = [...cards].sort(() => Math.random() - 0.5);
      setDeck(shuffled);
      setCurrentCardIndex(0);
      setGamePhase('playing');
      setTimerRunning(true);
    }
  };

  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      setCurrentTeam((prev) => (prev + 1) % 2);
      setTimeLeft(60);
      setTimerRunning(true);
      if (currentCardIndex >= deck.length - 1) {
        setGamePhase('end');
      } else {
        setCurrentCardIndex((prev) => prev + 1);
      }
    }
  }, [timerRunning, timeLeft, currentTeam, currentCardIndex, deck.length]);

  const guessCorrect = () => {
    setTeams((prev) => prev.map((t, i) => (i === currentTeam ? { ...t, score: t.score + 1 } : t)));
    nextCard();
  };

  const pass = () => {
    nextCard();
  };

  const buzz = () => {
    playBuzzer();
    const opposing = (currentTeam + 1) % 2;
    setTeams((prev) => prev.map((t, i) => (i === opposing ? { ...t, score: t.score + 1 } : t)));
    nextCard();
  };

  const nextCard = () => {
    if (currentCardIndex < deck.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
    } else {
      setGamePhase('end');
    }
  };

  const playBuzzer = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  if (gamePhase === 'setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-3xl font-bold mb-8">Taboo Game Setup</h1>
        <div className="space-y-4 w-full max-w-sm">
          <input
            type="text"
            placeholder="Team 1 Name"
            value={teams[0].name}
            onChange={(e) => handleTeamNameChange(0, e.target.value)}
            className="border p-2 rounded w-full"
          />
          <input
            type="text"
            placeholder="Team 2 Name"
            value={teams[1].name}
            onChange={(e) => handleTeamNameChange(1, e.target.value)}
            className="border p-2 rounded w-full"
          />
          <button
            onClick={startGame}
            disabled={!teams[0].name || !teams[1].name}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 w-full"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  if (gamePhase === 'playing') {
    const card = deck[currentCardIndex];
    if (!card) return <div>Loading...</div>; // Safety
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-semibold">Current Team: {teams[currentTeam].name}</h2>
          <div className="text-4xl font-bold">{timeLeft}</div>
        </div>
        <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
          <h3 className="text-2xl font-bold mb-4 text-center">{card.target}</h3>
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Taboo Words:</h4>
            <ul className="list-disc list-inside grid grid-cols-2 gap-1">
              {card.taboo.map((word, i) => (
                <li key={i} className="text-red-600">{word}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <button onClick={guessCorrect} className="bg-green-500 text-white px-4 py-2 rounded flex-1 min-w-0">
              Correct
            </button>
            <button onClick={pass} className="bg-yellow-500 text-white px-4 py-2 rounded flex-1 min-w-0">
              Pass
            </button>
            <button onClick={buzz} className="bg-red-500 text-white px-4 py-2 rounded flex-1 min-w-0">
              Buzz
            </button>
          </div>
        </div>
        <div className="mt-4 text-center">
          <p className="text-lg">
            {teams[0].name}: {teams[0].score} | {teams[1].name}: {teams[1].score}
          </p>
        </div>
      </div>
    );
  }

  if (gamePhase === 'end') {
    const winner =
      teams[0].score > teams[1].score ? teams[0] : teams[1].score > teams[0].score ? teams[1] : null;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-3xl font-bold mb-8">Game Over</h1>
        <div className="text-center">
          <p className="text-lg mb-2">
            {teams[0].name}: {teams[0].score}
          </p>
          <p className="text-lg mb-4">
            {teams[1].name}: {teams[1].score}
          </p>
          {winner ? (
            <p className="text-xl font-semibold">Winner: {winner.name}</p>
          ) : (
            <p className="text-xl font-semibold">It is a Tie!</p>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default Game;