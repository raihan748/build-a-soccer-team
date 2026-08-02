'use client';

import React, { useState } from 'react';
import { Shield, Trophy, Users, Globe, Play, Sparkles, User, RefreshCw } from 'lucide-react';
import { soundFx } from '../services/audioService';

const CRESTS = ['🛡️', '👑', '⚡', '🦅', '🦁', '🐉', '🔥', '🏆', '⭐'];
const FORMATIONS = [
  { name: '4-3-3 Attacking', def: 4, mid: 3, fwd: 3 },
  { name: '4-4-2 Classic', def: 4, mid: 4, fwd: 2 },
  { name: '3-5-2 Wingplay', def: 3, mid: 5, fwd: 2 },
  { name: '4-2-3-1 Tactical', def: 4, mid: 5, fwd: 1 },
];

export default function ManagerSetup({ onStartLocalGame, onCreateOnlineRoom, onJoinOnlineRoom, isConnecting }) {
  const [playMode, setPlayMode] = useState('local'); // 'local', 'host', 'join'
  const [roomCode, setRoomCode] = useState('');
  
  // 3 Managers Data for Local Mode
  const [managers, setManagers] = useState([
    { name: 'Manager Alpha', crest: '🦁', color: '#f59e0b', formation: '4-3-3 Attacking' },
    { name: 'Manager Bravo', crest: '🦅', color: '#06b6d4', formation: '4-4-2 Classic' },
    { name: 'Manager Charlie', crest: '⚡', color: '#10b981', formation: '3-5-2 Wingplay' },
  ]);

  const updateManager = (index, field, value) => {
    soundFx.playClick();
    const copy = [...managers];
    copy[index][field] = value;
    setManagers(copy);
  };

  const handleStart = () => {
    soundFx.playWhistle();
    if (playMode === 'local') {
      onStartLocalGame(managers);
    } else if (playMode === 'host') {
      const code = roomCode.trim() || Math.floor(100000 + Math.random() * 900000).toString();
      onCreateOnlineRoom(managers[0], code);
    } else if (playMode === 'join') {
      if (!roomCode.trim()) return alert('Masukkan 6 Digit Kode Room!');
      onJoinOnlineRoom(managers[0], roomCode.trim());
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold mb-3">
          <Sparkles className="w-4 h-4 animate-spin" />
          <span>FUT LIVE TRANSFER & MATCH ENGINE</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase drop-shadow-md">
          Soccer Team <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-400">Manager 3P</span>
        </h1>
        <p className="text-slate-400 mt-2 text-base max-w-xl mx-auto">
          Multiplayer 3 Player Transfer Market ("Siapa Cepat Dia Dapat"), Squad Building, & Live 2D Tactical Showdown!
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-3 gap-3 mb-8 glass-panel p-2 rounded-2xl border border-white/10">
        <button
          onClick={() => { soundFx.playClick(); setPlayMode('local'); }}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${
            playMode === 'local'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-glow-gold'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="hidden md:inline">Pass & Play (1 Screen)</span>
          <span className="md:hidden">1 Screen</span>
        </button>

        <button
          onClick={() => { soundFx.playClick(); setPlayMode('host'); }}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${
            playMode === 'host'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow-cyan'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Globe className="w-5 h-5" />
          <span>Create Room (Host)</span>
        </button>

        <button
          onClick={() => { soundFx.playClick(); setPlayMode('join'); }}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${
            playMode === 'join'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-black font-extrabold shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Play className="w-5 h-5" />
          <span>Join Room</span>
        </button>
      </div>

      {/* Room Code Input for Host/Join */}
      {(playMode === 'host' || playMode === 'join') && (
        <div className="glass-panel p-6 rounded-2xl mb-8 border border-cyan-500/30 text-center">
          <label className="block text-sm font-semibold text-cyan-300 mb-2">
            {playMode === 'host' ? 'KODE ROOM KAMU (BISA CUSTOM / RANDOM):' : 'MASUKKAN KODE ROOM FRIEND (6 DIGIT):'}
          </label>
          <input
            type="text"
            maxLength={6}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="KODE: GOAL99"
            className="w-full max-w-xs text-center text-3xl font-mono font-black tracking-widest bg-slate-900/80 text-white border-2 border-cyan-500/50 rounded-xl py-3 focus:outline-none focus:border-cyan-400"
          />
        </div>
      )}

      {/* Manager Profiles Form */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {(playMode === 'local' ? managers : [managers[0]]).map((mgr, idx) => (
          <div
            key={idx}
            className="glass-panel p-5 rounded-2xl border border-white/10 relative overflow-hidden group hover:border-amber-500/40 transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{mgr.crest}</span>
              <h3 className="font-extrabold text-lg text-white">Player {idx + 1} Profile</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">NAMA KLUB / MANAJER</label>
                <input
                  type="text"
                  value={mgr.name}
                  onChange={(e) => updateManager(idx, 'name', e.target.value)}
                  className="w-full bg-slate-900/90 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">LOGO CREST</label>
                <div className="flex flex-wrap gap-1.5">
                  {CRESTS.map((crest) => (
                    <button
                      key={crest}
                      type="button"
                      onClick={() => updateManager(idx, 'crest', crest)}
                      className={`p-2 rounded-lg text-lg transition-transform ${
                        mgr.crest === crest ? 'bg-amber-500/30 border border-amber-400 scale-110' : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      {crest}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">FORMASI TAKTIS</label>
                <select
                  value={mgr.formation}
                  onChange={(e) => updateManager(idx, 'formation', e.target.value)}
                  className="w-full bg-slate-900/90 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold focus:border-amber-500 focus:outline-none"
                >
                  {FORMATIONS.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Start Action Button */}
      <div className="text-center">
        <button
          onClick={handleStart}
          disabled={isConnecting}
          className="w-full max-w-md bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xl py-4 px-8 rounded-2xl shadow-glow-gold transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 mx-auto"
        >
          {isConnecting ? (
            <>
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span>CONNECTING MULTIPLAYER...</span>
            </>
          ) : (
            <>
              <Trophy className="w-7 h-7" />
              <span>MASUK TRANSFER MARKET & DRAFT!</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
