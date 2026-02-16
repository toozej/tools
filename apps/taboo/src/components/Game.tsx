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
  const [gamePhase, setGamePhase] =useState<'setup' | 'playing' | 'end'>('setup');
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
      // Defer state updates to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        setCurrentTeam((prev) => (prev + 1) % 2);
        setTimeLeft(60);
        setTimerRunning(true);
        if (currentCardIndex >= deck.length - 1) {
          setGamePhase('end');
        } else {
          setCurrentCardIndex((prev) => prev + 1);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [timerRunning, timeLeft, currentCardIndex, deck.length]);

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
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
      <div className="p-6 sm:p-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center text-slate-900 dark:text-white">
          Game Setup
        </h2>
        <div className="space-y-4 w-full max-w-sm mx-auto">
          <input
            type="text"
            placeholder="Team 1 Name"
            value={teams[0].name}
            onChange={(e) => handleTeamNameChange(0, e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Team 2 Name"
            value={teams[1].name}
            onChange={(e) => handleTeamNameChange(1, e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={startGame}
            disabled={!teams[0].name || !teams[1].name}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  if (gamePhase === 'playing') {
    const card = deck[currentCardIndex];
    if (!card) return <div className="p-8 text-center">Loading...</div>;
    return (
      <div className="p-4 sm:p-8 flex flex-col items-center">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">
            Current Team: <span className="text-blue-600 dark:text-blue-400">{teams[currentTeam].name}</span>
          </h2>
          <div className="text-6xl font-bold text-slate-900 dark:text-white mt-2">{timeLeft}</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 w-full max-w-md">
          <h3 className="text-3xl font-bold mb-6 text-center text-slate-900 dark:text-white">{card.target}</h3>
          <div className="mb-6">
            <h4 className="font-semibold mb-3 text-center text-slate-600 dark:text-slate-400">Taboo Words:</h4>
            <ul className="grid grid-cols-2 gap-2 text-center">
              {card.taboo.map((word, i) => (
                <li key={i} className="text-red-600 dark:text-red-500 bg-red-100/50 dark:bg-red-900/30 rounded-md px-2 py-1">
                  {word}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <button onClick={guessCorrect} className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-2 rounded-lg transition-colors text-sm sm:text-base">
              Correct
            </button>
            <button onClick={pass} className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-2 rounded-lg transition-colors text-sm sm:text-base">
              Pass
            </button>
            <button onClick={buzz} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-2 rounded-lg transition-colors text-sm sm:text-base">
              Buzz
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-lg text-slate-700 dark:text-slate-300">
            <span className="font-semibold">{teams[0].name}:</span> {teams[0].score} | <span className="font-semibold">{teams[1].name}:</span> {teams[1].score}
          </p>
        </div>
      </div>
    );
  }

  if (gamePhase === 'end') {
    const winner =
      teams[0].score > teams[1].score ? teams[0] : teams[1].score > teams[0].score ? teams[1] : null;
    return (
      <div className="p-8 text-center">
        <h1 className="text-4xl font-bold mb-8 text-slate-900 dark:text-white">Game Over</h1>
        <div className="text-center bg-slate-100 dark:bg-slate-800 p-8 rounded-lg">
          <p className="text-2xl mb-4 text-slate-700 dark:text-slate-300">
            <span className="font-bold">{teams[0].name}:</span> {teams[0].score}
          </p>
          <p className="text-2xl mb-6 text-slate-700 dark:text-slate-300">
            <span className="font-bold">{teams[1].name}:</span> {teams[1].score}
          </p>
          {winner ? (
            <p className="text-3xl font-semibold text-green-600 dark:text-green-400">Winner: {winner.name}!</p>
          ) : (
            <p className="text-3xl font-semibold text-blue-600 dark:text-blue-400">It is a Tie!</p>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default Game;
