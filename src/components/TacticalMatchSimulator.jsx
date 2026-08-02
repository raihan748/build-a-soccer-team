'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, Zap, Shield, Trophy, Flame, Smile, Award, Activity } from 'lucide-react';
import { soundFx } from '../services/audioService';

const EMOTES = ['⚽', '🔥', '👏', '😱', '🏆', '💀', '👑'];

export default function TacticalMatchSimulator({
  managers,
  onCompleteTournament,
  peerService
}) {
  // Matches Schedule: P1 vs P2, P2 vs P3, P3 vs P1
  const matches = [
    { id: 1, homeIdx: 0, awayIdx: 1, homeScore: 0, awayScore: 0, status: 'upcoming' },
    { id: 2, homeIdx: 1, awayIdx: 2, homeScore: 0, awayScore: 0, status: 'upcoming' },
    { id: 3, homeIdx: 2, awayIdx: 0, homeScore: 0, awayScore: 0, status: 'upcoming' },
  ];

  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [matchState, setMatchState] = useState({
    minute: 0,
    isPlaying: false,
    homeScore: 0,
    awayScore: 0,
    homeTactic: 'BALANCED',
    awayTactic: 'BALANCED',
    commentary: ['Match Kickoff imminent! Managers preparing strategies...'],
    ballPos: { x: 50, y: 50 },
    homePossession: 50,
  });

  const [standings, setStandings] = useState([
    { mgrIdx: 0, name: managers[0].name, crest: managers[0].crest, points: 0, gf: 0, ga: 0, gd: 0 },
    { mgrIdx: 1, name: managers[1].name, crest: managers[1].crest, points: 0, gf: 0, ga: 0, gd: 0 },
    { mgrIdx: 2, name: managers[2].name, crest: managers[2].crest, points: 0, gf: 0, ga: 0, gd: 0 },
  ]);

  const [activeEmotes, setActiveEmotes] = useState([]);

  const currentMatch = matches[currentMatchIdx];
  const homeMgr = managers[currentMatch.homeIdx];
  const awayMgr = managers[currentMatch.awayIdx];

  // Emote Listener
  useEffect(() => {
    if (peerService) {
      peerService.onEmoteCallback = (emoteData) => {
        showEmoteBubble(emoteData);
      };
    }
  }, [peerService]);

  const showEmoteBubble = (emoteData) => {
    const id = Date.now();
    setActiveEmotes((prev) => [...prev, { id, ...emoteData }]);
    setTimeout(() => {
      setActiveEmotes((prev) => prev.filter((e) => e.id !== id));
    }, 2500);
  };

  const handleSendEmote = (emoji) => {
    soundFx.playClick();
    const data = { emoji, sender: managers[0].name };
    if (peerService) {
      peerService.sendEmote(data);
    } else {
      showEmoteBubble(data);
    }
  };

  // Match Simulation Clock Timer
  useEffect(() => {
    let interval = null;

    if (matchState.isPlaying && matchState.minute < 90) {
      interval = setInterval(() => {
        setMatchState((prev) => {
          const nextMin = prev.minute + 2;

          // Ball random movement
          const newBallX = Math.max(10, Math.min(90, prev.ballPos.x + (Math.random() * 20 - 10)));
          const newBallY = Math.max(10, Math.min(90, prev.ballPos.y + (Math.random() * 20 - 10)));

          // Tactical Bias Calculation
          const homeRating = homeMgr.squadRating || 80;
          const awayRating = awayMgr.squadRating || 80;

          let homeGoalChance = (homeRating / (homeRating + awayRating)) * 0.08;
          let awayGoalChance = (awayRating / (homeRating + awayRating)) * 0.08;

          if (prev.homeTactic === 'ATTACKING') homeGoalChance += 0.03;
          if (prev.homeTactic === 'PARK THE BUS') homeGoalChance -= 0.02;
          if (prev.awayTactic === 'ATTACKING') awayGoalChance += 0.03;
          if (prev.awayTactic === 'PARK THE BUS') awayGoalChance -= 0.02;

          let newHomeScore = prev.homeScore;
          let newAwayScore = prev.awayScore;
          let newComm = [...prev.commentary];

          // Goal Trigger
          if (Math.random() < homeGoalChance && nextMin > 10) {
            newHomeScore += 1;
            const scorer = homeMgr.squad[Math.floor(Math.random() * (homeMgr.squad.length || 1))]?.name || 'Striker';
            newComm.unshift(`⚽ ${nextMin}' GOAAAL! ${scorer} scores a magnificent goal for ${homeMgr.name}!`);
            soundFx.playGoalFanfare();
          } else if (Math.random() < awayGoalChance && nextMin > 10) {
            newAwayScore += 1;
            const scorer = awayMgr.squad[Math.floor(Math.random() * (awayMgr.squad.length || 1))]?.name || 'Striker';
            newComm.unshift(`⚽ ${nextMin}' GOAAAL! ${scorer} strikes for ${awayMgr.name}!`);
            soundFx.playGoalFanfare();
          } else if (nextMin % 15 === 0) {
            const lines = [
              `${nextMin}' Great interception in midfield!`,
              `${nextMin}' Tactical battle intensifying between both sides.`,
              `${nextMin}' Powerful shot saved by the goalkeeper!`,
              `${nextMin}' Dangerous cross cleared out for a corner.`
            ];
            newComm.unshift(lines[Math.floor(Math.random() * lines.length)]);
          }

          // Full time check
          if (nextMin >= 90) {
            soundFx.playWhistle();
            newComm.unshift(`🏁 90' FULL TIME! Final Score: ${homeMgr.name} ${newHomeScore} - ${newAwayScore} ${awayMgr.name}`);
            setTimeout(() => {
              finishMatch(newHomeScore, newAwayScore);
            }, 2000);
          }

          return {
            ...prev,
            minute: nextMin,
            homeScore: newHomeScore,
            awayScore: newAwayScore,
            ballPos: { x: newBallX, y: newBallY },
            commentary: newComm.slice(0, 10),
            isPlaying: nextMin < 90
          };
        });
      }, 350);
    }

    return () => clearInterval(interval);
  }, [matchState.isPlaying, matchState.minute]);

  const toggleSimulation = () => {
    soundFx.playClick();
    if (matchState.minute === 0) soundFx.playWhistle();
    setMatchState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const setTactic = (isHome, tactic) => {
    soundFx.playClick();
    setMatchState((prev) => ({
      ...prev,
      [isHome ? 'homeTactic' : 'awayTactic']: tactic
    }));
  };

  const finishMatch = (hScore, aScore) => {
    // Update Standings
    setStandings((prev) => {
      const copy = [...prev];
      const hStand = copy.find((s) => s.mgrIdx === currentMatch.homeIdx);
      const aStand = copy.find((s) => s.mgrIdx === currentMatch.awayIdx);

      hStand.gf += hScore;
      hStand.ga += aScore;
      hStand.gd = hStand.gf - hStand.ga;

      aStand.gf += aScore;
      aStand.ga += hScore;
      aStand.gd = aStand.gf - aStand.ga;

      if (hScore > aScore) {
        hStand.points += 3;
      } else if (aScore > hScore) {
        aStand.points += 3;
      } else {
        hStand.points += 1;
        aStand.points += 1;
      }

      return copy.sort((a, b) => b.points - a.points || b.gd - a.gd);
    });

    if (currentMatchIdx < matches.length - 1) {
      setTimeout(() => {
        setCurrentMatchIdx((prev) => prev + 1);
        setMatchState({
          minute: 0,
          isPlaying: false,
          homeScore: 0,
          awayScore: 0,
          homeTactic: 'BALANCED',
          awayTactic: 'BALANCED',
          commentary: ['Preparing Next Match...'],
          ballPos: { x: 50, y: 50 },
          homePossession: 50
        });
      }, 2500);
    } else {
      setTimeout(() => {
        onCompleteTournament(standings);
      }, 3000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 relative">
      {/* Emotes Overlay Layer */}
      <div className="fixed top-20 right-8 z-50 flex flex-col gap-2 pointer-events-none">
        {activeEmotes.map((e) => (
          <div key={e.id} className="animate-bounce bg-black/80 border border-amber-400 text-white px-4 py-2 rounded-2xl shadow-glow-gold flex items-center gap-2">
            <span className="text-2xl">{e.emoji}</span>
            <span className="text-xs font-bold text-amber-300">{e.sender}</span>
          </div>
        ))}
      </div>

      {/* Top Match Scoreboard Header */}
      <div className="glass-panel p-6 rounded-3xl mb-6 border border-white/10 text-center shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {/* Home Team */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl">{homeMgr.crest}</span>
            <h3 className="font-extrabold text-white text-lg">{homeMgr.name}</h3>
            <span className="text-xs text-amber-400 font-bold">Rating: {homeMgr.squadRating || 80}</span>
          </div>

          {/* Score & Time */}
          <div className="flex flex-col items-center">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 font-mono text-xs font-bold rounded-full mb-2">
              MATCH {currentMatchIdx + 1} OF 3 • {matchState.minute}'
            </span>
            <div className="text-5xl font-black tracking-widest text-white">
              {matchState.homeScore} : {matchState.awayScore}
            </div>
            <button
              onClick={toggleSimulation}
              className="mt-3 px-6 py-2 rounded-xl font-black text-xs bg-amber-500 hover:bg-amber-400 text-black shadow-glow-gold flex items-center gap-2"
            >
              {matchState.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{matchState.isPlaying ? 'PAUSE MATCH' : 'START SIMULATION'}</span>
            </button>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl">{awayMgr.crest}</span>
            <h3 className="font-extrabold text-white text-lg">{awayMgr.name}</h3>
            <span className="text-xs text-amber-400 font-bold">Rating: {awayMgr.squadRating || 80}</span>
          </div>
        </div>
      </div>

      {/* 2D Pitch Match Radar Visual */}
      <div className="glass-panel p-4 rounded-3xl mb-6 border border-white/10 relative h-72 overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950">
        <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(90deg,#fff,#fff_30px,transparent_30px,transparent_60px)]" />

        {/* Ball Dot */}
        <div
          style={{ left: `${matchState.ballPos.x}%`, top: `${matchState.ballPos.y}%` }}
          className="absolute w-4 h-4 bg-amber-400 rounded-full border-2 border-white shadow-glow-gold transition-all duration-300 -translate-x-1/2 -translate-y-1/2"
        />

        {/* Pitch Lines */}
        <div className="absolute top-0 bottom-0 left-1/2 border-r border-white/20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white/20 rounded-full" />
      </div>

      {/* Live Tactical Controls */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Home Manager Tactics */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10">
          <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">{homeMgr.name} LIVE TACTICS</h4>
          <div className="grid grid-cols-2 gap-2">
            {['ATTACKING', 'BALANCED', 'COUNTER-ATTACK', 'PARK THE BUS'].map((tac) => (
              <button
                key={tac}
                onClick={() => setTactic(true, tac)}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all ${
                  matchState.homeTactic === tac
                    ? 'bg-amber-500 text-black shadow-glow-gold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tac}
              </button>
            ))}
          </div>
        </div>

        {/* Away Manager Tactics */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10">
          <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">{awayMgr.name} LIVE TACTICS</h4>
          <div className="grid grid-cols-2 gap-2">
            {['ATTACKING', 'BALANCED', 'COUNTER-ATTACK', 'PARK THE BUS'].map((tac) => (
              <button
                key={tac}
                onClick={() => setTactic(false, tac)}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all ${
                  matchState.awayTactic === tac
                    ? 'bg-cyan-500 text-black shadow-glow-cyan'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tac}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Reactions Emote Bar */}
      <div className="glass-panel p-3 rounded-2xl mb-6 flex items-center justify-center gap-3">
        <span className="text-xs font-bold text-slate-400 uppercase">SEND REACTION:</span>
        {EMOTES.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSendEmote(emoji)}
            className="text-2xl hover:scale-125 transition-transform p-1"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Live Commentary Feed */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10">
        <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">LIVE MATCH COMMENTARY</h4>
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {matchState.commentary.map((line, idx) => (
            <div key={idx} className="text-xs font-medium text-slate-300 py-1 border-b border-white/5">
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
