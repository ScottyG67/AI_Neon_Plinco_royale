import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Player } from '../types';
import { Button } from './Button';
import { Trophy } from 'lucide-react';
import { playPartyKazoo } from '../audio';

interface WinnerToastProps {
  winner: Player | null;
  onPlayAgain: () => void;
}

export const WinnerToast: React.FC<WinnerToastProps> = ({ winner, onPlayAgain }) => {
  useEffect(() => {
    if (winner) {
      playPartyKazoo(); // Sound Effect

      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#ff00ff', '#00ffff', '#ffff00']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#ff00ff', '#00ffff', '#ffff00']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    }
  }, [winner]);

  if (!winner) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-4 border-fuchsia-500 p-12 rounded-xl shadow-[0_0_50px_rgba(255,0,255,0.5)] flex flex-col items-center text-center max-w-lg mx-4">
        <Trophy className="w-24 h-24 text-yellow-400 mb-6 drop-shadow-[0_0_15px_rgba(255,255,0,0.8)]" />
        
        <h2 className="text-4xl font-display font-bold text-white mb-2 uppercase tracking-widest">
          Winner
        </h2>
        
        <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500 mb-6 neon-text-pink">
          {winner.name}
        </div>
        
        <p className="text-2xl text-cyan-300 font-mono mb-8">
          Score: {winner.score}
        </p>
        
        <Button onClick={onPlayAgain} className="w-full text-xl">
          Play Again
        </Button>
      </div>
    </div>
  );
};