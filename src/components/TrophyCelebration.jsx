'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Award, RefreshCw, Star, ShieldCheck } from 'lucide-react';
import { soundFx } from '../services/audioService';

export default function TrophyCelebration({ standings, onRestartGame }) {
  const champion = standings[0];

  useEffect(() => {
    soundFx.playGoalFanfare();

    // Launch Confetti
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#f59e0b', '#22d3ee', '#10b981']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#f59e0b', '#22d3ee', '#10b981']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 text-center">
      {/* Trophy Glow Icon */}
      <div className="relative inline-block mb-6">
        <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-2xl animate-pulse" />
        <div className="relative w-28 h-28 mx-auto bg-gradient-to-br from-amber-400 to-yellow-600 rounded-3xl flex items-center justify-center shadow-glow-gold">
          <Trophy className="w-16 h-16 text-black" />
        </div>
      </div>

      <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight mb-2">
        GRAND CHAMPIONS!
      </h1>
      <div className="text-2xl font-extrabold text-amber-400 mb-8 flex items-center justify-center gap-2">
        <span>{champion?.crest}</span>
        <span>{champion?.name}</span>
      </div>

      {/* Standings Table */}
      <div className="glass-panel p-6 rounded-3xl mb-8 border border-white/10 text-left">
        <h3 className="text-sm font-extrabold text-slate-400 mb-4 uppercase tracking-wider">
          FINAL TOURNAMENT STANDINGS
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm font-semibold">
            <thead>
              <tr className="text-slate-400 border-b border-white/10 text-left">
                <th className="pb-3 pl-2">RANK</th>
                <th className="pb-3">MANAGER</th>
                <th className="pb-3 text-center">PTS</th>
                <th className="pb-3 text-center">GF</th>
                <th className="pb-3 text-center">GA</th>
                <th className="pb-3 text-center">GD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {standings.map((row, idx) => (
                <tr key={idx} className={idx === 0 ? 'bg-amber-500/10 text-amber-300 font-extrabold' : 'text-slate-200'}>
                  <td className="py-3 pl-2 font-black">#{idx + 1}</td>
                  <td className="py-3 flex items-center gap-2">
                    <span className="text-xl">{row.crest}</span>
                    <span>{row.name}</span>
                  </td>
                  <td className="py-3 text-center text-amber-400 font-black">{row.points}</td>
                  <td className="py-3 text-center">{row.gf}</td>
                  <td className="py-3 text-center">{row.ga}</td>
                  <td className="py-3 text-center font-mono">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Play Again Action Button */}
      <button
        onClick={() => { soundFx.playClick(); onRestartGame(); }}
        className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-lg py-4 px-8 rounded-2xl shadow-glow-gold transition-all transform hover:scale-105 inline-flex items-center gap-3"
      >
        <RefreshCw className="w-6 h-6" />
        <span>MAIN LAGI (NEW ROOM / MATCH)</span>
      </button>
    </div>
  );
}
