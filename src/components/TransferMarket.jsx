'use client';

import React, { useState } from 'react';
import { ShoppingCart, DollarSign, Search, CheckCircle2, Zap } from 'lucide-react';
import { soundFx } from '../services/audioService';

// Ultra-reliable Inline SVG Avatar generator — 0 network dependency, 100% fail-proof
function PlayerCardAvatar({ player, size = 80 }) {
  const [imgFailed, setImgFailed] = useState(false);

  const getPositionColor = (pos) => {
    if (pos === 'GK') return { bg: '#eab308', text: '#fef08a' }; // Yellow
    if (['CB', 'LB', 'RB'].includes(pos)) return { bg: '#3b82f6', text: '#bfdbfe' }; // Blue
    if (['CM', 'CAM', 'CDM', 'RM', 'LM'].includes(pos)) return { bg: '#10b981', text: '#a7f3d0' }; // Emerald
    return { bg: '#ef4444', text: '#fecaca' }; // Red/FWD
  };

  const colors = getPositionColor(player.position);
  const initials = player.name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'FC';

  // If real image exists and hasn't failed, attempt to render it
  if (player.image && !imgFailed) {
    return (
      <img
        src={player.image}
        alt={player.name}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        className="w-full h-full object-cover"
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Fail-proof Inline SVG Vector Badge
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-black relative select-none">
      <svg viewBox="0 0 100 100" className="w-full h-full p-1">
        <defs>
          <linearGradient id={`grad-${player.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.bg} stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        {/* Background Shield */}
        <circle cx="50" cy="50" r="46" fill={`url(#grad-${player.id})`} stroke={colors.bg} strokeWidth="2" />
        {/* Stylized Player Jersey Silhouette */}
        <path d="M 30 75 C 30 60, 40 52, 50 52 C 60 52, 70 60, 70 75 Z" fill="#1e293b" opacity="0.8" />
        <circle cx="50" cy="38" r="14" fill="#334155" />
        {/* Initials Text */}
        <text
          x="50"
          y="56"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="20"
          fontWeight="900"
          fontFamily="sans-serif"
          letterSpacing="1"
        >
          {initials}
        </text>
      </svg>
    </div>
  );
}

export default function TransferMarket({
  availablePool,
  managers,
  activePlayerIndex,
  purchasedMap,
  onBuyPlayer,
  onFinishDraft
}) {
  const [filterPos, setFilterPos] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const currentManager = managers[activePlayerIndex];

  // Filter players
  const filteredPlayers = availablePool.filter((player) => {
    const matchesPos = filterPos === 'ALL' || player.position === filterPos ||
      (filterPos === 'DEF' && ['CB', 'LB', 'RB'].includes(player.position)) ||
      (filterPos === 'MID' && ['CM', 'CAM', 'CDM', 'RM', 'LM'].includes(player.position)) ||
      (filterPos === 'FWD' && ['ST', 'RW', 'LW'].includes(player.position));
    
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.club.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.nation.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesPos && matchesSearch;
  });

  const handleBuy = (player) => {
    if (purchasedMap[player.id]) return; // Already sold out
    if (currentManager.budget < player.price) {
      alert(`Budget ${currentManager.name} tidak cukup untuk membeli ${player.name}!`);
      return;
    }

    soundFx.playCoin();
    onBuyPlayer(player, activePlayerIndex);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Top Status Bar: 3 Managers Wallets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {managers.map((mgr, idx) => {
          const isActive = idx === activePlayerIndex;
          return (
            <div
              key={idx}
              className={`p-4 rounded-2xl transition-all border ${
                isActive
                  ? 'glass-card-gold shadow-glow-gold scale-102 border-amber-400'
                  : 'glass-panel opacity-80 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{mgr.crest}</span>
                  <div>
                    <h4 className="font-extrabold text-white text-sm">{mgr.name}</h4>
                    <p className="text-xs text-slate-400">{mgr.squad.length} / 11 Players</p>
                  </div>
                </div>
                {isActive && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-black animate-pulse">
                    GILIRAN BELI
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between bg-black/40 rounded-xl p-2.5 border border-white/5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold">
                  <DollarSign className="w-4 h-4" />
                  <span>${(mgr.budget / 1000000).toFixed(1)}M</span>
                </div>
                <div className="text-xs font-bold text-amber-400">
                  Rating: {mgr.squadRating || 0}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Control Panel: Filters & Search */}
      <div className="glass-panel p-4 rounded-2xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map((pos) => (
            <button
              key={pos}
              onClick={() => { soundFx.playClick(); setFilterPos(pos); }}
              className={`px-4 py-2 rounded-xl font-extrabold text-xs transition-all ${
                filterPos === pos
                  ? 'bg-amber-500 text-black shadow-glow-gold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari Pemain / Klub / Negara..."
            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <button
          onClick={() => { soundFx.playWhistle(); onFinishDraft(); }}
          className="px-6 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-lg flex items-center gap-2 whitespace-nowrap"
        >
          <Zap className="w-4 h-4" />
          <span>MULAI MATCH TOURNAMENT!</span>
        </button>
      </div>

      {/* 80 Players Market Grid ("Siapa Cepat Dia Dapat") */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredPlayers.map((player) => {
          const isSold = Boolean(purchasedMap[player.id]);
          const buyerMgrIndex = purchasedMap[player.id];
          const isLegend = player.rarity === 'Legend';

          return (
            <div
              key={player.id}
              className={`relative rounded-2xl p-3 border transition-all duration-300 flex flex-col justify-between ${
                isSold
                  ? 'bg-slate-950/80 border-slate-800 opacity-50 grayscale'
                  : isLegend
                  ? 'glass-card-legend hover:scale-105 shadow-glow-legend'
                  : 'glass-card hover:scale-105 hover:border-amber-500/50'
              }`}
            >
              {/* Sold Out Badge Overlay */}
              {isSold && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center z-10 p-2 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    SOLD OUT
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold mt-1">
                    {managers[buyerMgrIndex]?.name}
                  </span>
                </div>
              )}

              {/* Player Top Meta */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    player.position === 'GK' ? 'bg-yellow-500/20 text-yellow-300' :
                    ['CB','LB','RB'].includes(player.position) ? 'bg-blue-500/20 text-blue-300' :
                    ['CM','CAM','CDM','RM','LM'].includes(player.position) ? 'bg-emerald-500/20 text-emerald-300' :
                    'bg-red-500/20 text-red-300'
                  }`}>
                    {player.position}
                  </span>

                  <span className="text-lg font-black text-amber-400 drop-shadow">
                    {player.rating}
                  </span>
                </div>

                {/* Player Photo with Fallback SVG */}
                <div className="relative w-20 h-20 mx-auto my-1 rounded-full overflow-hidden border-2 border-white/20 bg-slate-900 flex items-center justify-center shadow-md">
                  <PlayerCardAvatar player={player} size={80} />
                </div>

                {/* Player Info */}
                <div className="text-center mt-2">
                  <h5 className="font-extrabold text-sm text-white truncate">{player.name}</h5>
                  <p className="text-[11px] text-slate-400 truncate">{player.club} • {player.nation}</p>
                </div>
              </div>

              {/* Stats Mini Grid */}
              <div className="grid grid-cols-3 gap-1 bg-black/40 p-1.5 rounded-xl my-2 text-[10px] font-bold text-slate-300 text-center">
                <div>PAC: <span className="text-white">{player.stats.pace}</span></div>
                <div>SHO: <span className="text-white">{player.stats.shooting}</span></div>
                <div>DRI: <span className="text-white">{player.stats.dribbling}</span></div>
              </div>

              {/* Price & Buy Button */}
              <div className="pt-1">
                <div className="text-center mb-1">
                  <span className="text-xs font-black text-emerald-400">
                    ${(player.price / 1000000).toFixed(1)}M
                  </span>
                </div>

                <button
                  disabled={isSold}
                  onClick={() => handleBuy(player)}
                  className={`w-full py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1 ${
                    isSold
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black shadow-md hover:scale-102'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>BELI (CLAIM)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
