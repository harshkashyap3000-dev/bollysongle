'use client';

import React, { useState, useEffect, useMemo } from 'react';
import rawSongs from '../data/songs.json';
import { Song, GuessResult } from '../types/game';
import { evaluateGuess } from '../utils/gameLogic';

const MAX_GUESSES = 7;

// --- STRICT ALTERNATE VERSION FILTER ---
const altKeywords = [
  'remix', 'reprise', 'unplugged', 'revibe', 'version', 'mashup', 
  'lofi', 'lo-fi', 'instrumental', 'karaoke', 'acoustic', 'mix', 'edit'
];

const songs: Song[] = (rawSongs as Song[]).filter((s) => {
  const lowerTitle = s.title.toLowerCase();
  const isAlt = altKeywords.some(kw => new RegExp(`\\b${kw}\\b`).test(lowerTitle));
  const isPre2000 = Number(s.year) < 2000;

  return !isAlt && !isPre2000;
}).map((s) => {
  // CLEANUP: If the scraper accidentally put a legacy singer/actor as the composer, clear it or fix it
  if (s.composer?.toLowerCase().includes('kishore kumar') || s.composer?.toLowerCase().includes('mohammed rafi')) {
    return { ...s, composer: 'Various / Unknown' };
  }
  return s;
});

// --- FAME CATEGORIZATION ENGINE ---
const A_LIST = [
  'shah rukh khan', 'salman khan', 'aamir khan', 'akshay kumar', 'hrithik roshan',
  'amitabh bachchan', 'deepika padukone', 'priyanka chopra', 'kareena kapoor',
  'ranbir kapoor', 'ranveer singh', 'alia bhatt', 'katrina kaif', 'ajay devgn',
  'arijit singh', 'shreya ghoshal', 'a. r. rahman', 'pritam', 'vishal-shekhar',
  'udit narayan', 'sonu nigam', 'kumar sanu', 'alka yagnik', 'sunidhi chauhan'
];

const moviesMap = new Map<string, Song[]>();
const famousMovies: string[] = [];
const standardMovies: string[] = [];

songs.forEach((s) => {
  if (!moviesMap.has(s.movie)) moviesMap.set(s.movie, []);
  moviesMap.get(s.movie)!.push(s);
});

Array.from(moviesMap.entries()).forEach(([movieName, movieSongs]) => {
  const isFamous = movieSongs.some((song) => {
    const text = [...song.actors, ...song.singers, song.composer].join(' ').toLowerCase();
    return A_LIST.some((star) => text.includes(star));
  });

  if (isFamous) famousMovies.push(movieName);
  else standardMovies.push(movieName);
});

famousMovies.sort();
standardMovies.sort();

export default function BollyGuesser() {
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'instructions' | 'game'>('menu');
  const [gameMode, setGameMode] = useState<'daily' | 'unlimited' | null>(null);

  const [targetSong, setTargetSong] = useState<Song | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  
  const [usedLifelines, setUsedLifelines] = useState<number[]>([]);
  const [activeLifeline, setActiveLifeline] = useState<number | null>(null);
  const [revealedHints, setRevealedHints] = useState<string[]>([]);
  const [showEndModal, setShowEndModal] = useState(false);
  
  const [dayNumber, setDayNumber] = useState<number | string>(1);
  const [todayStr, setTodayStr] = useState('');

  const startNewGame = (mode: 'daily' | 'unlimited') => {
    setGameMode(mode);
    setGuesses([]);
    setIsGameOver(false);
    setHasWon(false);
    setUsedLifelines([]);
    setActiveLifeline(null);
    setRevealedHints([]);
    setShowEndModal(false);
    setSearchTerm('');

    if (mode === 'daily') {
      const now = new Date();
      const startDate = new Date(2026, 8, 9); 
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffTime = today.getTime() - startDate.getTime();
      const currentDayNumber = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
      
      setDayNumber(currentDayNumber);
      setTodayStr(new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(now));
      
      const isFamousDay = (currentDayNumber * 13) % 100 < 75;
      const pool = isFamousDay && famousMovies.length > 0 ? famousMovies : standardMovies;
      const selectedMovieName = pool[(currentDayNumber * 997) % pool.length];
      
      const movieSongs = moviesMap.get(selectedMovieName)!;
      const targetTrack = movieSongs[(currentDayNumber * 17) % movieSongs.length];
      
      setTargetSong(targetTrack);
    } else {
      setDayNumber('∞');
      setTodayStr('Unlimited Mode');
      
      const isFamousRound = Math.random() < 0.75;
      const pool = isFamousRound && famousMovies.length > 0 ? famousMovies : standardMovies;
      const selectedMovieName = pool[Math.floor(Math.random() * pool.length)];
      
      const movieSongs = moviesMap.get(selectedMovieName)!;
      const targetTrack = movieSongs[Math.floor(Math.random() * movieSongs.length)];
      
      setTargetSong(targetTrack);
    }

    setCurrentScreen('instructions');
  };

  const filteredSongs = useMemo(() => {
    if (!searchTerm.trim() || isGameOver || activeLifeline !== null) return [];
    const guessedIds = new Set(guesses.map((g) => g.song.id));
    const term = searchTerm.toLowerCase().trim();

    const getRelevanceScore = (song: Song, searchStr: string) => {
      const title = song.title.toLowerCase();
      const movie = song.movie.toLowerCase();
      
      if (title === searchStr || movie === searchStr) return 0; 
      if (title.startsWith(searchStr) || movie.startsWith(searchStr)) return 1; 
      if (title.includes(` ${searchStr}`) || movie.includes(` ${searchStr}`)) return 2; 
      return 3; 
    };

    return songs
      .filter(
        (s) =>
          !guessedIds.has(s.id) &&
          (s.title.toLowerCase().includes(term) || s.movie.toLowerCase().includes(term))
      )
      .sort((a, b) => getRelevanceScore(a, term) - getRelevanceScore(b, term))
      .slice(0, 5); 
  }, [searchTerm, guesses, isGameOver, activeLifeline]);

  const handleSelectSong = (song: Song) => {
    if (!targetSong || isGameOver) return;

    const result = evaluateGuess(song, targetSong);
    const updatedGuesses = [...guesses, result];
    setGuesses(updatedGuesses);
    setSearchTerm('');

    if (String(song.id) === String(targetSong.id)) {
      setHasWon(true);
      setIsGameOver(true);
      setTimeout(() => setShowEndModal(true), 500); 
    } else if (updatedGuesses.length >= MAX_GUESSES) {
      setIsGameOver(true);
      setTimeout(() => setShowEndModal(true), 500);
    }
  };

  const { minYear, maxYear, isYearGuessed } = useMemo(() => {
    let min = 2000;
    let max = 2024;
    let guessed = false;

    if (targetSong) {
      guesses.forEach((g) => {
        const guessYear = Number(g.song.year);
        const targetYear = Number(targetSong.year);

        if (guessYear === targetYear) {
          min = guessYear;
          max = guessYear;
          guessed = true;
        } else if (guessYear < targetYear) {
          if (guessYear >= min) min = guessYear; 
        } else if (guessYear > targetYear) {
          if (guessYear <= max) max = guessYear; 
        }
      });
    }

    return { minYear: min, maxYear: max, isYearGuessed: guessed || isGameOver };
  }, [guesses, isGameOver, targetSong]);

  const handleLifelineClick = (level: number) => {
    if (usedLifelines.includes(level) || isGameOver) return;
    setActiveLifeline(prev => prev === level ? null : level);
  };

  const revealSpecificPill = (value: string) => {
    if (activeLifeline === null) return;
    setRevealedHints(prev => [...prev, value]);
    setUsedLifelines(prev => [...prev, activeLifeline]);
    setActiveLifeline(null);
  };

  const isMovieRevealed = isGameOver || 
    guesses.some((g) => g.song.movie.toLowerCase() === targetSong?.movie.toLowerCase()) || 
    revealedHints.includes(targetSong?.movie || '');

  const isComposerRevealed = isGameOver || 
    guesses.some((g) => g.composerMatch === 'correct') || 
    revealedHints.includes(targetSong?.composer || '');

  const isSingerRevealed = (singer: string) => {
    const targetLower = singer.toLowerCase();
    return isGameOver || 
      guesses.some((g) => g.song.singers.some(s => s.toLowerCase() === targetLower)) || 
      revealedHints.includes(singer);
  };

  const isActorRevealed = (actor: string) => {
    if (isGameOver || revealedHints.includes(actor)) return true;
    
    const targetActorParts = actor.toLowerCase().trim().split(/\s+/);
    
    return guesses.some((g) => {
      return (g.song.actors || []).some((guessActor) => {
        const guessActorParts = guessActor.toLowerCase().trim().split(/\s+/);
        return targetActorParts.some(tp => guessActorParts.some(gp => tp === gp));
      });
    });
  };

  const renderPill = (value: string | undefined, isRevealed: boolean, baseColor: string, emptyColor: string, hoverColor: string, isMoviePill = false) => {
    if (!value) return null;
    const canBeRevealedByCurrentLifeline = isMoviePill ? activeLifeline === 2 : activeLifeline !== null;
    const isClickable = canBeRevealedByCurrentLifeline && !isRevealed;

    if (!isRevealed) {
      return (
        <div 
          onClick={() => isClickable && revealSpecificPill(value)}
          className={`h-[34px] min-w-[120px] rounded-full transition-all duration-300 ${emptyColor} ${
            isClickable ? `cursor-pointer ring-2 ring-white/60 animate-pulse ${hoverColor} opacity-100` : 'opacity-60'
          }`}
          title={isClickable ? "Click to reveal!" : "Hidden"}
        />
      );
    }

    return (
      <div className={`px-5 py-1.5 h-[34px] rounded-full text-[13px] font-bold flex items-center justify-center min-w-[120px] whitespace-nowrap text-white shadow-inner shadow-black/40 ${baseColor}`}>
        {value}
      </div>
    );
  };

  const copyResults = () => {
    const numWords = ['FAILED', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'];
    
    let headerText = '';
    if (hasWon) {
      headerText = `BollySongle #${dayNumber}: ${numWords[guesses.length]} ${guesses.length === 1 ? 'turn' : 'turns'}!`;
    } else {
      headerText = `BollySongle #${dayNumber}: FAILED!`;
    }
    const header = `${headerText}\n${todayStr}\n`;

    const getNumberEmoji = (num: number) => {
      const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
      return emojis[num] || num.toString();
    };

    const grid = guesses.map(g => {
      if (g.song.id === targetSong?.id) {
        return '🔴☑️|🟢☑️|🔵☑️';
      }

      let redScore = 0;
      if (g.song.year === targetSong?.year) redScore++;
      if (g.song.movie === targetSong?.movie) redScore++;
      const redStr = redScore === 2 ? '☑️' : redScore === 0 ? '❌' : getNumberEmoji(redScore);

      const targetActors = new Set(targetSong?.actors || []);
      const guessActors = new Set(g.song.actors);
      let actorScore = 0;
      guessActors.forEach(actor => { if (targetActors.has(actor)) actorScore++; });
      const greenStr = (actorScore === targetActors.size && targetActors.size > 0) ? '☑️' : actorScore === 0 ? '❌' : getNumberEmoji(actorScore);

      const targetAudio = new Set([targetSong?.composer, ...(targetSong?.singers || [])].filter(Boolean));
      const guessAudio = new Set([g.song.composer, ...g.song.singers].filter(Boolean));
      let audioScore = 0;
      guessAudio.forEach(item => { if (targetAudio.has(item)) audioScore++; });
      const blueStr = (audioScore === targetAudio.size && targetAudio.size > 0) ? '☑️' : audioScore === 0 ? '❌' : getNumberEmoji(audioScore);

      return `🔴${redStr}|🟢${greenStr}|🔵${blueStr}`;
    }).join('\n');

    const footer = `\n\nPlay at https://bollysongle.vercel.app\n\n🔴: Year + Movie\n🟢: Cast\n🔵: Audio (Music Director + Singers)`;

    navigator.clipboard.writeText(header + '\n' + grid + footer);
    alert('Results copied to clipboard!');
  };

  if (currentScreen === 'menu') {
    return (
      <main className="min-h-screen bg-[#111111] text-zinc-300 font-sans flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-6 left-6 text-xl font-bold tracking-widest text-zinc-500">
          Bolly<span className="text-red-500">S</span>ongle
        </div>
        
        <div className="max-w-md w-full flex flex-col items-center text-center gap-6">
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-widest mb-2">
            Bolly<span className="text-red-600">S</span>ongle
          </h1>
          <p className="text-lg font-semibold text-zinc-200">
            Guess the Bollywood song in 7 attempts!
          </p>
          <p className="text-sm text-zinc-400 leading-relaxed mb-4">
            Like Wordle, each guess uncovers common elements between your guess and the Mystery Song. <br/><br/>
            A new Mystery Song is available everyday.
          </p>
          
          <button 
            onClick={() => startNewGame('daily')}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-full text-base transition-colors shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
          >
            ▷ Play Today's Game
          </button>
          
          <div className="w-full flex gap-3">
            <button 
              onClick={() => startNewGame('unlimited')}
              className="flex-1 bg-[#1a1a1a] hover:bg-[#252525] border border-red-900/50 text-red-500 font-bold py-3 rounded-full text-sm transition-colors flex items-center justify-center gap-2"
            >
              ∞ Play Unlimited
            </button>
            <button 
              disabled
              className="flex-1 bg-[#1a1a1a] border border-zinc-800 text-zinc-600 font-bold py-3 rounded-full text-sm opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
            >
              ▦ Past Games
            </button>
          </div>
          
          <p className="text-zinc-500 text-sm mt-6 font-medium">No: {dayNumber}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111111] text-zinc-300 font-sans p-4 md:p-8 flex justify-center relative">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        
        <header className="w-full flex items-center justify-between pt-2 pb-2 border-b border-zinc-800/50">
          <div className="text-lg font-black tracking-widest text-zinc-200 cursor-pointer" onClick={() => setCurrentScreen('menu')}>
            Bolly<span className="text-red-600">S</span>ongle
          </div>
          <button onClick={() => setCurrentScreen('instructions')} className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center hover:bg-zinc-700 font-bold">?</button>
        </header>

        {currentScreen === 'instructions' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#181818] border border-zinc-700/50 rounded-2xl max-w-lg w-full shadow-2xl relative overflow-hidden">
              <div className="p-6">
                <button onClick={() => setCurrentScreen('game')} className="absolute top-5 right-5 w-7 h-7 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center hover:bg-zinc-700 hover:text-white transition-colors">✕</button>
                
                <h2 className="text-2xl font-bold text-white text-center mb-6">How To Play</h2>
                
                <p className="font-semibold text-zinc-200 mb-4">Guess the <i className="text-white font-bold">Mystery Song</i> in 7 attempts</p>
                
                <ul className="space-y-3 text-sm text-zinc-400 mb-8 list-disc pl-5">
                  <li>Each guess must be a real Bollywood song released in or after 2000.</li>
                  <li>After each guess, the game will reveal those features (like Year of Release, Cast, Music Director) of the Mystery Song that are in common with the Guessed Song.</li>
                  <li>If you guess a track from the same movie as the Mystery Song, the <b>Movie Bubble</b> will automatically reveal!</li>
                  {gameMode === 'daily' ? (
                    <li>A new game is available at midnight everyday.</li>
                  ) : (
                    <li>You are playing <strong>Unlimited Mode</strong>. The song is completely random and will refresh every time you hit play!</li>
                  )}
                </ul>

                <div className="flex flex-col gap-3">
                  <div className="bg-[#111111] p-3 rounded-lg border border-zinc-800 text-sm font-medium flex items-center gap-2 cursor-not-allowed opacity-70">
                    <span className="text-zinc-500">▶</span> Example
                  </div>
                  <div className="bg-[#111111] p-3 rounded-lg border border-zinc-800 text-sm font-medium flex items-center gap-2 cursor-not-allowed opacity-70">
                    <span className="text-zinc-500">▶</span> Lifelines
                  </div>
                </div>

                <div className="mt-8 flex justify-center">
                  <button onClick={() => setCurrentScreen('game')} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-8 rounded-full transition-colors">
                    Start Playing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`flex flex-col lg:flex-row gap-6 relative ${currentScreen === 'instructions' ? 'opacity-30 pointer-events-none' : ''}`}>
          
          <div className={`flex-1 flex flex-col gap-4 transition-all duration-500 ${showEndModal ? 'blur-sm pointer-events-none' : ''}`}>
            
            <div className="bg-[#1a1a1a] border border-[#a62b2b]/30 rounded-xl p-6 flex flex-col items-center gap-6 shadow-md">
              <div className="w-full flex flex-col items-center gap-3">
                <span className="text-[11px] uppercase tracking-widest text-zinc-100 font-semibold">Year of Release</span>
                {isYearGuessed ? (
                  renderPill(targetSong?.year.toString(), true, 'bg-[#a62b2b]', '', '')
                ) : (
                  <div className="flex items-center gap-4 w-full justify-center">
                    <div className="px-6 py-1.5 rounded-full text-[13px] font-bold bg-[#a62b2b] text-white shadow-inner">{minYear}</div>
                    <div className="w-12 h-[2px] bg-zinc-600 relative flex items-center justify-between">
                      <div className="w-2 h-2 rounded-full bg-zinc-400 -ml-1"></div>
                      <div className="w-2 h-2 rounded-full bg-zinc-400 -mr-1"></div>
                    </div>
                    <div className="px-6 py-1.5 rounded-full text-[13px] font-bold bg-[#a62b2b] text-white shadow-inner">{maxYear}</div>
                  </div>
                )}
              </div>
              
              <div className="w-full flex flex-col items-center gap-3 border-t border-[#a62b2b]/20 pt-5">
                <span className="text-[11px] uppercase tracking-widest text-zinc-100 font-semibold flex items-center gap-1">
                  Movie <span className="text-[10px] text-zinc-500 border rounded-full w-3 h-3 flex items-center justify-center" title="Reveals early if you guess a song from the same movie, OR manually via the 6th guess lifeline">i</span>
                </span>
                {renderPill(targetSong?.movie, isMovieRevealed, 'bg-[#a62b2b]', 'bg-[#a62b2b]/20', 'hover:bg-[#a62b2b]/60', true)}
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#4a8a3a]/30 rounded-xl p-6 flex flex-col items-center gap-4 shadow-md">
              <span className="text-[11px] uppercase tracking-widest text-zinc-100 font-semibold flex items-center gap-1">
                Cast <span className="text-[10px] text-zinc-500 border rounded-full w-3 h-3 flex items-center justify-center">i</span>
              </span>
              <div className="flex flex-wrap justify-center gap-3 w-full">
                {targetSong?.actors.map((actor, idx) => (
                  <React.Fragment key={idx}>
                    {renderPill(actor, isActorRevealed(actor), 'bg-[#4a8a3a]', 'bg-[#4a8a3a]/20', 'hover:bg-[#4a8a3a]/60')}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#3a5a9a]/30 rounded-xl p-6 flex flex-col items-center gap-6 shadow-md">
              <div className="w-full flex flex-col items-center gap-3">
                <span className="text-[11px] uppercase tracking-widest text-zinc-100 font-semibold">Music Director</span>
                {targetSong?.composer && targetSong.composer !== 'Various / Unknown' ? (
                  renderPill(targetSong.composer, isComposerRevealed, 'bg-[#3a5a9a]', 'bg-[#3a5a9a]/20', 'hover:bg-[#3a5a9a]/60')
                ) : (
                  <div className="text-xs text-zinc-500 italic py-1.5">Not Available</div>
                )}
              </div>
              
              <div className="w-full flex flex-col items-center gap-3">
                <span className="text-[11px] uppercase tracking-widest text-zinc-100 font-semibold">Singers</span>
                <div className="flex flex-wrap justify-center gap-3 w-full">
                  {targetSong?.singers.map((singer, idx) => (
                    <React.Fragment key={idx}>
                      {renderPill(singer, isSingerRevealed(singer), 'bg-[#3a5a9a]', 'bg-[#3a5a9a]/20', 'hover:bg-[#3a5a9a]/60')}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={`w-full lg:w-[420px] flex flex-col transition-all duration-500 ${showEndModal ? 'blur-sm pointer-events-none' : ''}`}>
            
            <div className="flex justify-between items-center mb-6 px-2 text-xs text-zinc-400 font-medium">
              <span>#{dayNumber}</span>
              <span>{todayStr}</span>
            </div>
            
            <h2 className="text-center text-sm uppercase tracking-widest font-semibold text-zinc-200 mb-4">Guessed Songs</h2>

            <div className="grid grid-cols-2 gap-2 mb-8">
              {Array.from({ length: MAX_GUESSES }).map((_, idx) => {
                const guess = guesses[idx];
                const isFullRow = idx === MAX_GUESSES - 1;
                
                return (
                  <div 
                    key={idx} 
                    className={`bg-[#222222] border border-zinc-800 rounded-full px-4 py-2 text-xs font-medium flex items-center ${isFullRow ? 'col-span-2' : ''}`}
                  >
                    <span className="text-zinc-500 w-4">{idx + 1}.</span>
                    
                    {guess ? (
                      <div className="flex flex-1 items-center justify-between overflow-hidden pl-2">
                        <span className="text-zinc-300 truncate pr-2">{guess.song.title}</span>
                        {guess.song.id === targetSong?.id ? (
                          <span className="text-emerald-500 flex-shrink-0 ml-auto">✓</span>
                        ) : (
                          <span className="text-zinc-500 flex items-center gap-1 flex-shrink-0 ml-auto bg-[#111111] px-2 py-0.5 rounded-full border border-zinc-800">
                            {guess.song.year}
                            {guess.yearMatch === 'higher' && <span className="text-amber-500 font-bold">↑</span>}
                            {guess.yearMatch === 'lower' && <span className="text-amber-500 font-bold">↓</span>}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="flex-1 text-center text-zinc-600">—</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-zinc-800/50 my-2"></div>

            <div className="flex flex-col gap-3 mb-6">
              <button 
                disabled={guesses.length < 4 || usedLifelines.includes(1) || isGameOver}
                onClick={() => handleLifelineClick(1)}
                className={`border rounded-lg py-3 text-xs font-semibold flex items-center justify-between px-4 transition-all ${
                  usedLifelines.includes(1) ? 'bg-zinc-900 border-zinc-800 text-zinc-600' : activeLifeline === 1 ? 'bg-amber-900/30 border-amber-500 text-amber-400 animate-pulse' : guesses.length >= 4 ? 'bg-[#1a1a1a] border-zinc-600 text-zinc-200 hover:bg-[#222] cursor-pointer' : 'bg-[#141414] border-zinc-800 text-zinc-700 cursor-not-allowed'
                }`}
              >
                <span>✦</span>
                {usedLifelines.includes(1) ? "Lifeline Used" : activeLifeline === 1 ? "Select a Cast or Audio bubble (Click to cancel)" : guesses.length >= 4 ? "Use Lifeline (Reveal Cast or Audio)" : "Unlock Lifeline after 4th guess"}
                <span>✦</span>
              </button>
              <button 
                disabled={guesses.length < 6 || usedLifelines.includes(2) || isGameOver}
                onClick={() => handleLifelineClick(2)}
                className={`border rounded-lg py-3 text-xs font-semibold flex items-center justify-between px-4 transition-all ${
                  usedLifelines.includes(2) ? 'bg-zinc-900 border-zinc-800 text-zinc-600' : activeLifeline === 2 ? 'bg-amber-900/30 border-amber-500 text-amber-400 animate-pulse' : guesses.length >= 6 ? 'bg-[#1a1a1a] border-zinc-600 text-zinc-200 hover:bg-[#222] cursor-pointer' : 'bg-[#141414] border-zinc-800 text-zinc-700 cursor-not-allowed'
                }`}
              >
                <span>✦</span>
                {usedLifelines.includes(2) ? "Lifeline Used" : activeLifeline === 2 ? "Select ANY bubble (Click to cancel)" : guesses.length >= 6 ? "Use Lifeline (Reveal Movie, Cast or Audio)" : "Unlock Lifeline after 6th guess"}
                <span>✦</span>
              </button>
            </div>

            <div className="relative mt-auto">
              <input
                type="text"
                disabled={isGameOver || activeLifeline !== null}
                placeholder={activeLifeline !== null ? "Select a bubble to reveal..." : isGameOver ? (gameMode === 'daily' ? "Come back tomorrow!" : "Click Play Again for a new track!") : "Search for a Song or Movie"}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-zinc-800 rounded-xl py-3.5 px-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors disabled:opacity-50 text-center"
              />
              {filteredSongs.length > 0 && (
                <ul className="absolute bottom-[calc(100%+8px)] left-0 right-0 bg-[#1e1e1e] border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50">
                  {filteredSongs.map((song) => (
                    <li key={song.id} onClick={() => handleSelectSong(song)} className="px-4 py-3 hover:bg-[#2a2a2a] cursor-pointer flex flex-col border-b border-zinc-800/50 last:border-0">
                      <span className="font-semibold text-sm text-zinc-100">{song.title}</span>
                      <span className="text-xs text-zinc-500">{song.movie} ({song.year})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {showEndModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto">
              <div className="relative bg-[#111111] border border-zinc-700/50 rounded-2xl p-6 max-w-sm w-full flex flex-col items-center shadow-2xl shadow-black/80">
                
                <button 
                  onClick={() => setShowEndModal(false)}
                  className="absolute top-4 right-5 text-zinc-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
                
                <div className="w-full aspect-video bg-zinc-800 rounded-lg mb-4 mt-2 flex items-center justify-center overflow-hidden border border-zinc-700">
                  {hasWon ? (
                    <img src="/image_2ea782.jpg" alt="You are so clever" className="w-full h-full object-cover" />
                  ) : (
                    <img src="/image_2ea41f.jpg" alt="Disappointed" className="w-full h-full object-cover" />
                  )}
                </div>
                
                <h3 className="text-lg font-bold text-white mb-1">
                  {hasWon ? "Congratulations!!!" : "Game Over"}
                </h3>
                
                <p className="text-sm text-zinc-400 text-center mb-6">
                  {hasWon ? `You correctly guessed the Mystery Song in ${guesses.length} turns.` : `The Mystery Song was ${targetSong?.title} from ${targetSong?.movie}.`}
                </p>

                {gameMode === 'unlimited' && (
                  <button 
                    onClick={() => startNewGame('unlimited')}
                    className="w-full mb-6 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-full text-sm transition-colors shadow-lg shadow-red-900/20"
                  >
                    Play Again
                  </button>
                )}
                
                <div className="w-full flex items-center justify-between pt-4 border-t border-zinc-800/60 text-xs">
                  <span className="text-zinc-500">BollySongle * {todayStr}</span>
                  <button onClick={copyResults} className="bg-[#2a2a2a] hover:bg-[#333] text-white px-4 py-1.5 rounded-full font-bold flex items-center gap-2 transition-colors border border-zinc-700">
                    Share <span><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg></span>
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}