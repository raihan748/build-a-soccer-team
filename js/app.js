// ═══════════════════════════════════════════════════════
//  app.js — Main Application Controller
//  UI Rendering, Event Handlers, Game Loop
// ═══════════════════════════════════════════════════════

import { buildPlayerPool } from './database.js';
import { playSpin, playPick, playSkip, playCardDeal, playWhistle } from './audio.js';
import {
  FORMATION_SLOTS, MANAGER_COLORS, createManager,
  fillSlot, findBestSlot, filledCount, isSquadComplete,
  getSquadPlayers, calcAverageOvr, calcChemistry, chemColor
} from './squadEngine.js';
import { botDecide, botThinkDelay } from './botAi.js';
import {
  runTournament, launchVictoryCelebration,
  renderLeaderboardRow, renderMatchRow
} from './tournament.js';

// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
let state = {
  mode: null,          // 'solo' | 'multi'
  managers: [],        // array of manager objects
  playerPool: [],      // remaining undrafted players
  drawnCards: [],      // current 4 cards on table
  currentTurnIndex: 0, // index into managers array
  hasSpun: false,      // whether spin happened this turn
  selectedCard: null,  // index of selected card (pending pick)
  viewingManagerId: 0, // which manager's pitch we're showing
  isProcessing: false, // guard against double-clicks
  botPending: false,   // bot turn is in progress
  // Config from setup modal:
  soloBots: 1,
  multiPlayers: 2,
};

// ═══════════════════════════════════════════════════════
//  SCREEN MANAGEMENT
// ═══════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);
}

// ═══════════════════════════════════════════════════════
//  MODAL HELPERS
// ═══════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ═══════════════════════════════════════════════════════
//  SOLO CONFIG
// ═══════════════════════════════════════════════════════
window.showSoloConfig = function() { openModal('modal-solo'); };
window.closeSoloModal = function() { closeModal('modal-solo'); };

window.selectSoloBots = function(n) {
  state.soloBots = n;
  document.querySelectorAll('.solo-bot-btn').forEach(btn => {
    btn.classList.toggle('active-solo-btn', parseInt(btn.dataset.bots) === n);
  });
};

window.startSoloGame = function() {
  const nameInput = document.getElementById('solo-manager-name');
  const playerName = (nameInput.value.trim() || 'Manager 1').substring(0, 20);
  const numBots = state.soloBots;

  const managers = [];
  managers.push(createManager(0, playerName, false));
  for (let i = 0; i < numBots; i++) {
    const botNames = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'];
    managers.push(createManager(i + 1, botNames[i] || `Bot ${i+1}`, true));
  }

  closeModal('modal-solo');
  startGame('solo', managers);
};

// ═══════════════════════════════════════════════════════
//  MULTI CONFIG
// ═══════════════════════════════════════════════════════
window.showMultiConfig = function() {
  state.multiPlayers = 2;
  renderMultiNameInputs();
  openModal('modal-multi');
};
window.closeMultiModal = function() { closeModal('modal-multi'); };

window.selectMultiPlayers = function(n) {
  state.multiPlayers = n;
  document.querySelectorAll('.multi-p-btn').forEach(btn => {
    btn.classList.toggle('active-multi-btn', parseInt(btn.dataset.players) === n);
  });
  renderMultiNameInputs();
};

function renderMultiNameInputs() {
  const container = document.getElementById('multi-name-inputs');
  const defaultNames = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5'];
  let html = '';
  for (let i = 0; i < state.multiPlayers; i++) {
    const color = MANAGER_COLORS[i];
    html += `
      <div class="multi-name-row">
        <span class="multi-name-dot" style="background:${color.hex}"></span>
        <input type="text" class="multi-name-input" id="multi-name-${i}"
          placeholder="${defaultNames[i]}" maxlength="20" value="${defaultNames[i]}" />
      </div>
    `;
  }
  container.innerHTML = html;
}

window.startMultiGame = function() {
  const managers = [];
  for (let i = 0; i < state.multiPlayers; i++) {
    const input = document.getElementById(`multi-name-${i}`);
    const name = (input?.value.trim() || `Player ${i+1}`).substring(0, 20);
    managers.push(createManager(i, name, false));
  }
  closeModal('modal-multi');
  startGame('multi', managers);
};

// ═══════════════════════════════════════════════════════
//  GAME START
// ═══════════════════════════════════════════════════════
function startGame(mode, managers) {
  state.mode = mode;
  state.managers = managers;
  state.playerPool = buildPlayerPool();
  state.drawnCards = [];
  state.currentTurnIndex = 0;
  state.hasSpun = false;
  state.selectedCard = null;
  state.viewingManagerId = managers[0].id;
  state.isProcessing = false;
  state.botPending = false;

  showScreen('screen-game');
  renderManagerTabs();
  renderPitch();
  updatePoolCount();
  clearDraftLog();
  addDraftLog('system', '🏟️ The Draft has begun! Good luck to all managers!');
  updateSpinSkipButtons();

  beginTurn();
}

// ═══════════════════════════════════════════════════════
//  TURN MANAGEMENT
// ═══════════════════════════════════════════════════════
function getCurrentManager() {
  return state.managers[state.currentTurnIndex];
}

function beginTurn() {
  const mgr = getCurrentManager();
  if (!mgr) return;

  state.hasSpun = false;
  state.drawnCards = [];
  state.selectedCard = null;

  // Auto-switch pitch view to current manager
  state.viewingManagerId = mgr.id;
  renderManagerTabs();
  renderPitch();
  updateTurnIndicator();
  updateSpinSkipButtons();

  // Clear spin area
  const area = document.getElementById('spin-cards-area');
  area.innerHTML = `
    <div class="col-span-2 sm:col-span-4 flex items-center justify-center h-full">
      <div class="text-center text-gray-600">
        <i class="fa-solid fa-layer-group text-5xl mb-3 opacity-50"></i>
        <p class="text-sm">Press <strong class="text-white">Spin</strong> to draw 4 cards</p>
      </div>
    </div>`;

  // Bot AI or Pass & Play
  if (mgr.isBot) {
    handleBotTurn(mgr);
  } else if (state.mode === 'multi' && state.currentTurnIndex > 0) {
    showPassPlay(mgr);
  }
}

function advanceTurn() {
  if (state.isProcessing) return;

  // Check if all managers are done
  const allDone = state.managers.every(m => m.done);
  if (allDone) {
    setTimeout(() => triggerTournament(), 800);
    return;
  }

  // Find next incomplete manager
  let next = (state.currentTurnIndex + 1) % state.managers.length;
  let tries = 0;
  while (state.managers[next].done && tries < state.managers.length) {
    next = (next + 1) % state.managers.length;
    tries++;
  }

  state.currentTurnIndex = next;
  beginTurn();
}

// ═══════════════════════════════════════════════════════
//  PASS & PLAY OVERLAY (Multiplayer)
// ═══════════════════════════════════════════════════════
function showPassPlay(mgr) {
  const overlay = document.getElementById('pass-play-overlay');
  const nameEl = document.getElementById('pass-name-display');
  const subEl = document.getElementById('pass-sub');
  const iconEl = document.getElementById('pass-icon');
  const btnEl = document.getElementById('pass-confirm-btn');

  nameEl.textContent = mgr.name;
  nameEl.style.color = mgr.color.hex;
  subEl.textContent = `Hand the device to ${mgr.name}`;
  iconEl.style.color = mgr.color.hex;
  btnEl.style.background = `linear-gradient(135deg, ${mgr.color.hex}cc, ${mgr.color.hex}88)`;
  btnEl.style.color = '#fff';
  btnEl.style.boxShadow = `0 0 20px ${mgr.color.hex}50`;

  overlay.classList.remove('hidden');
}

window.dismissPassPlay = function() {
  document.getElementById('pass-play-overlay').classList.add('hidden');
};

// ═══════════════════════════════════════════════════════
//  BOT AI TURN
// ═══════════════════════════════════════════════════════
async function handleBotTurn(mgr) {
  state.botPending = true;
  updateSpinSkipButtons();
  showBotLog(true, mgr);

  // Bot "thinks" before spinning
  await delay(botThinkDelay());

  // Bot spins
  playCardDeal();
  const drawn = drawCards(4);
  if (drawn.length === 0) {
    addDraftLog('bot', `🤖 ${mgr.name}: No cards left to draw. Skipping.`);
    state.botPending = false;
    advanceTurn();
    return;
  }
  state.drawnCards = drawn;
  renderSpinCards(drawn, true); // dimmed, no interaction

  // Bot evaluates
  await delay(botThinkDelay(true));

  const decision = botDecide(mgr, drawn);
  document.getElementById('bot-log-text').textContent = `${mgr.name}: ${decision.reason}`;

  if (decision.action === 'pick') {
    const player = drawn[decision.playerIndex];
    fillSlot(mgr, decision.slotKey, player);
    removeFromPool(player.id);
    playPick();
    addDraftLog('bot', `🤖 ${mgr.name} drafted ${player.name} (${player.ovr} OVR) → [${decision.slotKey}]`);

    // Highlight selected card briefly
    highlightBotPick(decision.playerIndex);
    await delay(800);

    if (mgr.done) {
      playWhistle();
      showToast(`🎉 ${mgr.name}'s squad is complete!`, 'success');
      addDraftLog('system', `✅ ${mgr.name} completed their 11-player squad!`);
    }
  } else {
    playSkip();
    addDraftLog('bot', `🤖 ${mgr.name} skipped (no matching positions in drawn cards).`);
  }

  state.botPending = false;
  renderPitch();
  renderManagerTabs();
  updatePoolCount();
  await delay(600);
  hideBotLog();
  advanceTurn();
}

// ═══════════════════════════════════════════════════════
//  SPIN HANDLER (Human Turn)
// ═══════════════════════════════════════════════════════
window.handleSpin = function() {
  if (state.hasSpun || state.isProcessing || state.botPending) return;
  const mgr = getCurrentManager();
  if (!mgr || mgr.done) return;

  playSpin();
  state.hasSpun = true;
  state.selectedCard = null;
  updateSpinSkipButtons();

  const drawn = drawCards(4);
  if (drawn.length === 0) {
    showToast('No more players in the pool!', 'warn');
    handleSkip();
    return;
  }
  state.drawnCards = drawn;
  renderSpinCards(drawn, false);
  updatePoolCount();
};

// ═══════════════════════════════════════════════════════
//  CARD PICK HANDLER
// ═══════════════════════════════════════════════════════
window.selectCard = function(idx) {
  if (!state.hasSpun || state.isProcessing || state.botPending) return;
  const mgr = getCurrentManager();
  if (!mgr || mgr.isBot) return;

  const player = state.drawnCards[idx];
  if (!player) return;

  const slotKey = findBestSlot(mgr, player);
  if (!slotKey) {
    showToast(`No empty slot for position: ${player.pos}`, 'warn');
    return;
  }

  // Confirm selection visually
  if (state.selectedCard === idx) {
    // Double-click or already selected → confirm pick
    confirmPick(idx, slotKey, player, mgr);
  } else {
    state.selectedCard = idx;
    renderSpinCards(state.drawnCards, false);
    showToast(`Click again to confirm: ${player.name}`, 'info');
  }
};

function confirmPick(idx, slotKey, player, mgr) {
  state.isProcessing = true;
  playPick();
  fillSlot(mgr, slotKey, player);
  removeFromPool(player.id);
  state.drawnCards = [];
  state.hasSpun = false;
  state.selectedCard = null;

  addDraftLog('pick', `⚽ ${mgr.name} drafted <strong>${player.name}</strong> (${player.ovr} OVR) → [${slotKey}]`);
  renderPitch();
  renderManagerTabs();
  updatePoolCount();
  updateSpinSkipButtons();

  if (mgr.done) {
    playWhistle();
    showToast(`🎉 ${mgr.name}'s squad is complete!`, 'success');
    addDraftLog('system', `✅ ${mgr.name} completed their 11-player squad!`);
    setTimeout(() => { state.isProcessing = false; advanceTurn(); }, 1000);
  } else {
    setTimeout(() => { state.isProcessing = false; advanceTurn(); }, 600);
  }
}

// ═══════════════════════════════════════════════════════
//  SKIP HANDLER
// ═══════════════════════════════════════════════════════
window.handleSkip = function() {
  if (!state.hasSpun || state.isProcessing || state.botPending) return;
  const mgr = getCurrentManager();
  if (!mgr || mgr.isBot) return;

  playSkip();
  state.drawnCards = [];
  state.hasSpun = false;
  state.selectedCard = null;

  addDraftLog('skip', `⏩ ${mgr.name} skipped this round.`);
  updateSpinSkipButtons();
  advanceTurn();
};

// ═══════════════════════════════════════════════════════
//  CARD POOL UTILITIES
// ═══════════════════════════════════════════════════════
function drawCards(n) {
  const drawn = [];
  for (let i = 0; i < n && state.playerPool.length > 0; i++) {
    drawn.push(state.playerPool.splice(0, 1)[0]);
  }
  return drawn;
}

function removeFromPool(playerId) {
  state.playerPool = state.playerPool.filter(p => p.id !== playerId);
}

function updatePoolCount() {
  const el = document.getElementById('pool-count');
  if (el) el.textContent = `${state.playerPool.length} cards remaining`;
}

// ═══════════════════════════════════════════════════════
//  UI: TURN INDICATOR
// ═══════════════════════════════════════════════════════
function updateTurnIndicator() {
  const el = document.getElementById('turn-indicator');
  if (!el) return;
  const mgr = getCurrentManager();
  if (!mgr) return;

  el.innerHTML = `
    <span class="w-2 h-2 rounded-full inline-block mr-1" style="background:${mgr.color.hex}"></span>
    ${mgr.isBot ? '<i class="fa-solid fa-robot mr-1 opacity-70"></i>' : ''}
    <span style="color:${mgr.color.hex}">${mgr.name}</span>&nbsp;
    <span class="text-gray-400">'s Turn</span>
  `;
  el.style.setProperty('--pulse-color', `${mgr.color.hex}66`);
  el.classList.add('pulsing');
  setTimeout(() => el.classList.remove('pulsing'), 2000);
}

// ═══════════════════════════════════════════════════════
//  UI: SPIN / SKIP BUTTONS
// ═══════════════════════════════════════════════════════
function updateSpinSkipButtons() {
  const btnSpin = document.getElementById('btn-spin');
  const btnSkip = document.getElementById('btn-skip');
  if (!btnSpin || !btnSkip) return;

  const mgr = getCurrentManager();
  const isBot = mgr?.isBot || state.botPending;
  const isBusy = state.isProcessing || state.botPending;

  btnSpin.disabled = state.hasSpun || isBusy || !mgr || mgr.done;
  btnSkip.disabled = !state.hasSpun || isBusy || !mgr || mgr.done;

  if (isBot) {
    btnSpin.innerHTML = `<div class="bot-thinking"><i class="fa-solid fa-robot bot-thinking-icon"></i><span>Bot Thinking</span><div class="spin-dots"><span></span><span></span><span></span></div></div>`;
    btnSkip.disabled = true;
  } else {
    btnSpin.innerHTML = `<i class="fa-solid fa-rotate-right"></i> <span class="font-teko text-xl">Putar / Spin</span>`;
  }
}

// ═══════════════════════════════════════════════════════
//  UI: RENDER MANAGER TABS
// ═══════════════════════════════════════════════════════
function renderManagerTabs() {
  const container = document.getElementById('manager-tabs');
  if (!container) return;

  const currentMgr = getCurrentManager();

  container.innerHTML = state.managers.map(mgr => {
    const filled = filledCount(mgr);
    const isActive = mgr.id === state.viewingManagerId;
    const isTurn = mgr.id === currentMgr?.id;

    return `
      <div class="mgr-tab ${isActive ? 'active-tab' : ''} ${mgr.isBot ? 'bot-tab' : ''}"
        style="--tab-color: ${mgr.color.hex}"
        onclick="viewManager(${mgr.id})">
        <span class="tab-dot" style="background:${mgr.color.hex}; ${!isTurn ? 'opacity:0.4' : ''}"></span>
        ${mgr.isBot ? '<i class="fa-solid fa-robot text-xs opacity-60"></i>' : ''}
        <span style="color: ${isActive ? '#fff' : '#6b7280'}">${mgr.name}</span>
        <span class="tab-filled">${filled}/11</span>
        ${isTurn ? `<span class="text-xs ml-1 animate-pulse" style="color:${mgr.color.hex}">●</span>` : ''}
      </div>
    `;
  }).join('');
}

window.viewManager = function(id) {
  state.viewingManagerId = id;
  renderManagerTabs();
  renderPitch();
};

// ═══════════════════════════════════════════════════════
//  UI: RENDER PITCH (2D Formation View)
// ═══════════════════════════════════════════════════════
function renderPitch() {
  const mgr = state.managers.find(m => m.id === state.viewingManagerId);
  if (!mgr) return;

  // Update header info
  const nameEl = document.getElementById('pitch-manager-name');
  const ovrEl = document.getElementById('pitch-ovr');
  const chemEl = document.getElementById('pitch-chem');

  if (nameEl) {
    nameEl.innerHTML = `<span style="color:${mgr.color.hex}">${mgr.name}</span>'s Squad`;
  }

  const ovr = calcAverageOvr(mgr);
  const chem = calcChemistry(mgr);
  if (ovrEl) ovrEl.textContent = ovr || '—';
  if (chemEl) {
    chemEl.textContent = chem > 0 ? `${chem}%` : '—';
    chemEl.style.color = chem > 0 ? chemColor(chem) : '#6b7280';
  }

  // Render pitch slots
  const pitchEl = document.getElementById('pitch-slots');
  if (!pitchEl) return;

  // Add pitch markings
  pitchEl.innerHTML = `
    <div class="pitch-marking-center"></div>
    <div class="pitch-marking-penalty top"></div>
    <div class="pitch-marking-penalty bottom"></div>
  `;

  // Add each slot
  FORMATION_SLOTS.forEach(slot => {
    const player = mgr.slots[slot.key];
    const slotDiv = document.createElement('div');
    slotDiv.className = `pos-slot ${player ? 'filled' : ''}`;
    slotDiv.style.left = `${slot.x}%`;
    slotDiv.style.top = `${slot.y}%`;

    if (player) {
      slotDiv.innerHTML = buildMiniCard(player);
      slotDiv.title = `${player.name} (${player.ovr} OVR) — ${player.club}`;
    } else {
      const posIcon = getPositionIcon(slot.pos);
      slotDiv.innerHTML = `
        <div class="slot-empty">
          <span class="slot-icon">${posIcon}</span>
          <span>${slot.label}</span>
        </div>
      `;
    }

    pitchEl.appendChild(slotDiv);
  });
}

function getPositionIcon(pos) {
  switch(pos) {
    case 'GK': return '🧤';
    case 'DEF': return '🛡️';
    case 'MID': return '⚙️';
    case 'ATT': return '⚡';
    default: return '👤';
  }
}

// ── Build mini FUT card HTML ───────────────────────────
function buildMiniCard(player) {
  const cardClass = `card-${player.cardType}`;
  return `
    <div class="fut-mini-card ${cardClass}">
      <div class="card-top">
        <span class="card-ovr">${player.ovr}</span>
        <span class="card-pos-badge">${player.pos}</span>
      </div>
      <img
        class="card-face"
        src="${player.faceUrl}"
        alt="${player.name}"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        loading="lazy"
      />
      <div class="card-face-fallback" style="display:none">
        ${getPositionIcon(player.pos)}
      </div>
      <div class="card-name">${player.name}</div>
      <div class="card-flag">${player.flag}</div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
//  UI: RENDER SPIN CARDS (Draft Pool Display)
// ═══════════════════════════════════════════════════════
function renderSpinCards(cards, dimAll) {
  const area = document.getElementById('spin-cards-area');
  if (!area) return;

  area.innerHTML = cards.map((player, idx) => {
    const cardClass = `card-${player.cardType}`;
    const isSelected = state.selectedCard === idx;
    const isDimmed = dimAll || (state.selectedCard !== null && !isSelected);
    const mgr = getCurrentManager();
    const canPlace = !dimAll && mgr && !mgr.isBot && !!findBestSlot(mgr, player);

    return `
      <div class="draft-card ${cardClass} ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''} ${!canPlace && !dimAll ? 'opacity-60 cursor-not-allowed' : ''}"
        onclick="${!dimAll ? `selectCard(${idx})` : ''}"
        style="animation-delay:${idx * 0.07}s"
        title="${player.name} — ${player.club} (${player.nat})"
      >
        <div class="dc-badge">${player.cardType === 'legend' ? 'LEGEND' : player.cardType === 'special' ? 'SPECIAL' : player.cardType === 'gold' ? 'GOLD' : ''}</div>
        <div class="dc-ovr-pos">
          <span class="dc-ovr">${player.ovr}</span>
          <span class="dc-pos">${player.pos}</span>
        </div>
        <div class="dc-face-wrap">
          <img
            class="dc-face"
            src="${player.faceUrl}"
            alt="${player.name}"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            loading="lazy"
          />
          <div class="dc-face-fallback" style="display:none">
            ${getPositionIcon(player.pos)}
          </div>
        </div>
        <div class="dc-info">
          <div class="dc-name">${player.name}</div>
          <div class="dc-club">${player.club}</div>
          <div class="dc-flag-row">
            <span class="dc-flag">${player.flag}</span>
            <span class="dc-nat">${player.nat}</span>
          </div>
        </div>
        ${!dimAll ? `<div class="dc-pick-btn">✔ Pick!</div>` : ''}
      </div>
    `;
  }).join('');
}

function highlightBotPick(idx) {
  const cards = document.querySelectorAll('.draft-card');
  cards.forEach((card, i) => {
    if (i === idx) {
      card.classList.add('selected');
      card.classList.remove('dimmed');
    } else {
      card.classList.add('dimmed');
    }
  });
}

// ═══════════════════════════════════════════════════════
//  UI: BOT LOG
// ═══════════════════════════════════════════════════════
function showBotLog(thinking, mgr) {
  const box = document.getElementById('bot-log-box');
  const text = document.getElementById('bot-log-text');
  if (box) box.classList.remove('hidden');
  if (text) {
    if (thinking) {
      text.innerHTML = `<div class="bot-thinking" style="color:${mgr.color.hex}">
        <i class="fa-solid fa-robot bot-thinking-icon"></i>
        <span>${mgr.name} is thinking</span>
        <div class="spin-dots"><span></span><span></span><span></span></div>
      </div>`;
    }
  }
}

function hideBotLog() {
  setTimeout(() => {
    const box = document.getElementById('bot-log-box');
    if (box) box.classList.add('hidden');
  }, 2000);
}

// ═══════════════════════════════════════════════════════
//  UI: DRAFT LOG
// ═══════════════════════════════════════════════════════
function addDraftLog(type, message) {
  const container = document.getElementById('draft-log');
  if (!container) return;

  const icons = {
    pick: '<i class="log-icon fa-solid fa-check text-green-400"></i>',
    skip: '<i class="log-icon fa-solid fa-forward text-gray-500"></i>',
    bot:  '<i class="log-icon fa-solid fa-robot text-purple-400"></i>',
    system: '<i class="log-icon fa-solid fa-circle-info text-yellow-400"></i>',
  };

  const div = document.createElement('div');
  div.className = `log-entry log-${type}`;
  div.innerHTML = `${icons[type] || ''}<span>${message}</span>`;

  // Remove placeholder
  const placeholder = container.querySelector('p');
  if (placeholder) placeholder.remove();

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function clearDraftLog() {
  const el = document.getElementById('draft-log');
  if (el) el.innerHTML = '<p class="text-gray-600 text-sm">Draft events will appear here...</p>';
}

// ═══════════════════════════════════════════════════════
//  TOURNAMENT
// ═══════════════════════════════════════════════════════
function triggerTournament() {
  playWhistle();
  showToast('🏆 All squads complete! Running tournament...', 'info', 3000);

  setTimeout(() => {
    const { standings, matches } = runTournament(state.managers);
    renderTournamentScreen(standings, matches);
    showScreen('screen-tournament');

    setTimeout(() => {
      if (standings[0]) {
        launchVictoryCelebration(standings[0].color);
      }
    }, 800);
  }, 1200);
}

function renderTournamentScreen(standings, matches) {
  // Champion banner
  const champion = standings[0];
  const champName = document.getElementById('champion-name');
  const champSub = document.getElementById('champion-sub');
  const champBanner = document.getElementById('champion-banner');

  if (champName) {
    champName.textContent = champion.name;
    champName.style.color = champion.color.hex;
  }
  if (champSub) {
    const ovr = calcAverageOvr(champion.manager);
    const chem = calcChemistry(champion.manager);
    champSub.textContent = `OVR: ${ovr} | Chemistry: ${chem}% | ${champion.wins}W-${champion.draws}D-${champion.losses}L`;
  }
  if (champBanner) {
    champBanner.style.borderColor = `${champion.color.hex}60`;
  }

  // Leaderboard
  const tbody = document.getElementById('leaderboard-body');
  if (tbody) {
    tbody.innerHTML = standings.map((entry, i) => renderLeaderboardRow(entry, i + 1)).join('');
  }

  // Match results
  const matchLog = document.getElementById('match-results-log');
  if (matchLog) {
    matchLog.innerHTML = matches.map(m => renderMatchRow(m, state.managers)).join('');
  }

  // Squad showcase
  const showcase = document.getElementById('squad-showcase');
  if (showcase) {
    showcase.innerHTML = standings.map(entry => renderSquadShowcase(entry)).join('');
  }
}

function renderSquadShowcase(entry) {
  const mgr = entry.manager;
  const ovr = calcAverageOvr(mgr);
  const chem = calcChemistry(mgr);

  const playerRows = FORMATION_SLOTS.map(slot => {
    const p = mgr.slots[slot.key];
    if (!p) return `
      <div class="squad-player-row">
        <span class="sp-pos" style="color:rgba(255,255,255,0.3)">${slot.label}</span>
        <span class="sp-name text-gray-700">— Empty —</span>
      </div>`;
    const ovrColor = p.ovr >= 90 ? '#f59e0b' : p.ovr >= 85 ? '#10b981' : '#9ca3af';
    return `
      <div class="squad-player-row">
        <span class="sp-pos">${slot.label}</span>
        <span class="sp-flag">${p.flag}</span>
        <span class="sp-name">${p.name}</span>
        <span class="sp-ovr" style="color:${ovrColor}">${p.ovr}</span>
      </div>`;
  }).join('');

  return `
    <div class="squad-card" style="border-color:${entry.color.hex}30">
      <div class="sq-header">
        <span class="sq-dot" style="background:${entry.color.hex}"></span>
        <span class="sq-name" style="color:${entry.color.hex}">${mgr.name}</span>
        ${mgr.isBot ? '<span class="text-xs text-purple-400"><i class="fa-solid fa-robot"></i> Bot</span>' : ''}
        <span class="sq-stats">OVR ${ovr} · ${chem}% Chem</span>
      </div>
      <div class="sq-players">${playerRows}</div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
//  QUIT & RESET
// ═══════════════════════════════════════════════════════
window.confirmQuit = function() { openModal('modal-quit'); };

window.resetToLanding = function() {
  closeModal('modal-quit');
  // Reset state
  state = {
    mode: null, managers: [], playerPool: [], drawnCards: [],
    currentTurnIndex: 0, hasSpun: false, selectedCard: null,
    viewingManagerId: 0, isProcessing: false, botPending: false,
    soloBots: 1, multiPlayers: 2,
  };
  showScreen('screen-landing');
};

// ═══════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════
window.showToast = function(message, type = 'info', duration = 2500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '<i class="fa-solid fa-check-circle text-green-400"></i>',
    error:   '<i class="fa-solid fa-circle-xmark text-red-400"></i>',
    warn:    '<i class="fa-solid fa-triangle-exclamation text-amber-400"></i>',
    info:    '<i class="fa-solid fa-circle-info text-blue-400"></i>',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${icons[type] || ''}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 350);
  }, duration);
};

// ═══════════════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════════════
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
(function init() {
  showScreen('screen-landing');
  renderMultiNameInputs(); // pre-render with 2 players
})();
