// ═══════════════════════════════════════════════════════
//  tournament.js — Round-Robin Simulation & Leaderboard
// ═══════════════════════════════════════════════════════

import { calcAverageOvr, calcChemistry } from './squadEngine.js';
import { playWhistle, playFanfare } from './audio.js';

// ── Simulate a match between two managers ─────────────
// Returns { winnerId, goals: {[id]: number}, draw }
function simulateMatch(mgrA, mgrB) {
  const ovrA = calcAverageOvr(mgrA);
  const ovrB = calcAverageOvr(mgrB);
  const chemA = calcChemistry(mgrA);
  const chemB = calcChemistry(mgrB);

  // Team "strength" = 70% OVR + 30% Chem (normalized to 0-100 scale)
  const strA = ovrA * 0.7 + chemA * 0.3;
  const strB = ovrB * 0.7 + chemB * 0.3;

  // Add realistic random variance (±15%)
  const randA = strA + (Math.random() * 30 - 15);
  const randB = strB + (Math.random() * 30 - 15);

  // Generate realistic goal counts (0-5 goals each)
  // Base goals proportional to strength ratio
  const ratio = randA / Math.max(1, randA + randB);
  const totalGoals = Math.floor(Math.random() * 6) + 1; // 1-6 total goals
  let goalsA = Math.round(totalGoals * ratio);
  let goalsB = totalGoals - goalsA;

  // Clamp to realistic range
  goalsA = Math.min(7, Math.max(0, goalsA));
  goalsB = Math.min(7, Math.max(0, goalsB));

  const draw = goalsA === goalsB;
  const winnerId = draw ? null : (goalsA > goalsB ? mgrA.id : mgrB.id);

  return {
    winnerId,
    draw,
    goals: { [mgrA.id]: goalsA, [mgrB.id]: goalsB },
    mgrA: mgrA.id,
    mgrB: mgrB.id,
    strA: Math.round(strA),
    strB: Math.round(strB),
  };
}

// ── Run full Round-Robin tournament ───────────────────
// Returns { standings: [...], matches: [...] }
export function runTournament(managers) {
  const standings = {};
  managers.forEach(m => {
    standings[m.id] = {
      manager: m,
      id: m.id,
      name: m.name,
      color: m.color,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,  // goals for
      ga: 0,  // goals against
      pts: 0,
    };
  });

  const matches = [];

  // Every team vs every other team (one match each pair)
  for (let i = 0; i < managers.length; i++) {
    for (let j = i + 1; j < managers.length; j++) {
      const result = simulateMatch(managers[i], managers[j]);
      matches.push(result);

      const stA = standings[managers[i].id];
      const stB = standings[managers[j].id];

      stA.played++; stB.played++;
      stA.gf += result.goals[managers[i].id]; stA.ga += result.goals[managers[j].id];
      stB.gf += result.goals[managers[j].id]; stB.ga += result.goals[managers[i].id];

      if (result.draw) {
        stA.draws++; stA.pts += 1;
        stB.draws++; stB.pts += 1;
      } else if (result.winnerId === managers[i].id) {
        stA.wins++; stA.pts += 3;
        stB.losses++;
      } else {
        stB.wins++; stB.pts += 3;
        stA.losses++;
      }
    }
  }

  // Sort: pts → GD → GF → name
  const sorted = Object.values(standings).sort((a, b) => {
    const ptsDiff = b.pts - a.pts;
    if (ptsDiff !== 0) return ptsDiff;
    const gdDiff = (b.gf - b.ga) - (a.gf - a.ga);
    if (gdDiff !== 0) return gdDiff;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });

  return { standings: sorted, matches };
}

// ── Launch confetti for winner ─────────────────────────
export function launchVictoryCelebration(managerColor) {
  playFanfare();

  const hex = managerColor?.hex || '#f59e0b';

  // Parse hex to rgb
  const r = parseInt(hex.slice(1,3), 16) / 255;
  const g = parseInt(hex.slice(3,5), 16) / 255;
  const b = parseInt(hex.slice(5,7), 16) / 255;

  const colors = [hex, '#f59e0b', '#ffffff', '#10b981'];

  // Left cannon
  if (typeof confetti === 'function') confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.1, y: 0.6 },
    colors,
    gravity: 0.8,
  });

  // Right cannon
  setTimeout(() => {
    if (typeof confetti === 'function') confetti({
      particleCount: 80,
      spread: 70,
      origin: { x: 0.9, y: 0.6 },
      colors,
      gravity: 0.8,
    });
  }, 250);

  // Center burst
  setTimeout(() => {
    if (typeof confetti === 'function') confetti({
      particleCount: 120,
      spread: 100,
      origin: { x: 0.5, y: 0.3 },
      colors,
      gravity: 0.6,
      scalar: 1.2,
    });
  }, 500);

  // Trailing sparkle
  setTimeout(() => {
    if (typeof confetti === 'function') confetti({
      particleCount: 50,
      angle: 90,
      spread: 360,
      origin: { x: 0.5, y: 0.5 },
      colors,
      gravity: 0.4,
      drift: 0,
      scalar: 0.8,
    });
  }, 900);
}

// ── Render leaderboard HTML row ────────────────────────
export function renderLeaderboardRow(entry, rank) {
  const gd = entry.gf - entry.ga;
  const gdStr = gd > 0 ? `+${gd}` : `${gd}`;
  const ovr = calcAverageOvr(entry.manager);
  const chem = calcChemistry(entry.manager);

  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
  const rankClass = rank === 1 ? 'lb-rank-1' : rank === 2 ? 'lb-rank-2' : rank === 3 ? 'lb-rank-3' : 'text-gray-500';

  return `
    <tr>
      <td class="py-2 ${rankClass} text-center font-bold w-8">${rankEmoji}</td>
      <td class="py-2">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full inline-block" style="background:${entry.color.hex}"></span>
          <span class="font-semibold text-white text-sm">${entry.name}</span>
          ${entry.manager.isBot ? '<span class="text-xs text-purple-400 opacity-70"><i class="fa-solid fa-robot"></i></span>' : ''}
        </div>
      </td>
      <td class="py-2 text-center font-bold text-white">${entry.pts}</td>
      <td class="py-2 text-center text-sm ${gd >= 0 ? 'text-green-400' : 'text-red-400'}">${gdStr}</td>
      <td class="py-2 text-center text-sm text-yellow-400 font-bold">${ovr}</td>
    </tr>
  `;
}

// ── Render match result row HTML ───────────────────────
export function renderMatchRow(match, managers) {
  const mA = managers.find(m => m.id === match.mgrA);
  const mB = managers.find(m => m.id === match.mgrB);
  const goalsA = match.goals[match.mgrA];
  const goalsB = match.goals[match.mgrB];

  const resultClassA = match.draw ? 'mrr-draw' : (match.winnerId === match.mgrA ? 'mrr-win' : 'mrr-loss');
  const resultClassB = match.draw ? 'mrr-draw' : (match.winnerId === match.mgrB ? 'mrr-win' : 'mrr-loss');

  return `
    <div class="match-result-row">
      <div class="mrr-team ${resultClassA}" style="color:${mA.color.hex}80">${mA.name}</div>
      <div class="mrr-score" style="color:${mA.color.hex}">${goalsA}</div>
      <div class="text-gray-600 text-xs">—</div>
      <div class="mrr-score" style="color:${mB.color.hex}">${goalsB}</div>
      <div class="mrr-team text-right ${resultClassB}" style="color:${mB.color.hex}80">${mB.name}</div>
    </div>
  `;
}
