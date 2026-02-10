import protobuf from 'protobufjs';
import path from 'path';
import { Player, GamePhase } from '../types';

let root: protobuf.Root | null = null;

// Load proto schema
async function loadProto() {
  if (root) return root;
  
  const protoPath = path.join(__dirname, '../proto/game.proto');
  root = await protobuf.load(protoPath);
  return root;
}

// Helper to convert hex color string to packed int32
function colorToInt(color: string): number {
  // Remove # if present
  const hex = color.replace('#', '');
  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Pack as 0xRRGGBB
  return (r << 16) | (g << 8) | b;
}

// Helper to convert packed int32 to hex color string
function intToColor(colorInt: number): string {
  const r = (colorInt >> 16) & 0xFF;
  const g = (colorInt >> 8) & 0xFF;
  const b = colorInt & 0xFF;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Convert Player to protobuf Player message
function playerToProto(player: Player): any {
  return {
    id: player.id,
    name: player.name,
    color: colorToInt(player.color),
    score: player.score === null ? -1 : player.score,
    isCheater: player.isCheater,
    isBot: player.isBot,
    isSpectator: player.isSpectator || false,
    finished: player.finished
  };
}

// Convert protobuf Player message to Player
function protoToPlayer(protoPlayer: any): Player {
  return {
    id: protoPlayer.id,
    name: protoPlayer.name,
    color: intToColor(protoPlayer.color),
    score: protoPlayer.score === -1 ? null : protoPlayer.score,
    isCheater: protoPlayer.isCheater,
    isBot: protoPlayer.isBot,
    isSpectator: protoPlayer.isSpectator,
    finished: protoPlayer.finished
  };
}

// Serialize game state
export async function serializeGameState(players: Player[], phase: GamePhase): Promise<Buffer> {
  const protoRoot = await loadProto();
  const GameState = protoRoot.lookupType('game.GameState');
  
  const gamePhaseMap: Record<string, number> = {
    'LOBBY': 0,
    'PLAYING': 1,
    'GAME_OVER': 2
  };
  
  const message = {
    players: players.map(playerToProto),
    phase: gamePhaseMap[phase] || 0
  };
  
  const errMsg = GameState.verify(message);
  if (errMsg) throw Error(errMsg);
  
  const buffer = GameState.encode(message).finish();
  return Buffer.from(buffer);
}

// Deserialize game state
export async function deserializeGameState(buffer: Buffer): Promise<{ players: Player[]; phase: GamePhase }> {
  const protoRoot = await loadProto();
  const GameState = protoRoot.lookupType('game.GameState');
  
  const message = GameState.decode(buffer);
  const gamePhaseMap: Record<number, GamePhase> = {
    0: GamePhase.LOBBY,
    1: GamePhase.PLAYING,
    2: GamePhase.GAME_OVER
  };
  
  return {
    players: message.players.map(protoToPlayer),
    phase: gamePhaseMap[message.phase] || GamePhase.LOBBY
  };
}

// Serialize ball spawn
export async function serializeBallSpawn(playerId: string, x: number): Promise<Buffer> {
  const protoRoot = await loadProto();
  const BallSpawn = protoRoot.lookupType('game.BallSpawn');
  
  const message = { playerId, x };
  const errMsg = BallSpawn.verify(message);
  if (errMsg) throw Error(errMsg);
  
  const buffer = BallSpawn.encode(message).finish();
  return Buffer.from(buffer);
}

// Deserialize ball spawn
export async function deserializeBallSpawn(buffer: Buffer): Promise<{ playerId: string; x: number }> {
  const protoRoot = await loadProto();
  const BallSpawn = protoRoot.lookupType('game.BallSpawn');
  
  const message = BallSpawn.decode(buffer);
  return {
    playerId: message.playerId,
    x: message.x
  };
}

// Serialize laser data
export async function serializeLaserData(data: { x1: number; y1: number; x2: number; y2: number; color: string }): Promise<Buffer> {
  const protoRoot = await loadProto();
  const LaserData = protoRoot.lookupType('game.LaserData');
  
  const message = {
    x1: data.x1,
    y1: data.y1,
    x2: data.x2,
    y2: data.y2,
    color: colorToInt(data.color)
  };
  
  const errMsg = LaserData.verify(message);
  if (errMsg) throw Error(errMsg);
  
  const buffer = LaserData.encode(message).finish();
  return Buffer.from(buffer);
}

// Deserialize laser data
export async function deserializeLaserData(buffer: Buffer): Promise<{ x1: number; y1: number; x2: number; y2: number; color: string }> {
  const protoRoot = await loadProto();
  const LaserData = protoRoot.lookupType('game.LaserData');
  
  const message = LaserData.decode(buffer);
  return {
    x1: message.x1,
    y1: message.y1,
    x2: message.x2,
    y2: message.y2,
    color: intToColor(message.color)
  };
}

// Serialize ball removed
export async function serializeBallRemoved(ballId: string): Promise<Buffer> {
  const protoRoot = await loadProto();
  const BallRemoved = protoRoot.lookupType('game.BallRemoved');
  
  const message = { ballId };
  const errMsg = BallRemoved.verify(message);
  if (errMsg) throw Error(errMsg);
  
  const buffer = BallRemoved.encode(message).finish();
  return Buffer.from(buffer);
}

// Deserialize ball removed
export async function deserializeBallRemoved(buffer: Buffer): Promise<{ ballId: string }> {
  const protoRoot = await loadProto();
  const BallRemoved = protoRoot.lookupType('game.BallRemoved');
  
  const message = BallRemoved.decode(buffer);
  return { ballId: message.ballId };
}
