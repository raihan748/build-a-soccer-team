// ═══════════════════════════════════════════════════════
//  squadEngine.js — Turn State, 4-3-3 Formation & Chemistry
// ═══════════════════════════════════════════════════════

// ── Formation: 4-3-3 slot definitions ─────────────────
export const FORMATION_SLOTS = [
  // Attackers  (row y≈14%)
  { key:'LW',  label:'LW',  pos:'ATT', x:18,  y:14 },
  { key:'ST',  label:'ST',  pos:'ATT', x:50,  y:10 },
  { key:'RW',  label:'RW',  pos:'ATT', x:82,  y:14 },
  // Midfielders (row y≈38%)
  { key:'CAM', label:'CAM', pos:'MID', x:50,  y:34 },
  { key:'CM',  label:'CM',  pos:'MID', x:22,  y:44 },
  { key:'CDM', label:'CDM', pos:'MID', x:78,  y:44 },
  // Defenders  (row y≈65%)
  { key:'LB',  label:'LB',  pos:'DEF', x:10,  y:67 },
  { key:'CB1', label:'CB',  pos:'DEF', x:35,  y:67 },
  { key:'CB2', label:'CB',  pos:'DEF', x:65,  y:67 },
  { key:'RB',  label:'RB',  pos:'DEF', x:90,  y:67 },
  // Goalkeeper (row y≈88%)
  { key:'GK',  label:'GK',  pos:'GK',  x:50,  y:88 },
];

// Manager color themes
export const MANAGER_COLORS = [
  { name:'Red',          hex:'#ef4444', cls:'text-m0', bg:'bg-m0', glow:'mgr-glow-0', tabColor:'#ef4444' },
  { name:'Blue',         hex:'#3b82f6', cls:'text-m1', bg:'bg-m1', glow:'mgr-glow-1', tabColor:'#3b82f6' },
  { name:'Emerald',      hex:'#10b981', cls:'text-m2', bg:'bg-m2', glow:'mgr-glow-2', tabColor:'#10b981' },
  { name:'Purple',       hex:'#8b5cf6', cls:'text-m3', bg:'bg-m3', glow:'mgr-glow-3', tabColor:'#8b5cf6' },
  { name:'Amber Gold',   hex:'#f59e0b', cls:'text-m4', bg:'bg-m4', glow:'mgr-glow-4', tabColor:'#f59e0b' },
];

// ── Create a fresh Manager state ───────────────────────
export function createManager(id, name, isBot = false) {
  const slots = {};
  FORMATION_SLOTS.forEach(s => { slots[s.key] = null; });
  return {
    id,
    name,
    isBot,
    color: MANAGER_COLORS[typeof id === 'number' ? id : 0] || MANAGER_COLORS[0],
    slots,   // { LW: playerObj|null, ST: null, ... }
    spinsDone: 0,
    done: false,   // all 11 slots filled
  };
}

// ── Fill a slot for a manager ──────────────────────────
export function fillSlot(manager, slotKey, player) {
  manager.slots[slotKey] = player;
  manager.done = isSquadComplete(manager);
}

// ── Check if squad is complete ────────────────────────
export function isSquadComplete(manager) {
  return FORMATION_SLOTS.every(s => manager.slots[s.key] !== null);
}

// ── Find best empty slot for a player (STRICT POSITION ACCURACY)
export function findBestSlot(manager, player) {
  const empties = FORMATION_SLOTS.filter(s => manager.slots[s.key] === null);
  if (empties.length === 0) return null;

  // 1. Try exact sub-position match if player.subPos is defined (e.g. ST, LW, RW, CB, LB, RB, CAM, CDM, CM, GK)
  if (player.subPos) {
    const subMatch = empties.find(s => s.key === player.subPos || s.key.startsWith(player.subPos));
    if (subMatch) return subMatch.key;
    // Map RM/LM to midfield slots
    if (player.subPos === 'RM' || player.subPos === 'LM') {
      const midFallback = empties.find(s => s.key === 'CM' || s.key === 'CDM' || s.key === 'CAM');
      if (midFallback) return midFallback.key;
    }
    // Map CF to attacker slots
    if (player.subPos === 'CF') {
      const attFallback = empties.find(s => s.pos === 'ATT');
      if (attFallback) return attFallback.key;
    }
  }

  // 2. Fallback to any empty slot within the player's main position category (ATT, MID, DEF, GK)
  const posMatch = empties.find(s => s.pos === player.pos);
  if (posMatch) return posMatch.key;

  // 3. No position match available
  return null;
}

// ── Count filled slots ─────────────────────────────────
export function filledCount(manager) {
  return FORMATION_SLOTS.filter(s => manager.slots[s.key] !== null).length;
}

// ── Get all players in squad as array ─────────────────
export function getSquadPlayers(manager) {
  return FORMATION_SLOTS.map(s => manager.slots[s.key]).filter(Boolean);
}

// ── Calculate Average OVR ─────────────────────────────
export function calcAverageOvr(manager) {
  const players = getSquadPlayers(manager);
  if (players.length === 0) return 0;
  return Math.round(players.reduce((sum, p) => sum + p.ovr, 0) / players.length);
}

// ── Calculate Team Chemistry (0–100) ──────────────────
export function calcChemistry(manager) {
  const players = getSquadPlayers(manager);
  if (players.length < 2) return 0;

  let bonus = 0;

  // Normalize club name: strip (I), (Icon), (Legend) suffixes
  function normalizeClub(club) {
    if (!club || club === 'Free Agent') return null;
    return club.replace(/\s*\((?:I|Icon|Legend)\)\s*$/i, '').trim();
  }

  // Club chemistry (+8% per duplicate club)
  const clubCounts = {};
  players.forEach(p => {
    const club = normalizeClub(p.club);
    if (club) clubCounts[club] = (clubCounts[club] || 0) + 1;
  });
  Object.values(clubCounts).forEach(count => {
    if (count >= 2) bonus += (count - 1) * 8;
  });

  // Nationality chemistry (+6% per duplicate country)
  const natCounts = {};
  players.forEach(p => { natCounts[p.nat] = (natCounts[p.nat] || 0) + 1; });
  Object.values(natCounts).forEach(count => {
    if (count >= 2) bonus += (count - 1) * 6;
  });

  return Math.min(100, bonus);
}

// ── Get color for chemistry score ─────────────────────
export function chemColor(chem) {
  if (chem >= 70) return '#10b981';  // green
  if (chem >= 40) return '#f59e0b';  // amber
  return '#ef4444';                  // red
}

// ── Build turn order (round-robin) ────────────────────
export function buildTurnOrder(managers) {
  return managers.map(m => m.id);
}
