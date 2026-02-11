/**
 * Tests for bot ball drop functionality
 * Tests ensure bots drop balls correctly, handle multiple bots, and prevent race conditions
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Bot Drop Logic', () => {
    let mockPlayers;
    let mockDroppedBalls;
    let mockBotDropTimers;
    let mockScoreTimeoutTimers;
    let mockGamePhase;
    let mockIo;
    let mockCheckGameOver;
    let scheduleBotDrops;
    let timers;

    beforeEach(() => {
        // Reset all mocks and state
        mockPlayers = [];
        mockDroppedBalls = new Set();
        mockBotDropTimers = new Map();
        mockScoreTimeoutTimers = new Map();
        mockGamePhase = 'PLAYING';
        timers = [];

        // Mock io.emit
        mockIo = {
            emit: vi.fn()
        };

        // Mock checkGameOver
        mockCheckGameOver = vi.fn();

        // Create bot drop function with mocked dependencies
        // This simulates the scheduleBotDrops function from server.js
        scheduleBotDrops = () => {
            const LOGICAL_WIDTH = 600;
            const PLAY_BOUNDS_PADDING = 20;
            const SCORE_TIMEOUT_MS = 15000;

            const bots = mockPlayers.filter(p => p.isBot && !p.isSpectator && !p.finished);
            
            bots.forEach(bot => {
                // Skip if bot already has a drop timer scheduled
                if (mockBotDropTimers.has(bot.id)) {
                    return;
                }
                
                // Skip if bot has already dropped
                if (mockDroppedBalls.has(bot.id)) {
                    return;
                }
                
                const dropDelay = 1000 + Math.random() * 4000;
                const minX = PLAY_BOUNDS_PADDING;
                const maxX = LOGICAL_WIDTH - PLAY_BOUNDS_PADDING;
                const randomX = minX + Math.random() * (maxX - minX);
                
                const timer = setTimeout(() => {
                    const botIndex = mockPlayers.findIndex(p => p.id === bot.id);
                    if (botIndex === -1) {
                        mockBotDropTimers.delete(bot.id);
                        return;
                    }
                    
                    const currentBot = mockPlayers[botIndex];
                    
                    if (mockDroppedBalls.has(bot.id) || currentBot.finished) {
                        mockBotDropTimers.delete(bot.id);
                        return;
                    }
                    
                    if (mockGamePhase !== 'PLAYING') {
                        mockBotDropTimers.delete(bot.id);
                        return;
                    }
                    
                    mockDroppedBalls.add(bot.id);
                    
                    const botTimeoutTimer = setTimeout(() => {
                        const currentBotIndex = mockPlayers.findIndex(p => p.id === bot.id);
                        if (currentBotIndex !== -1 && !mockPlayers[currentBotIndex].finished) {
                            mockPlayers[currentBotIndex].score = 0;
                            mockPlayers[currentBotIndex].finished = true;
                        }
                        mockScoreTimeoutTimers.delete(bot.id);
                    }, SCORE_TIMEOUT_MS);
                    
                    mockScoreTimeoutTimers.set(bot.id, botTimeoutTimer);
                    mockIo.emit('spawn_ball', { x: randomX, playerId: bot.id });
                    mockBotDropTimers.delete(bot.id);
                }, dropDelay);
                
                mockBotDropTimers.set(bot.id, timer);
                timers.push(timer);
            });
        };
    });

    afterEach(() => {
        // Clear all timers
        timers.forEach(timer => clearTimeout(timer));
        timers = [];
        vi.clearAllMocks();
    });

    test('should schedule drops for all active bots', () => {
        mockPlayers = [
            { id: 'bot-1', name: 'Bot-1', isBot: true, isSpectator: false, finished: false },
            { id: 'bot-2', name: 'Bot-2', isBot: true, isSpectator: false, finished: false },
            { id: 'bot-3', name: 'Bot-3', isBot: true, isSpectator: false, finished: false }
        ];

        scheduleBotDrops();

        expect(mockBotDropTimers.size).toBe(3);
        expect(mockBotDropTimers.has('bot-1')).toBe(true);
        expect(mockBotDropTimers.has('bot-2')).toBe(true);
        expect(mockBotDropTimers.has('bot-3')).toBe(true);
    });

    test('should not schedule drops for spectators', () => {
        mockPlayers = [
            { id: 'bot-1', name: 'Bot-1', isBot: true, isSpectator: true, finished: false },
            { id: 'bot-2', name: 'Bot-2', isBot: true, isSpectator: false, finished: false }
        ];

        scheduleBotDrops();

        expect(mockBotDropTimers.size).toBe(1);
        expect(mockBotDropTimers.has('bot-2')).toBe(true);
        expect(mockBotDropTimers.has('bot-1')).toBe(false);
    });

    test('should not schedule drops for finished bots', () => {
        mockPlayers = [
            { id: 'bot-1', name: 'Bot-1', isBot: true, isSpectator: false, finished: true },
            { id: 'bot-2', name: 'Bot-2', isBot: true, isSpectator: false, finished: false }
        ];

        scheduleBotDrops();

        expect(mockBotDropTimers.size).toBe(1);
        expect(mockBotDropTimers.has('bot-2')).toBe(true);
        expect(mockBotDropTimers.has('bot-1')).toBe(false);
    });

    test('should not schedule duplicate drops for the same bot', () => {
        mockPlayers = [
            { id: 'bot-1', name: 'Bot-1', isBot: true, isSpectator: false, finished: false }
        ];

        scheduleBotDrops();
        expect(mockBotDropTimers.size).toBe(1);

        // Try to schedule again
        scheduleBotDrops();
        expect(mockBotDropTimers.size).toBe(1); // Should still be 1, not 2
    });

    test('should not schedule drops for bots that already dropped', () => {
        mockPlayers = [
            { id: 'bot-1', name: 'Bot-1', isBot: true, isSpectator: false, finished: false }
        ];

        mockDroppedBalls.add('bot-1');
        scheduleBotDrops();

        expect(mockBotDropTimers.size).toBe(0);
    });

    test('should emit spawn_ball event when bot drops', (done) => {
        mockPlayers = [
            { id: 'bot-1', name: 'Bot-1', isBot: true, isSpectator: false, finished: false }
        ];

        scheduleBotDrops();

        // Wait for the drop to happen (max 5 seconds)
        setTimeout(() => {
            expect(mockIo.emit).toHaveBeenCalledWith('spawn_ball', expect.objectContaining({
                playerId: 'bot-1',
                x: expect.any(Number)
            }));
            expect(mockDroppedBalls.has('bot-1')).toBe(true);
            done();
        }, 6000);
    });

    test('should handle multiple bots dropping at different times', (done) => {
        mockPlayers = [
            { id: 'bot-1', name: 'Bot-1', isBot: true, isSpectator: false, finished: false },
            { id: 'bot-2', name: 'Bot-2', isBot: true, isSpectator: false, finished: false },
            { id: 'bot-3', name: 'Bot-3', isBot: true, isSpectator: false, finished: false }
        ];

        scheduleBotDrops();

        // Wait for all drops (max 5 seconds + buffer)
        setTimeout(() => {
            expect(mockIo.emit).toHaveBeenCalledTimes(3);
            expect(mockDroppedBalls.size).toBe(3);
            done();
        }, 6000);
    });

    test('should not drop if bot is removed before timer fires', (done) => {
        mockPlayers = [
            { id: 'bot-1', name: 'Bot-1', isBot: true, isSpectator: false, finished: false }
        ];

        scheduleBotDrops();

        // Remove bot before drop happens
        setTimeout(() => {
            mockPlayers = [];
        }, 500);

        // Wait for drop time
        setTimeout(() => {
            expect(mockIo.emit).not.toHaveBeenCalled();
            done();
        }, 2000);
    });

    test('should not drop if game phase changes before timer fires', (done) => {
        mockPlayers = [
            { id: 'bot-1', name: 'Bot-1', isBot: true, isSpectator: false, finished: false }
        ];

        scheduleBotDrops();

        // Change game phase
        setTimeout(() => {
            mockGamePhase = 'GAME_OVER';
        }, 500);

        // Wait for drop time
        setTimeout(() => {
            expect(mockIo.emit).not.toHaveBeenCalled();
            done();
        }, 2000);
    });

    test('should set score timeout timer when bot drops', (done) => {
        mockPlayers = [
            { id: 'bot-1', name: 'Bot-1', isBot: true, isSpectator: false, finished: false }
        ];

        scheduleBotDrops();

        setTimeout(() => {
            expect(mockScoreTimeoutTimers.has('bot-1')).toBe(true);
            done();
        }, 2000);
    });
});
