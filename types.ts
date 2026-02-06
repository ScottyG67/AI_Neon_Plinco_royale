export interface Player {
  id: string;
  name: string;
  score: number | null; // null indicates still playing
  color: string;
  isCheater: boolean;
  isBot: boolean;
  isSpectator?: boolean;
  finished: boolean;
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface Bucket {
  id: number;
  label: string;
  points: number;
  x: number; // proportional 0-1
}