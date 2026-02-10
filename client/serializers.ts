import protobuf from 'protobufjs';
import { Player, GamePhase } from '../types';

let root: protobuf.Root | null = null;

// Load proto schema
async function loadProto() {
  if (root) return root;
  
  // In browser, try to load from JSON first (generated), then fallback to proto file
  try {
    // Try loading from generated JSON (if bundled)
    const jsonResponse = await fetch('/generated/game.proto.json');
    if (jsonResponse.ok) {
      const json = await jsonResponse.json();
      root = protobuf.Root.fromJSON(json);
      return root;
    }
  } catch (e) {
    // Fallback to proto file
  }
  
  try {
    // Fallback: load proto file directly (needs to be served)
    root = await protobuf.load('/proto/game.proto');
  } catch (e) {
    console.error('Could not load proto schema. Make sure proto/game.proto is served or generated/game.proto.json is available.');
    throw e;
  }
  
  return root;
}

// Helper to convert hex color string to packed int32
function colorToInt(color: string): number {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
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
export async function serializeGameState(players: Player[], phase: GamePhase): Promise<Uint8Array> {
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
  
  return GameState.encode(message).finish();
}

// Deserialize game state
export async function deserializeGameState(buffer: Uint8Array | ArrayBuffer): Promise<{ players: Player[]; phase: GamePhase }> {
  const protoRoot = await loadProto();
  const GameState = protoRoot.lookupType('game.GameState');
  
  const uint8Array = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const message = GameState.decode(uint8Array);
  
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
export async function serializeBallSpawn(playerId: string, x: number): Promise<Uint8Array> {
  const protoRoot = await loadProto();
  const BallSpawn = protoRoot.lookupType('game.BallSpawn');
  
  const message = { playerId, x };
  const errMsg = BallSpawn.verify(message);
  if (errMsg) throw Error(errMsg);
  
  return BallSpawn.encode(message).finish();
}

// Deserialize ball spawn
export async function deserializeBallSpawn(buffer: Uint8Array | ArrayBuffer): Promise<{ playerId: string; x: number }> {
  const protoRoot = await loadProto();
  const BallSpawn = protoRoot.lookupType('game.BallSpawn');
  
  const uint8Array = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const message = BallSpawn.decode(uint8Array);
  
  return {
    playerId: message.playerId,
    x: message.x
  };
}

// Serialize laser data
export async function serializeLaserData(data: { x1: number; y1: number; x2: number; y2: number; color: string }): Promise<Uint8Array> {
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
  
  return LaserData.encode(message).finish();
}

// Deserialize laser data
export async function deserializeLaserData(buffer: Uint8Array | ArrayBuffer): Promise<{ x1: number; y1: number; x2: number; y2: number; color: string }> {
  const protoRoot = await loadProto();
  const LaserData = protoRoot.lookupType('game.LaserData');
  
  const uint8Array = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const message = LaserData.decode(uint8Array);
  
  return {
    x1: message.x1,
    y1: message.y1,
    x2: message.x2,
    y2: message.y2,
    color: intToColor(message.color)
  };
}

// Serialize ball removed
export async function serializeBallRemoved(ballId: string): Promise<Uint8Array> {
  const protoRoot = await loadProto();
  const BallRemoved = protoRoot.lookupType('game.BallRemoved');
  
  const message = { ballId };
  const errMsg = BallRemoved.verify(message);
  if (errMsg) throw Error(errMsg);
  
  return BallRemoved.encode(message).finish();
}

// Deserialize ball removed
export async function deserializeBallRemoved(buffer: Uint8Array | ArrayBuffer): Promise<{ ballId: string }> {
  const protoRoot = await loadProto();
  const BallRemoved = protoRoot.lookupType('game.BallRemoved');
  
  const uint8Array = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const message = BallRemoved.decode(uint8Array);
  
  return { ballId: message.ballId };
}
