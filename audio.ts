// Web Audio API Context Management
const getAudioContextClass = () => {
  return (window.AudioContext || (window as any).webkitAudioContext);
};
let audioCtx: AudioContext | null = null;
let musicMasterGain: GainNode | null = null;
let sfxMasterGain: GainNode | null = null;

let musicEnabled = false;
let isPlaying = false;
let nextNoteTime = 0.0;
let currentStep = 0;
let timerID: number | undefined;

// Synthwave Track Config
const TEMPO = 115;
const SECONDS_PER_BEAT = 60.0 / TEMPO;
const NOTE_LEN = SECONDS_PER_BEAT / 4; // 16th notes
const SEQUENCE_LENGTH = 64; // 4 bars of 16th notes

export const getAudioCtx = () => {
  if (!audioCtx) {
    const AudioContextClass = getAudioContextClass();
    audioCtx = new AudioContextClass();
    
    // Create Master Channels
    musicMasterGain = audioCtx.createGain();
    musicMasterGain.gain.value = 0.4; // Default music volume
    musicMasterGain.connect(audioCtx.destination);

    sfxMasterGain = audioCtx.createGain();
    sfxMasterGain.gain.value = 0.6; // Default SFX volume
    sfxMasterGain.connect(audioCtx.destination);
  }
  return audioCtx;
};

const getMusicDest = () => {
    getAudioCtx();
    return musicMasterGain!;
};

const getSfxDest = () => {
    getAudioCtx();
    return sfxMasterGain!;
};

export const setMusicVolume = (vol: number) => {
    const ctx = getAudioCtx();
    if (musicMasterGain) {
        // Smooth transition
        musicMasterGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
    }
};

export const setSfxVolume = (vol: number) => {
    const ctx = getAudioCtx();
    if (sfxMasterGain) {
        sfxMasterGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
    }
};

export const resumeAudio = () => {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
};

// --- Sound Synthesis Helpers ---

const createNoiseBuffer = (ctx: AudioContext) => {
    const bufferSize = ctx.sampleRate * 2.0; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
};

let noiseBuffer: AudioBuffer | null = null;

const getNoiseBuffer = (ctx: AudioContext) => {
    if (!noiseBuffer) {
        noiseBuffer = createNoiseBuffer(ctx);
    }
    return noiseBuffer;
};

// --- Music Instruments ---

const playKick = (ctx: AudioContext, time: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    osc.connect(gain);
    gain.connect(getMusicDest()); // Route to Music Bus
    
    osc.start(time);
    osc.stop(time + 0.5);
};

const playSnare = (ctx: AudioContext, time: number) => {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(getMusicDest()); // Route to Music Bus
    
    // Add "body" to snare
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(250, time);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    
    osc.connect(oscGain);
    oscGain.connect(getMusicDest()); // Route to Music Bus

    noise.start(time);
    osc.start(time);
    noise.stop(time + 0.2);
    osc.stop(time + 0.2);
};

const playHiHat = (ctx: AudioContext, time: number, open: boolean = false) => {
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;
    
    const gain = ctx.createGain();
    const vol = open ? 0.2 : 0.1;
    const dur = open ? 0.2 : 0.05;

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(getMusicDest()); // Route to Music Bus
    
    source.start(time);
    source.stop(time + dur);
};

const playBass = (ctx: AudioContext, time: number, freq: number) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + 0.1); // Pluck effect
    filter.Q.value = 5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2); // Short decay for running bass

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(getMusicDest()); // Route to Music Bus
    
    osc.start(time);
    osc.stop(time + 0.25);
};

// --- Sequencer Logic ---

const scheduleNote = (step: number, time: number) => {
    const ctx = getAudioCtx();
    
    // Drums (Simple 4/4)
    // Kick: 0, 4, 8, 12 (every beat)
    if (step % 4 === 0) {
        playKick(ctx, time);
    }
    // Snare: 4, 12 (backbeat)
    if (step % 16 === 4 || step % 16 === 12) {
        playSnare(ctx, time);
    }
    // HiHats: Every odd note (off-beat)
    if (step % 2 !== 0) {
        playHiHat(ctx, time);
    }

    // Synthwave Bassline (Running 16th notes)
    // Progression: Dm (2 bars) -> Bb (1 bar) -> C (1 bar)
    
    let freq = 73.42; // D2
    const bar = Math.floor(step / 16);
    
    if (bar === 0 || bar === 1) freq = 73.42; // D2
    else if (bar === 2) freq = 58.27; // Bb1
    else if (bar === 3) {
        // Split last bar? C2 then A1
        if (step % 16 < 8) freq = 65.41; // C2
        else freq = 55.00; // A1
    }
    
    playBass(ctx, time, freq);
};

const scheduler = () => {
    const ctx = getAudioCtx();
    // Schedule ahead
    const lookahead = 0.1; // seconds
    
    while (nextNoteTime < ctx.currentTime + lookahead) {
        scheduleNote(currentStep, nextNoteTime);
        nextNoteTime += NOTE_LEN;
        currentStep++;
        if (currentStep >= SEQUENCE_LENGTH) {
            currentStep = 0;
        }
    }
    
    if (isPlaying) {
        timerID = window.setTimeout(scheduler, 25);
    }
};

export const toggleMusic = () => {
    const ctx = getAudioCtx();
    musicEnabled = !musicEnabled;
    
    if (musicEnabled) {
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        isPlaying = true;
        currentStep = 0;
        nextNoteTime = ctx.currentTime + 0.1;
        scheduler();
    } else {
        isPlaying = false;
        if (timerID) clearTimeout(timerID);
    }
    return musicEnabled;
};

export const getMusicState = () => musicEnabled;


// --- Existing SFX Functions ---

export const playBounce = () => {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Metallic/Synth ping
  osc.type = 'triangle';
  // Randomize pitch slightly to prevent machine-gun effect
  osc.frequency.setValueAtTime(600 + Math.random() * 100, t);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
  
  gain.gain.setValueAtTime(0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

  osc.connect(gain);
  gain.connect(getSfxDest()); // Route to SFX Bus
  osc.start(t);
  osc.stop(t + 0.1);
};

export const playScore = (points: number) => {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  
  // Pitch maps to points (Pentatonic scale-ish)
  let freq = 440; // Default
  if (points === 10) freq = 261.63; // C4
  else if (points === 25) freq = 329.63; // E4
  else if (points === 50) freq = 392.00; // G4
  else if (points === 100) freq = 523.25; // C5

  osc.frequency.setValueAtTime(freq, t);
  
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

  osc.connect(gain);
  gain.connect(getSfxDest()); // Route to SFX Bus
  osc.start(t);
  osc.stop(t + 0.8);
};

export const playLaser = () => {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Classic Sci-Fi Pew
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.2);
  
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.2);

  osc.connect(gain);
  gain.connect(getSfxDest()); // Route to SFX Bus
  osc.start(t);
  osc.stop(t + 0.2);
};

export const playExplosion = () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.5; // 0.5 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // White noise generation
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Filter to make it sound more like an explosion and less like static
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(getSfxDest()); // Route to SFX Bus
    noise.start(t);
};

export const playPartyKazoo = () => {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  
  // Melody: C E G C (Major Arpeggio)
  const notes = [261.63, 329.63, 392.00, 523.25];
  const duration = 0.2;

  notes.forEach((freq, i) => {
      const startTime = t + (i * duration);
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Kazoo-ish sound: Sawtooth with Vibrato
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);

      // Vibrato
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 15; // Fast wobble
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 10;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(startTime);
      lfo.stop(startTime + duration);

      // Envelope
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);

      osc.connect(gain);
      gain.connect(getSfxDest()); // Route to SFX Bus
      osc.start(startTime);
      osc.stop(startTime + duration);
  });
};