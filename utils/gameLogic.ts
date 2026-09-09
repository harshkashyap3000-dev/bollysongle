import { Song, GuessEvaluation, MatchStatus } from "../types/game";
import songsData from "../data/songs.json";

export const allSongs: Song[] = songsData;

export function getDailyMysterySong(): Song {
  const epoch = new Date(2024, 0, 1).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayIndex = Math.floor((today - epoch) / (1000 * 60 * 60 * 24));
  return allSongs[Math.abs(dayIndex) % allSongs.length];
}

function evaluateArrayMatch(guessed: string[], target: string[]): MatchStatus {
  const gNorm = guessed.map((s) => s.toLowerCase().trim());
  const tNorm = target.map((s) => s.toLowerCase().trim());
  const matchingCount = gNorm.filter((item) => tNorm.includes(item)).length;

  if (matchingCount === tNorm.length && gNorm.length === tNorm.length) return "correct";
  if (matchingCount > 0) return "partial";
  return "incorrect";
}

function evaluateStringMatch(guessed: string, target: string): MatchStatus {
  return guessed.toLowerCase().trim() === target.toLowerCase().trim() ? "correct" : "incorrect";
}

export function evaluateGuess(guessedSong: Song, mysterySong: Song): GuessEvaluation {
  const titleMatch = guessedSong.id === mysterySong.id;
  
  let yearStatus: MatchStatus = "incorrect";
  let yearDirection: "higher" | "lower" | "equal" = "equal";

  if (guessedSong.year === mysterySong.year) {
    yearStatus = "correct";
  } else if (guessedSong.year < mysterySong.year) {
    yearDirection = "higher"; 
  } else {
    yearDirection = "lower"; 
  }

  return {
    song: guessedSong,
    titleMatch,
    singerStatus: evaluateArrayMatch(guessedSong.singers, mysterySong.singers),
    composerStatus: evaluateStringMatch(guessedSong.composer, mysterySong.composer),
    movieStatus: evaluateStringMatch(guessedSong.movie, mysterySong.movie),
    actorStatus: evaluateArrayMatch(guessedSong.actors, mysterySong.actors),
    yearStatus,
    yearDirection,
  };
}