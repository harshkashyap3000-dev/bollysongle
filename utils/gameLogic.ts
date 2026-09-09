import { Song, GuessResult } from '../types/game';

export function evaluateGuess(guess: Song, target: Song): GuessResult {
  const yearMatch = guess.year === target.year 
    ? 'correct' 
    : guess.year > target.year ? 'lower' : 'higher';
    
  const movieMatch = guess.movie === target.movie ? 'correct' : 'incorrect';
  const composerMatch = guess.composer === target.composer ? 'correct' : 'incorrect';
  
  // Normalize strings for robust matching (lowercase and trim spaces)
  const targetActors = (target.actors || []).map(a => a.toLowerCase().trim());
  const guessActors = (guess.actors || []).map(a => a.toLowerCase().trim());
  
  const commonActors = guessActors.filter(a => targetActors.includes(a));
  
  let actorsMatch: 'correct' | 'partial' | 'incorrect' = 'incorrect';
  
  if (commonActors.length === targetActors.length && targetActors.length > 0 && guessActors.length === targetActors.length) {
    actorsMatch = 'correct';
  } else if (commonActors.length > 0) {
    actorsMatch = 'partial';
  }

  return {
    song: guess,
    yearMatch,
    movieMatch,
    actorsMatch,
    composerMatch
  };
}