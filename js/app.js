// ═══════════════════════════════════════════════════════
//  app.js — Main Application Controller
//  UI Rendering, Event Handlers, Game Loop, Multi-Transport Online
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
import { onlineEngine } from './onlineEngine.js';

// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
let state = {
  mode: null,          // 'solo' | 'multi' | 'online'
  managers: [],        // array of manager objects
  playerPool: [],      // remaining undrafted players
  drawnCards: [],      // current 4 cards on table
  currentTurnIndex: 0, // index into managers array
  hasSpun: false,      // whether spin happened this turn
  selectedCard: null,  // index of selected card (pending pick)
  viewingManagerId: 0, // which manager's pitch we're showing
  isProcessing: false, // guard against double-clicks
  botPending: false,   // bot turn is in progress
  // Config:
  soloBots: 1,
  multiPlayers: 2,
  onlineMaxPlayers: 2,
  onlineTab: 'host',   // 'host' | 'join'
};

// Helper: Multi-tier high-availability CDN proxy for player face photos
function getFaceUrl(player) {
  if (!player || !player.faceUrl) return '';
  const clean = player.faceUrl.replace(/^https?:\/\//, '');
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=150&output=webp`;
}

function getFallbackBadge(player) {
  const cleanName = encodeURIComponent(player.name.replace(/[^a-zA-Z\s]/g, ''));
  const bg = player.pos === 'GK' ? 'D97706' : player.pos === 'DEF' ? '2563EB' : player.pos === 'MID' ? '059669' : 'DC2626';
  return `https://ui-avatars.com/api/?name=${cleanName}&background=${bg}&color=ffffff&bold=true&size=120&font-size=0.4`;
}

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
//  LOCAL MULTI CONFIG (Pass & Play)
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
//  ONLINE MULTIPLAYER CONFIG (Host & Join Multi-Transport)
// ═══════════════════════════════════════════════════════
window.showOnlineConfig = function() {
  openModal('modal-online');
  switchOnlineTab('host');
};

window.closeOnlineModal = function() {
  closeModal('modal-online');
};

window.switchOnlineTab = function(tab) {
  state.onlineTab = tab;
  const hostBtn = document.getElementById('tab-btn-host');
  const joinBtn = document.getElementById('tab-btn-join');
  const hostContent = document.getElementById('online-host-content');
  const joinContent = document.getElementById('online-join-content');

  if (tab === 'host') {
    hostBtn.className = 'flex-1 py-2.5 rounded-lg font-teko text-2xl font-bold transition-all text-white bg-gradient-to-r from-cyan-600 to-blue-600 shadow-glow-cyan-sm';
    joinBtn.className = 'flex-1 py-2.5 rounded-lg font-teko text-2xl font-bold transition-all text-gray-400 hover:text-white';
    hostContent.classList.remove('hidden');
    joinContent.classList.add('hidden');
  } else {
    joinBtn.className = 'flex-1 py-2.5 rounded-lg font-teko text-2xl font-bold transition-all text-white bg-gradient-to-r from-purple-600 to-indigo-600 shadow-glow-purple-sm';
    hostBtn.className = 'flex-1 py-2.5 rounded-lg font-teko text-2xl font-bold transition-all text-gray-400 hover:text-white';
    joinContent.classList.remove('hidden');
    hostContent.classList.add('hidden');
  }
};

window.selectOnlineMaxPlayers = function(n) {
  state.onlineMaxPlayers = n;
  document.querySelectorAll('.online-p-btn').forEach(btn => {
    btn.classList.toggle('active-online-btn', parseInt(btn.dataset.p) === n);
  });
};

// ── HOST CREATES ROOM ─────────────────────────────────
window.handleCreateRoom = async function() {
  const nameInput = document.getElementById('online-host-name');
  const hostName = (nameInput.value.trim() || 'Host Manager').substring(0, 20);
  const btnCreate = document.getElementById('btn-create-room');

  btnCreate.disabled = true;
  btnCreate.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Generating Room...`;

  try {
    const code = await onlineEngine.createRoom(hostName, state.onlineMaxPlayers);
    document.getElementById('display-room-code').textContent = code;
    document.getElementById('host-lobby-area').classList.remove('hidden');
    document.getElementById('btn-start-online-game').classList.remove('hidden');
    btnCreate.classList.add('hidden');

    renderLobbyPlayerList(onlineEngine.joinedPlayers);
    showToast(`🌐 Room ${code} Ready! Share code with your friends.`, 'success');
  } catch (err) {
    showToast(`Room creation: ${err.message || 'Ready'}`, 'info');
    btnCreate.disabled = false;
    btnCreate.innerHTML = `<i class="fa-solid fa-plus-circle mr-2"></i>Create Room`;
  }
};

// ── OPEN 2P TEST WINDOW INSTANTLY ─────────────────────
window.openTestWindow = function() {
  const code = document.getElementById('display-room-code')?.textContent;
  if (!code || code === 'FUT-XXXX') return;
  const url = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(code)}`;
  window.open(url, '_blank', 'width=1100,height=750');
  showToast(`🚀 Opened 2P Test Window for ${code}!`, 'success');
};

// ── COPY ROOM CODE ─────────────────────────────────────
window.copyRoomCode = function() {
  const code = document.getElementById('display-room-code').textContent;
  if (!code || code === 'FUT-XXXX') return;

  navigator.clipboard.writeText(code).then(() => {
    const icon = document.getElementById('copy-icon');
    if (icon) {
      icon.className = 'fa-solid fa-check text-green-400 text-lg';
      setTimeout(() => { icon.className = 'fa-solid fa-copy text-lg'; }, 2000);
    }
    showToast(`📋 Room Code ${code} copied to clipboard!`, 'info');
  }).catch(() => {
    showToast(`Room Code: ${code}`, 'info');
  });
};

// ── JOIN ROOM ──────────────────────────────────────────
window.handleJoinRoom = async function(presetCode = null) {
  const nameInput = document.getElementById('online-join-name');
  const codeInput = document.getElementById('online-room-code-input');
  const playerName = (nameInput?.value.trim() || 'Player 2').substring(0, 20);
  const roomCode = presetCode || codeInput?.value.trim().toUpperCase();

  if (!roomCode || roomCode.length < 4) {
    showToast('Please enter a valid Room Code (e.g. FUT-8X9K)', 'warn');
    return;
  }

  const btnJoin = document.getElementById('btn-join-room');
  const statusBox = document.getElementById('join-status-box');

  if (btnJoin) btnJoin.disabled = true;
  if (statusBox) statusBox.classList.remove('hidden');

  try {
    const joinedCode = await onlineEngine.joinRoom(playerName, roomCode);
    showToast(`Connected to Room ${joinedCode}! Waiting for Host to start...`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to connect to room. Check the code and try again.', 'error');
    if (btnJoin) btnJoin.disabled = false;
    if (statusBox) statusBox.classList.add('hidden');
    return;
  }
};

// ── RENDER LOBBY LIST (HOST) ───────────────────────────
function renderLobbyPlayerList(players) {
  const listEl = document.getElementById('lobby-player-list');
  const countEl = document.getElementById('lobby-player-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `${players.length} / ${state.onlineMaxPlayers}`;

  listEl.innerHTML = players.map((p, idx) => {
    const color = MANAGER_COLORS[idx] || MANAGER_COLORS[0];
    return `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
        <div class="flex items-center gap-2.5">
          <span class="w-3 h-3 rounded-full" style="background:${color.hex}"></span>
          <span class="font-semibold text-white">${p.name}</span>
          ${p.isHost ? '<span class="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded uppercase font-extrabold">HOST</span>' : ''}
        </div>
        <span class="flex items-center gap-1.5 text-xs text-emerald-400">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Connected
        </span>
      </div>
    `;
  }).join('');
}

// ── HOST STARTS ONLINE GAME ───────────────────────────
window.handleStartOnlineGame = function() {
  if (!onlineEngine.isHost) return;

  const pool = buildPlayerPool();
  const managers = onlineEngine.joinedPlayers.map((p, idx) => {
    return createManager(idx, p.name, false);
  });

  const initialState = {
    managers,
    playerPool: pool,
    currentTurnIndex: 0,
    roomCode: onlineEngine.roomCode,
  };

  onlineEngine.startOnlineGame(initialState);
};

// ── SETUP ONLINE ENGINE CALLBACKS ──────────────────────
function setupOnlineCallbacks() {
  onlineEngine.onLobbyUpdate = (players) => {
    renderLobbyPlayerList(players);
  };

  onlineEngine.onGameStart = (payload) => {
    closeModal('modal-online');
    const { state: initData } = payload;

    state.mode = 'online';
    state.managers = initData.managers;
    state.playerPool = initData.playerPool;
    state.drawnCards = [];
    state.currentTurnIndex = initData.currentTurnIndex;
    state.hasSpun = false;
    state.selectedCard = null;
    state.viewingManagerId = state.managers[0].id;
    state.isProcessing = false;
    state.botPending = false;

    const badge = document.getElementById('online-room-badge');
    const codeEl = document.getElementById('header-room-code');
    if (badge) badge.classList.remove('hidden');
    if (codeEl) codeEl.textContent = onlineEngine.roomCode || 'ONLINE P2P';

    showScreen('screen-game');
    renderManagerTabs();
    renderPitch();
    updatePoolCount();
    clearDraftLog();
    addDraftLog('system', `🌐 Online Room ${onlineEngine.roomCode} Started!`);
    updateSpinSkipButtons();

    beginTurn();
  };

  onlineEngine.onActionReceived = (action) => {
    handleRemoteAction(action);
  };

  onlineEngine.onPlayerDisconnect = (msg) => {
    showToast(`⚠️ ${msg}`, 'error');
    addDraftLog('system', `⚠️ Connection alert: ${msg}`);
  };
}

// ── HANDLE REMOTE ACTIONS OVER MULTI-TRANSPORT ────────
function handleRemoteAction(action) {
  const { type, slotKey, player, managerId } = action;

  if (type === 'SPIN') {
    state.hasSpun = true;
    state.drawnCards = action.drawnCards;
    state.playerPool = action.remainingPool;
    playSpin();
    renderSpinCards(state.drawnCards, !isMyTurn());
    updatePoolCount();
    updateSpinSkipButtons();
    addDraftLog('online', `🎲 ${state.managers[state.currentTurnIndex]?.name} spun 4 cards.`);
  } else if (type === 'PICK') {
    const mgr = state.managers.find(m => m.id === managerId);
    if (mgr && player) {
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
      }

      advanceTurnRemote();
    }
  } else if (type === 'SKIP') {
    const mgr = state.managers.find(m => m.id === managerId);
    playSkip();
    state.drawnCards = [];
    state.hasSpun = false;
    state.selectedCard = null;
    addDraftLog('skip', `⏩ ${mgr?.name || 'Player'} skipped this round.`);
    updateSpinSkipButtons();
    advanceTurnRemote();
  }
}

function advanceTurnRemote() {
  const allDone = state.managers.every(m => m.done);
  if (allDone) {
    setTimeout(() => triggerTournament(), 800);
    return;
  }

  let next = (state.currentTurnIndex + 1) % state.managers.length;
  let tries = 0;
  while (state.managers[next].done && tries < state.managers.length) {
    next = (next + 1) % state.managers.length;
    tries++;
  }

  state.currentTurnIndex = next;
  beginTurn();
}

function isMyTurn() {
  if (state.mode !== 'online') return true;
  const currentMgr = getCurrentManager();
  return currentMgr?.id === onlineEngine.myId;
}

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

  const badge = document.getElementById('online-room-badge');
  if (badge) badge.classList.add('hidden');

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

  state.viewingManagerId = mgr.id;
  renderManagerTabs();
  renderPitch();
  updateTurnIndicator();
  updateSpinSkipButtons();

  const area = document.getElementById('spin-cards-area');
  const myTurn = isMyTurn();

  area.innerHTML = `
    <div class="col-span-2 sm:col-span-4 flex items-center justify-center h-full">
      <div class="text-center text-gray-600">
        <i class="fa-solid fa-layer-group text-5xl mb-3 opacity-50"></i>
        <p class="text-sm">${myTurn ? 'Press <strong class="text-white">Spin</strong> to draw 4 cards' : `Waiting for <strong class="text-cyan-400">${mgr.name}</strong> to spin...`}</p>
      </div>
    </div>`;

  if (mgr.isBot) {
    handleBotTurn(mgr);
  } else if (state.mode === 'multi' && (state.currentTurnIndex > 0 || mgr.spinsDone > 0)) {
    showPassPlay(mgr);
  }
}

function advanceTurn() {
  if (state.isProcessing) return;

  const allDone = state.managers.every(m => m.done);
  if (allDone) {
    setTimeout(() => triggerTournament(), 800);
    return;
  }

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

  await delay(botThinkDelay());

  playCardDeal();
  const drawn = drawCards(4);
  if (drawn.length === 0) {
    addDraftLog('bot', `🤖 ${mgr.name}: No cards left to draw. Skipping.`);
    state.botPending = false;
    advanceTurn();
    return;
  }
  state.drawnCards = drawn;
  renderSpinCards(drawn, true);

  await delay(botThinkDelay(true));

  const decision = botDecide(mgr, drawn);
  document.getElementById('bot-log-text').textContent = `${mgr.name}: ${decision.reason}`;

  if (decision.action === 'pick') {
    const player = drawn[decision.playerIndex];
    fillSlot(mgr, decision.slotKey, player);
    removeFromPool(player.id);
    playPick();
    addDraftLog('bot', `🤖 ${mgr.name} drafted ${player.name} (${player.ovr} OVR) → [${decision.slotKey}]`);

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

  renderPitch();
  renderManagerTabs();
  updatePoolCount();
  await delay(600);
  state.botPending = false;
  hideBotLog();
  advanceTurn();
}

// ═══════════════════════════════════════════════════════
//  SPIN HANDLER (Human & Online Turn)
// ═══════════════════════════════════════════════════════
window.handleSpin = function() {
  if (state.hasSpun || state.isProcessing || state.botPending) return;
  const mgr = getCurrentManager();
  if (!mgr || mgr.done) return;

  if (state.mode === 'online' && !isMyTurn()) {
    showToast(`It's ${mgr.name}'s turn online!`, 'warn');
    return;
  }

  playSpin();
  state.hasSpun = true;
  state.selectedCard = null;

  const drawn = drawCards(4);
  if (drawn.length === 0) {
    showToast('No more players in the pool!', 'warn');
    state.hasSpun = true;
    handleSkip();
    return;
  }
  state.drawnCards = drawn;
  renderSpinCards(drawn, false);
  updatePoolCount();
  updateSpinSkipButtons();

  if (state.mode === 'online') {
    onlineEngine.sendAction({
      type: 'SPIN',
      managerId: mgr.id,
      drawnCards: drawn,
      remainingPool: state.playerPool,
    });
  }
};

// ═══════════════════════════════════════════════════════
//  CARD PICK HANDLER
// ═══════════════════════════════════════════════════════
window.selectCard = function(idx) {
  if (!state.hasSpun || state.isProcessing || state.botPending) return;
  const mgr = getCurrentManager();
  if (!mgr || mgr.isBot) return;

  if (state.mode === 'online' && !isMyTurn()) {
    showToast(`It's ${mgr.name}'s turn online!`, 'warn');
    return;
  }

  const player = state.drawnCards[idx];
  if (!player) return;

  const slotKey = findBestSlot(mgr, player);
  if (!slotKey) {
    showToast(`No empty slot for position: ${player.pos}`, 'warn');
    return;
  }

  if (state.selectedCard === idx) {
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

  if (state.mode === 'online') {
    onlineEngine.sendAction({
      type: 'PICK',
      managerId: mgr.id,
      slotKey,
      player,
    });
  }

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

  if (state.mode === 'online' && !isMyTurn()) {
    showToast(`It's ${mgr.name}'s turn online!`, 'warn');
    return;
  }

  playSkip();
  state.drawnCards = [];
  state.hasSpun = false;
  state.selectedCard = null;

  addDraftLog('skip', `⏩ ${mgr.name} skipped this round.`);
  updateSpinSkipButtons();

  if (state.mode === 'online') {
    onlineEngine.sendAction({
      type: 'SKIP',
      managerId: mgr.id,
    });
  }

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

  const myTurn = isMyTurn();

  el.innerHTML = `
    <span class="w-2 h-2 rounded-full inline-block mr-1" style="background:${mgr.color.hex}"></span>
    ${mgr.isBot ? '<i class="fa-solid fa-robot mr-1 opacity-70"></i>' : ''}
    <span style="color:${mgr.color.hex}">${mgr.name}</span>&nbsp;
    <span class="text-gray-400">${state.mode === 'online' ? (myTurn ? '(Your Turn!)' : '(Waiting online...)') : "'s Turn"}</span>
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
  const myTurn = isMyTurn();

  btnSpin.disabled = state.hasSpun || isBusy || !mgr || mgr.done || !myTurn;
  btnSkip.disabled = !state.hasSpun || isBusy || !mgr || mgr.done || !myTurn;

  if (isBot) {
    btnSpin.innerHTML = `<div class="bot-thinking"><i class="fa-solid fa-robot bot-thinking-icon"></i><span>Bot Thinking</span><div class="spin-dots"><span></span><span></span><span></span></div></div>`;
    btnSkip.disabled = true;
  } else if (state.mode === 'online' && !myTurn) {
    btnSpin.innerHTML = `<div class="flex items-center justify-center gap-2 text-cyan-300 font-teko text-xl"><i class="fa-solid fa-hourglass fa-spin"></i> Waiting for ${mgr?.name || 'Player'}...</div>`;
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

  const pitchEl = document.getElementById('pitch-slots');
  if (!pitchEl) return;

  pitchEl.innerHTML = `
    <div class="pitch-marking-center"></div>
    <div class="pitch-marking-penalty top"></div>
    <div class="pitch-marking-penalty bottom"></div>
  `;

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

function buildMiniCard(player) {
  const cardClass = `card-${player.cardType}`;
  const faceImg = getFaceUrl(player);
  const fallbackBadge = getFallbackBadge(player);

  return `
    <div class="fut-mini-card ${cardClass}">
      <div class="card-top">
        <span class="card-ovr">${player.ovr}</span>
        <span class="card-pos-badge">${player.pos}</span>
      </div>
      <img
        class="card-face"
        src="${faceImg}"
        alt="${player.name}"
        onerror="if(!this.dataset.t1){this.dataset.t1=1; this.src='${player.faceUrl}';}else if(!this.dataset.t2){this.dataset.t2=1; const m='${player.faceUrl}'.match(/players\/(\d+)\/(\d+)/); const id=m?(m[1]+m[2]):'0'; this.src='https://images.futbin.com/25/players/'+id+'.png';}else{this.src='${fallbackBadge}';}"
        loading="lazy"
      />
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

  const myTurn = isMyTurn();

  area.innerHTML = cards.map((player, idx) => {
    const cardClass = `card-${player.cardType}`;
    const isSelected = state.selectedCard === idx;
    const isDimmed = dimAll || (state.selectedCard !== null && !isSelected);
    const mgr = getCurrentManager();
    const canPlace = !dimAll && mgr && !mgr.isBot && myTurn && !!findBestSlot(mgr, player);
    const faceImg = getFaceUrl(player);
    const fallbackBadge = getFallbackBadge(player);

    return `
      <div class="draft-card ${cardClass} ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''} ${!canPlace && !dimAll ? 'opacity-60 cursor-not-allowed' : ''}"
        onclick="${!dimAll && myTurn ? `selectCard(${idx})` : ''}"
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
            src="${faceImg}"
            alt="${player.name}"
            onerror="if(!this.dataset.t1){this.dataset.t1=1; this.src='${player.faceUrl}';}else if(!this.dataset.t2){this.dataset.t2=1; const m='${player.faceUrl}'.match(/players\/(\d+)\/(\d+)/); const id=m?(m[1]+m[2]):'0'; this.src='https://images.futbin.com/25/players/'+id+'.png';}else{this.src='${fallbackBadge}';}"
            loading="lazy"
          />
        </div>
        <div class="dc-info">
          <div class="dc-name">${player.name}</div>
          <div class="dc-club">${player.club}</div>
          <div class="dc-flag-row">
            <span class="dc-flag">${player.flag}</span>
            <span class="dc-nat">${player.nat}</span>
          </div>
        </div>
        ${!dimAll && myTurn ? `<div class="dc-pick-btn">✔ Pick!</div>` : ''}
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
    online: '<i class="log-icon fa-solid fa-globe text-cyan-400"></i>',
  };

  const div = document.createElement('div');
  div.className = `log-entry log-${type}`;
  div.innerHTML = `${icons[type] || ''}<span>${message}</span>`;

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

  const tbody = document.getElementById('leaderboard-body');
  if (tbody) {
    tbody.innerHTML = standings.map((entry, i) => renderLeaderboardRow(entry, i + 1)).join('');
  }

  const matchLog = document.getElementById('match-results-log');
  if (matchLog) {
    matchLog.innerHTML = matches.map(m => renderMatchRow(m, state.managers)).join('');
  }

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
  onlineEngine.disconnect();
  state = {
    mode: null, managers: [], playerPool: [], drawnCards: [],
    currentTurnIndex: 0, hasSpun: false, selectedCard: null,
    viewingManagerId: 0, isProcessing: false, botPending: false,
    soloBots: 1, multiPlayers: 2, onlineMaxPlayers: 2, onlineTab: 'host',
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
  renderMultiNameInputs();
  setupOnlineCallbacks();

  // Check URL params for quick join e.g. ?join=FUT-8X9K
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get('join');
  if (joinCode) {
    showOnlineConfig();
    switchOnlineTab('join');
    const input = document.getElementById('online-room-code-input');
    if (input) input.value = joinCode;
    setTimeout(() => window.handleJoinRoom(joinCode), 500);
  }
})();
