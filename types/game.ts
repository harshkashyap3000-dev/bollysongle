export interface Song {
  id: string | number;
  title: string;
  movie: string;
  year: number;
  actors: string[];
  singers: string[];
  composer: string;
}

export interface GuessResult {
  song: Song;
  yearMatch: 'correct' | 'higher' | 'lower';
  movieMatch: 'correct' | 'incorrect';
  actorsMatch: 'correct' | 'partial' | 'incorrect';
  composerMatch: 'correct' | 'incorrect';
}