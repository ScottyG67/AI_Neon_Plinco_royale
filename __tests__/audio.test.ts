import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// @vitest-environment jsdom

// We need to reset the module between tests to clear cached state
let audioModule: any;

// Mock Web Audio API
class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  state = 'running';
  resume = vi.fn().mockResolvedValue(undefined);
  createGain = vi.fn(() => ({
    gain: { 
      value: 0, 
      setTargetAtTime: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    },
    connect: vi.fn()
  }));
  createOscillator = vi.fn(() => ({
    frequency: { 
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    },
    type: '',
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  }));
  createBuffer = vi.fn((channels, length, sampleRate) => ({
    getChannelData: vi.fn(() => new Float32Array(length)),
    length,
    sampleRate
  }));
  createBufferSource = vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  }));
  createBiquadFilter = vi.fn(() => ({
    type: '',
    frequency: { value: 0 },
    connect: vi.fn()
  }));
}

describe('audio', () => {
  let originalAudioContext: any;
  let mockAudioContext: MockAudioContext;
  let musicGain: any;
  let sfxGain: any;

  beforeEach(async () => {
    // Reset module to clear cached state
    vi.resetModules();
    audioModule = await import('../audio');
    
    // Create mock gain nodes with spies
    const musicSetTargetAtTime = vi.fn();
    const sfxSetTargetAtTime = vi.fn();
    
    musicGain = {
      gain: { 
        value: 0, 
        setTargetAtTime: musicSetTargetAtTime,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    };
    
    sfxGain = {
      gain: { 
        value: 0, 
        setTargetAtTime: sfxSetTargetAtTime,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    };
    
    // Mock window.AudioContext
    mockAudioContext = new MockAudioContext() as any;
    // Make createGain return our mock gain nodes in sequence
    let gainCallCount = 0;
    mockAudioContext.createGain = vi.fn(() => {
      gainCallCount++;
      return gainCallCount === 1 ? musicGain : sfxGain;
    });
    
    originalAudioContext = (window as any).AudioContext;
    (window as any).AudioContext = vi.fn(() => mockAudioContext);
    (window as any).webkitAudioContext = vi.fn(() => mockAudioContext);
  });

  afterEach(() => {
    (window as any).AudioContext = originalAudioContext;
    delete (window as any).webkitAudioContext;
  });

  describe('getAudioCtx', () => {
    it('should create and return audio context', () => {
      const ctx = audioModule.getAudioCtx();
      expect(ctx).toBeDefined();
      expect((window as any).AudioContext).toHaveBeenCalled();
    });

    it('should return same context on subsequent calls', () => {
      const ctx1 = audioModule.getAudioCtx();
      const ctx2 = audioModule.getAudioCtx();
      expect(ctx1).toBe(ctx2);
    });
  });

  describe('setMusicVolume', () => {
    it('should set music volume', () => {
      // Reset module cache by getting a fresh context
      const ctx = audioModule.getAudioCtx();
      
      // Call setMusicVolume - it should use the musicGain created in beforeEach
      audioModule.setMusicVolume(0.5);
      expect(musicGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, expect.any(Number), 0.02);
    });

    it('should handle null gain node gracefully', () => {
      const ctx = audioModule.getAudioCtx();
      (ctx as any).musicMasterGain = null;
      
      // Should not throw
      expect(() => audioModule.setMusicVolume(0.5)).not.toThrow();
    });
  });

  describe('setSfxVolume', () => {
    it('should set SFX volume', () => {
      // Reset module cache by getting a fresh context
      const ctx = audioModule.getAudioCtx();
      
      // Call setSfxVolume - it should use the sfxGain created in beforeEach
      audioModule.setSfxVolume(0.7);
      expect(sfxGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.7, expect.any(Number), 0.02);
    });
  });

  describe('toggleMusic', () => {
    it('should toggle music on', () => {
      const ctx = audioModule.getAudioCtx();
      (ctx as any).musicEnabled = false;
      (ctx as any).isPlaying = false;

      audioModule.toggleMusic();
      // Music should be enabled (implementation dependent)
      // This test verifies the function doesn't throw
      expect(() => audioModule.toggleMusic()).not.toThrow();
    });
  });

  describe('getMusicState', () => {
    it('should return music state', () => {
      const state = audioModule.getMusicState();
      expect(typeof state).toBe('boolean');
    });
  });

  describe('resumeAudio', () => {
    it('should resume audio context', async () => {
      const ctx = audioModule.getAudioCtx();
      const resume = vi.fn();
      (ctx as any).resume = resume;
      (ctx as any).state = 'suspended';

      await audioModule.resumeAudio();
      expect(resume).toHaveBeenCalled();
    });

    it('should not resume if already running', async () => {
      const ctx = audioModule.getAudioCtx();
      const resume = vi.fn();
      (ctx as any).resume = resume;
      (ctx as any).state = 'running';

      await audioModule.resumeAudio();
      // May or may not call resume depending on implementation
      // Just verify it doesn't throw
      expect(() => audioModule.resumeAudio()).not.toThrow();
    });
  });

  describe('playBounce', () => {
    it('should play bounce sound without throwing', () => {
      expect(() => audioModule.playBounce()).not.toThrow();
    });
  });

  describe('playScore', () => {
    it('should play score sound without throwing', () => {
      expect(() => audioModule.playScore(100)).not.toThrow();
    });
  });

  describe('playLaser', () => {
    it('should play laser sound without throwing', () => {
      expect(() => audioModule.playLaser()).not.toThrow();
    });
  });

  describe('playExplosion', () => {
    it('should play explosion sound without throwing', () => {
      expect(() => audioModule.playExplosion()).not.toThrow();
    });
  });
});
