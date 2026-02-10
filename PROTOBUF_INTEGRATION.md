# Protobuf Integration Guide

## Overview
Protobuf serialization has been implemented to reduce network traffic. The implementation includes:
- Proto schema definitions in `proto/game.proto`
- Server-side serializers in `server/serializers.ts`
- Client-side serializers in `client/serializers.ts`
- Delta compression utilities in `server/stateDiff.ts` and `client/stateSync.ts`

## Integration Steps

### Server-side (server.js)

1. **Enable protobuf mode** (add feature flag):
```javascript
const USE_PROTOBUF = process.env.USE_PROTOBUF === 'true';
```

2. **Import serializers** (requires TypeScript compilation or JS conversion):
```javascript
// Note: May need to compile TS to JS or use ts-node
const { serializeGameState, serializeBallSpawn, serializeLaserData, serializeBallRemoved } = require('./server/serializers');
const { computeStateDelta } = require('./server/stateDiff');
```

3. **Track previous state for delta compression**:
```javascript
let previousGameState = { players: [], phase: 'LOBBY' };
```

4. **Update socket emits to use protobuf**:
```javascript
// Instead of:
io.emit('state_update', { players, phase: gamePhase });

// Use:
if (USE_PROTOBUF) {
    const currentState = { players, phase: gamePhase };
    const delta = computeStateDelta(previousGameState, currentState);
    const buffer = await serializeGameState(delta.players, delta.phase);
    io.emit('state_update', buffer);
    previousGameState = currentState;
} else {
    io.emit('state_update', { players, phase: gamePhase });
}
```

### Client-side (App.tsx, PlinkoScene.tsx)

1. **Add feature flag**:
```typescript
const USE_PROTOBUF = (window as any).USE_PROTOBUF === 'true' || false;
```

2. **Import serializers**:
```typescript
import { deserializeGameState, deserializeBallSpawn, deserializeLaserData, deserializeBallRemoved } from './client/serializers';
import { applyStateDelta } from './client/stateSync';
```

3. **Update socket listeners**:
```typescript
socket.on('state_update', async (data: any) => {
    if (USE_PROTOBUF && data instanceof ArrayBuffer) {
        const delta = await deserializeGameState(data);
        const newState = applyStateDelta(previousState, delta);
        setPlayers(newState.players);
        setPhase(newState.phase);
        previousState = newState;
    } else {
        // Fallback to JSON
        setPlayers(data.players);
        setPhase(data.phase);
    }
});
```

## Building TypeScript for Server

Since server.js is CommonJS, you have two options:

1. **Compile TypeScript to JavaScript**:
```bash
tsc server/serializers.ts --outDir dist/server --module commonjs
```

2. **Use ts-node** (for development):
```bash
npm install --save-dev ts-node
# Then run: npx ts-node server.js
```

3. **Convert to JavaScript manually** (simpler for small files)

## Testing

1. Enable protobuf on server: `USE_PROTOBUF=true npm run dev`
2. Enable protobuf on client: Set `window.USE_PROTOBUF = true` in browser console
3. Monitor network traffic to verify size reduction
4. Test all game features to ensure compatibility

## Expected Improvements

- **Message size**: 50-70% reduction vs JSON
- **Bandwidth**: Significant savings for `state_update` with many players
- **Latency**: Slightly reduced due to smaller payloads

## Backward Compatibility

The implementation maintains backward compatibility:
- Server can send JSON or protobuf based on feature flag
- Client can receive and decode both formats
- Gradual migration path: enable for new clients first, then all clients
