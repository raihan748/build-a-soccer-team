'use client';

import React from 'react';
import { Shield, Sparkles, RefreshCw, Trash2, ArrowUpRight } from 'lucide-react';
import { soundFx } from '../services/audioService';

export default function FootballPitch({ manager, onResellPlayer }) {
  const { name, crest, formation, squad, budget, squadRating } = manager;

  // Render 11 Slots on Pitch
  const pitchSlots = [
    { pos: 'GK', label: 'Goalkeeper', top: '85%', left: '50%' },
    { pos: 'LB', label: 'Left Back', top: '65%', left: '18%' },
    { pos: 'CB1', label: 'Center Back', top: '70%', left: '38%' },
    { pos: 'CB2', label: 'Center Back', top: '70%', left: '62%' },
    { pos: 'RB', label: 'Right Back', top: '65%', left: '82%' },
    { pos: 'CM1', label: 'Midfielder', top: '45%', left: '30%' },
    { pos: 'CM2', label: 'Midfielder', top: '45%', left: '50%' },
    { pos: 'CM3', label: 'Midfielder', top: '45%', left: '70%' },
    { pos: 'LW', label: 'Left Wing', top: '22%', left: '20%' },
    { pos: 'ST', label: 'Striker', top: '18%', left: '50%' },
    { pos: 'RW', label: 'Right Wing', top: '22%', left: '80%' },
  ];

  return (
    <div className="glass-panel p-6 rounded-3xl border border-white/10 max-w-4xl mx-auto my-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{crest}</span>
          <div>
            <h3 className="text-2xl font-black text-white">{name}</h3>
            <p className="text-xs text-amber-400 font-bold">{formation} • Squad: {squad.length} / 11</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center px-4 py-2 bg-black/40 rounded-xl border border-white/5">
            <span className="block text-[10px] text-slate-400 font-bold uppercase">SQUAD RATING</span>
            <span className="text-2xl font-black text-amber-400">{squadRating || 0}</span>
          </div>

          <div className="text-center px-4 py-2 bg-black/40 rounded-xl border border-white/5">
            <span className="block text-[10px] text-slate-400 font-bold uppercase">REMAINING CASH</span>
            <span className="text-xl font-extrabold text-emerald-400">${(budget / 1000000).toFixed(1)}M</span>
          </div>
        </div>
      </div>

      {/* 2D Grass Football Pitch */}
      <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 shadow-2xl">
        {/* Grass Stripes Pattern */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[repeating-linear-gradient(0deg,#fff,#fff_40px,transparent_40px,transparent_80px)]" />

        {/* Center Circle & Lines */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-2 border-white/30 rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30 pointer-events-none" />

        {/* Penalty Areas */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 border-b-2 border-x-2 border-white/30 pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-24 border-t-2 border-x-2 border-white/30 pointer-events-none" />

        {/* Slots Overlay */}
        {pitchSlots.map((slot, idx) => {
          const player = squad[idx];

          return (
            <div
              key={idx}
              style={{ top: slot.top, left: slot.left }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
            >
              {player ? (
                <div className="group relative flex flex-col items-center cursor-pointer">
                  {/* Resell Button on Hover */}
                  <button
                    onClick={() => { soundFx.playClick(); onResellPlayer && onResellPlayer(player.id, manager); }}
                    title="Jual Kembali ke Pasaran"
                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-md"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>

                  <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-amber-400 bg-slate-900 shadow-glow-gold">
                    <img
                      src={player.image}
                      alt={player.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png';
                      }}
                    />
                  </div>
                  <div className="bg-slate-900/90 text-white text-[10px] font-black px-2 py-0.5 rounded-full mt-1 border border-amber-400/50 shadow truncate max-w-[90px]">
                    {player.name.split(' ').pop()} ({player.rating})
                  </div>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/40 bg-black/40 flex items-center justify-center text-white/50 text-[11px] font-extrabold shadow-inner">
                  {slot.pos}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bench Section */}
      {squad.length > 11 && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">BENCH CADANGAN ({squad.length - 11} Pemain)</h4>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {squad.slice(11).map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-white/10 shrink-0">
                <img src={p.image} className="w-8 h-8 rounded-full object-cover" />
                <div>
                  <div className="text-xs font-bold text-white">{p.name}</div>
                  <div className="text-[10px] text-amber-400">{p.position} • {p.rating}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
