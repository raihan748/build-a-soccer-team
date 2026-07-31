// ═══════════════════════════════════════════════════════
//  botAi.js — Intelligent Bot AI Decision Engine
// ═══════════════════════════════════════════════════════

import { FORMATION_SLOTS, findBestSlot } from './squadEngine.js';

// ── Bot decision: evaluate 4 drawn cards ──────────────
// Returns { action: 'pick'|'skip', slotKey, playerIndex, reason }
export function botDecide(manager, drawnCards) {
  const emptySlots = FORMATION_SLOTS.filter(s => manager.slots[s.key] === null);

  if (emptySlots.length === 0) {
    return { action: 'skip', reason: 'Squad is already complete.' };
  }

  // Score each card: try to find one that fits an empty slot
  let bestScore = -Infinity;
  let bestChoice = null;

  drawnCards.forEach((player, idx) => {
    const slotKey = findBestSlot(manager, player);
    if (!slotKey) return; // No slot matches this position

    // Score = OVR + bonuses for card rarity
    let score = player.ovr;
    if (player.cardType === 'legend') score += 10;
    else if (player.cardType === 'special') score += 5;

    // Prefer filling critical positions first
    const urgencyBonus = getCriticalBonus(manager, player.pos);
    score += urgencyBonus;

    if (score > bestScore) {
      bestScore = score;
      bestChoice = { action: 'pick', slotKey, playerIndex: idx, player, score };
    }
  });

  if (bestChoice) {
    const reason = buildReason(bestChoice);
    return { ...bestChoice, reason };
  }

  // No cards fit any empty slot → skip
  return {
    action: 'skip',
    reason: `No drawn cards match any of the ${emptySlots.length} remaining positions. Skipping...`,
  };
}

// ── Urgency bonus: GK and ST are critical ─────────────
function getCriticalBonus(manager, pos) {
  const countByPos = {};
  FORMATION_SLOTS.forEach(s => {
    if (manager.slots[s.key] === null) {
      countByPos[s.pos] = (countByPos[s.pos] || 0) + 1;
    }
  });

  // If GK slot is still empty, prioritize GK
  if (pos === 'GK' && countByPos['GK'] > 0) return 15;
  // If no ATT drafted yet, prioritize attackers
  const filledAtts = FORMATION_SLOTS.filter(s => s.pos === 'ATT' && manager.slots[s.key] !== null).length;
  if (pos === 'ATT' && filledAtts === 0) return 8;
  return 0;
}

// ── Build human-readable reason string ────────────────
function buildReason(choice) {
  const { player, slotKey, score } = choice;
  const adjectives = ['Excellent', 'Strategic', 'Smart', 'Optimal', 'Top-tier'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const typeNote = player.cardType === 'legend' ? ' 🏆 Legend card!' : player.cardType === 'special' ? ' ⭐ Special card!' : '';
  return `${adj} pick! Drafting ${player.name} (OVR ${player.ovr}) into [${slotKey}] slot. Score: ${score}.${typeNote}`;
}

// ── Bot delay timer (makes bot feel more natural) ─────
export function botThinkDelay(isComplex = false) {
  const base = isComplex ? 1200 : 800;
  const jitter = Math.random() * 600;
  return base + jitter;
}

// ── Check if bot should skip (all cards poor fit) ─────
export function botShouldSpin(manager) {
  // Bot always spins if it's their turn and they have empty slots
  const emptySlots = FORMATION_SLOTS.filter(s => manager.slots[s.key] === null);
  return emptySlots.length > 0;
}
