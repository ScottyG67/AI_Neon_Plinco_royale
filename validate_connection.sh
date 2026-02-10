#!/bin/bash

echo "=== Socket Connection Validation ==="
echo ""
echo "Monitoring server logs for connection stability..."
echo "Press Ctrl+C to stop"
echo ""

LOG_FILE="/tmp/server_output.log"
LAST_LINE=""

while true; do
    CURRENT_LINE=$(tail -1 "$LOG_FILE" 2>/dev/null)
    
    if [ "$CURRENT_LINE" != "$LAST_LINE" ] && [ -n "$CURRENT_LINE" ]; then
        if echo "$CURRENT_LINE" | grep -q "\[Socket\]"; then
            echo "[$(date +%H:%M:%S)] $CURRENT_LINE"
            
            # Check for connection loop
            CONNECTS=$(tail -100 "$LOG_FILE" | grep -c "User connected")
            DISCONNECTS=$(tail -100 "$LOG_FILE" | grep -c "User disconnected")
            
            if [ "$CONNECTS" -gt 5 ] || [ "$DISCONNECTS" -gt 3 ]; then
                echo "⚠️  WARNING: Possible connection loop detected!"
                echo "   Connects: $CONNECTS, Disconnects: $DISCONNECTS"
            fi
        fi
        LAST_LINE="$CURRENT_LINE"
    fi
    
    sleep 1
done
