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

// Helper to validate scraper strings (rejects garbage handles like "Blake.08" or numbers)
const isValidName = (name: string | undefined): boolean => {
  if (!name) return false;
  const lower = name.toLowerCase();
  if (/\d/.test(lower) || lower.includes('.') || lower === 'various / unknown') {
    return false;
  }
  return true;
};

// --- MOVIE-LEVEL MUSIC DIRECTOR MAPPING ---
const movieComposerMap = new Map();

(rawSongs as Song[]).forEach((s) => {
  if (
    isValidName(s.composer) && 
    !(s.composer || '').toLowerCase().includes('kishore kumar') && 
    !(s.composer || '').toLowerCase().includes('mohammed rafi') && 
    !movieComposerMap.has(s.movie)
  ) {
    movieComposerMap.set(s.movie, s.composer);
  }
});

const songs: Song[] = (rawSongs as Song[]).filter((s) => {
  const lowerTitle = (s.title || '').toLowerCase();
  const isAlt = altKeywords.some(kw => new RegExp(`\\b${kw}\\b`).test(lowerTitle));
  const isPre2000 = Number(s.year) < 2000;

  return !isAlt && !isPre2000;
}).map((s) => {
  const sharedComposer = movieComposerMap.get(s.movie);
  if (sharedComposer) {
    return { ...s, composer: sharedComposer };
  }
  // Sanitize track-level composer if invalid
  if (!isValidName(s.composer)) {
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

const moviesMap = new Map();
const famousMovies: string[] = [];
const standardMovies: string[] = [];

songs.forEach((s) => {
  if (!moviesMap.has(s.movie)) moviesMap.set(s.movie, []);
  moviesMap.get(s.movie)!.push(s);
});

Array.from(moviesMap.entries()).forEach(([movieName, movieSongs]) => {
  const isFamous = movieSongs.some((song) => {
    const text = [...(song.actors || []), ...(song.singers || []), song.composer || ''].join(' ').toLowerCase();
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

  const [targetSong, setTargetSong] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  
  const [usedLifelines, setUsedLifelines] = useState([]);
  const [activeLifeline, setActiveLifeline] = useState(null);
  const [revealedHints, setRevealedHints] = useState([]);
  const [showEndModal, setShowEndModal] = useState(false);
  
  const [dayNumber, setDayNumber] = useState(1);
  const [todayStr, setTodayStr] = useState('');

  // UI States
  const [showExample, setShowExample] = useState(false);
  const [showLifelinesInfo, setShowLifelinesInfo] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<'movie' | 'cast' | null>(null);

  // --- Browser Back Button Interceptor ---
  useEffect(() => {
    const handlePopState = () => {
      if (currentScreen !== 'menu') {
        setCurrentScreen('menu');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentScreen]);

  const startNewGame = (mode: 'daily' | 'unlimited') => {
    window.history.pushState({ screen: 'game' }, '');

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
      const title = (song.title || '').toLowerCase();
      const movie = (song.movie || '').toLowerCase();
      
      if (title === searchStr || movie === searchStr) return 0; 
      if (title.startsWith(searchStr) || movie.startsWith(searchStr)) return 1; 
      if (title.includes(` \({searchStr}`) || movie.includes(`\){searchStr}`)) return 2; 
      return 3; 
    };

    return songs
      .filter(
        (s) =>
          !guessedIds.has(s.id) &&
          ((s.title || '').toLowerCase().includes(term) || (s.movie || '').toLowerCase().includes(term))
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
    guesses.some((g) => (g.song.movie || '').toLowerCase() === (targetSong?.movie || '').toLowerCase()) || 
    revealedHints.includes(targetSong?.movie || '');

  const isComposerRevealed = isGameOver || 
    guesses.some((g) => g.composerMatch === 'correct') || 
    revealedHints.includes(targetSong?.composer || '');

  const isSingerRevealed = (singer: string) => {
    if (!isValidName(singer)) return true;
    const targetLower = singer.toLowerCase();
    return isGameOver || 
      guesses.some((g) => (g.song.singers || []).some(s => s.toLowerCase() === targetLower)) || 
      revealedHints.includes(singer);
  };

  const isActorRevealed = (actor: string) => {
    if (!isValidName(actor)) return true;
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
    if (!value || !isValidName(value)) return null;
    const canBeRevealedByCurrentLifeline = isMoviePill ? activeLifeline === 2 : activeLifeline !== null;
    const isClickable = canBeRevealedByCurrentLifeline && !isRevealed;

    if (!isRevealed) {
      return }