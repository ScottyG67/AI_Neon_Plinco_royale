# Socket Connection Fix

## Problem
Socket connections were connecting and immediately disconnecting in a loop, creating new connections repeatedly.

## Root Causes
1. **React StrictMode**: In development, React StrictMode mounts components twice, causing socket cleanup and recreation
2. **Hot Module Reloading (HMR)**: Module-level variables get reset during HMR, causing new sockets to be created
3. **Event Listener Management**: Event listeners were being removed and re-added incorrectly, causing connection issues

## Solution
1. **Window-based Singleton**: Store socket in `window.__plinkoSocket` to survive HMR
2. **Listener Flag**: Use `window.__plinkoListenersAttached` to prevent duplicate listeners
3. **Proper State Management**: Check socket state before creating new connections
4. **Enhanced Logging**: Added detailed logging to track connection lifecycle

## How to Validate

### Check Browser Console
Open browser DevTools and look for these log patterns:

**Good (Fixed):**
```
[App] Creating new socket connection...
[App] ✅ Socket connected with ID: abc123
[App] Setting up socket listeners. Connected: true
[App] Attaching socket event listeners...
[App] Socket listeners already attached, skipping...
```

**Bad (Still Broken):**
```
[App] Creating new socket connection...
[App] ✅ Socket connected with ID: abc123
[App] ❌ Socket disconnected. Reason: ...
[App] Creating new socket connection...
[App] ✅ Socket connected with ID: xyz789
[App] ❌ Socket disconnected. Reason: ...
```

### Check Server Logs
Run server and watch for connection patterns:

**Good (Fixed):**
```
[Socket] User connected: abc123
(no immediate disconnect)
```

**Bad (Still Broken):**
```
[Socket] User connected: abc123
[Socket] User disconnected: abc123
[Socket] User connected: xyz789
[Socket] User disconnected: xyz789
```

## Testing Steps
1. Start the server: `npm run dev`
2. Open browser to `http://localhost:8080`
3. Open DevTools Console (F12)
4. Watch for socket connection logs
5. Should see ONE connection that stays connected
6. Check server logs - should see ONE connection that doesn't immediately disconnect

## Expected Behavior
- Socket connects once on page load
- Stays connected during React StrictMode remounts
- Survives hot module reloads (HMR)
- Only disconnects on actual page unload/navigation
