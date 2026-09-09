export interface Song {
  id: number;
  title: string;
  singers: string[];
  composer: string;
  movie: string;
  actors: string[];
  year: number;
}

export type MatchStatus = "correct" | "partial" | "incorrect";

export interface GuessEvaluation {
  song: Song;
  titleMatch: boolean;
  singerStatus: MatchStatus;
  composerStatus: MatchStatus;
  movieStatus: MatchStatus;
  actorStatus: MatchStatus;
  yearStatus: MatchStatus;
  yearDirection: "higher" | "lower" | "equal";
}