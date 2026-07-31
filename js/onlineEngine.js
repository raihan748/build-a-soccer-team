// ═══════════════════════════════════════════════════════
//  onlineEngine.js — Multi-Transport Realtime Engine
//  WebRTC PeerJS + Firebase Realtime DB + BroadcastChannel + LocalStorage
// ═══════════════════════════════════════════════════════

/* global Peer, firebase */

const STUN_TURN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN Relay fallback for strict NAT/Mobile networks
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelay', credential: 'openrelay' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelay', credential: 'openrelay' },
  ]
};

class OnlineEngine {
  constructor() {
    this.peer = null;
    this.connections = new Map();
    this.hostConn = null;
    this.isHost = false;
    this.roomCode = null;
    this.myPeerId = null;
    this.myPlayerName = '';
    this.myId = 0;
    this.joinedPlayers = [];
    this.maxPlayers = 2;
    this.broadcastChannel = null;
    this.storageListener = null;
    this.firebaseDb = null;
    this.firebaseRoomRef = null;

    this.onLobbyUpdate = null;
    this.onGameStart = null;
    this.onActionReceived = null;
    this.onPlayerDisconnect = null;
    this.onStatusChange = null;
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `FUT-${code}`;
  }

  normalizeCode(raw) {
    if (!raw) return '';
    let clean = raw.trim().toUpperCase();
    clean = clean.replace(/^FUT-?/, '');
    return clean.replace(/[^A-Z0-9]/g, '');
  }

  // ── FIREBASE REALTIME DB SYNC (ZERO-CONFIG MULTIPLAYER) ──
  initFirebase(customConfig = null) {
    if (typeof firebase === 'undefined') return false;
    try {
      if (!firebase.apps || !firebase.apps.length) {
        const cfg = customConfig || {
          databaseURL: 'https://fut-draft-default-rtdb.asia-southeast1.firebasedatabase.app'
        };
        firebase.initializeApp(cfg);
      }
      this.firebaseDb = firebase.database();
      return true;
    } catch (e) {
      console.warn('Firebase init notice:', e.message);
      return false;
    }
  }

  setupFirebaseSync(roomCode) {
    const clean = this.normalizeCode(roomCode);
    if (!clean) return;
    this.initFirebase();

    if (!this.firebaseDb) return;

    try {
      this.firebaseRoomRef = this.firebaseDb.ref(`rooms/${clean}`);

      // Listen for room updates from Firebase
      this.firebaseRoomRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (!val) return;

        if (val.players && Array.isArray(val.players)) {
          this.joinedPlayers = val.players;
          if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
        }

        if (val.gameState && !this.isHost) {
          if (this.onGameStart) this.onGameStart(val.gameState);
        }

        if (val.lastAction && val.lastAction._sender !== this.myPeerId) {
          if (this.onActionReceived) this.onActionReceived(val.lastAction.action);
        }
      });
    } catch (err) {
      console.warn('Firebase Sync Notice:', err);
    }
  }

  initLocalChannels(roomCode) {
    const clean = this.normalizeCode(roomCode);
    if (!clean) return;
    const channelName = `fut_room_${clean}`;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        if (this.broadcastChannel) this.broadcastChannel.close();
        this.broadcastChannel = new BroadcastChannel(channelName);
        this.broadcastChannel.onmessage = (e) => this.handleChannelMessage(e.data);
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    if (this.storageListener) window.removeEventListener('storage', this.storageListener);
    this.storageListener = (e) => {
      if (e.key === channelName && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          this.handleChannelMessage(data);
        } catch (err) { /* ignore */ }
      }
    };
    window.addEventListener('storage', this.storageListener);

    // Also setup Firebase RTDB sync for 100% guaranteed cross-device play
    this.setupFirebaseSync(roomCode);
  }

  sendLocal(data) {
    if (!this.roomCode) return;
    const clean = this.normalizeCode(this.roomCode);
    const channelName = `fut_room_${clean}`;
    if (this.broadcastChannel) {
      try { this.broadcastChannel.postMessage(data); } catch (e) { /* ignore */ }
    }
    try {
      localStorage.setItem(channelName, JSON.stringify({ ...data, _t: Date.now() }));
    } catch (e) { /* ignore */ }

    // Sync to Firebase RTDB if available
    if (this.firebaseRoomRef) {
      try {
        if (data.type === 'LOBBY_UPDATE' && data.players) {
          this.firebaseRoomRef.update({ players: data.players });
        } else if (data.type === 'GAME_START') {
          this.firebaseRoomRef.update({ gameState: data });
        } else if (data.type === 'GAME_ACTION') {
          this.firebaseRoomRef.update({ lastAction: { action: data.action, _sender: this.myPeerId, _t: Date.now() } });
        }
      } catch (e) { /* ignore */ }
    }
  }

  handleChannelMessage(data) {
    if (!data || data._sender === this.myPeerId) return;

    if (this.isHost) {
      if (data.type === 'JOIN_REQUEST') {
        const existing = this.joinedPlayers.find(p => p.peerId === data.peerId || p.name === data.name);
        if (existing) return;

        if (this.joinedPlayers.length >= this.maxPlayers) {
          this.sendLocal({ type: 'JOIN_REJECTED', reason: 'Room is full!', targetPeerId: data.peerId, _sender: this.myPeerId });
          return;
        }

        const newId = this.joinedPlayers.length;
        const newPlayer = {
          id: newId,
          name: data.name,
          peerId: data.peerId,
          isHost: false,
        };

        this.joinedPlayers.push(newPlayer);

        this.sendLocal({
          type: 'JOIN_ACCEPTED',
          targetPeerId: data.peerId,
          assignedId: newId,
          roomCode: this.roomCode,
          players: this.joinedPlayers,
          _sender: this.myPeerId,
        });

        this.sendLocal({
          type: 'LOBBY_UPDATE',
          players: this.joinedPlayers,
          _sender: this.myPeerId,
        });

        if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
      } else if (data.type === 'GAME_ACTION') {
        if (this.onActionReceived) this.onActionReceived(data.action);
      }
    } else {
      if (data.type === 'JOIN_ACCEPTED' && data.targetPeerId === this.myPeerId) {
        this.myId = data.assignedId;
        this.joinedPlayers = data.players;
        this.roomCode = data.roomCode;
        if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
      } else if (data.type === 'JOIN_REJECTED' && data.targetPeerId === this.myPeerId) {
        if (this.onStatusChange) this.onStatusChange(`Rejected: ${data.reason}`);
      } else if (data.type === 'LOBBY_UPDATE') {
        this.joinedPlayers = data.players;
        if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
      } else if (data.type === 'GAME_START') {
        if (this.onGameStart) this.onGameStart(data);
      } else if (data.type === 'GAME_ACTION') {
        if (this.onActionReceived) this.onActionReceived(data.action);
      }
    }
  }

  initPeer(customId = null) {
    return new Promise((resolve, reject) => {
      this.myPeerId = customId || `peer_${Math.random().toString(36).substring(2, 9)}`;

      if (typeof Peer === 'undefined') {
        console.warn('PeerJS library not present. Operating in Multi-Transport Sync mode.');
        return resolve(this.myPeerId);
      }

      try {
        if (this.peer) {
          try { this.peer.destroy(); } catch (e) { /* ignore */ }
        }

        this.peer = new Peer(this.myPeerId, { debug: 1, config: STUN_TURN_SERVERS });

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          if (this.onStatusChange) this.onStatusChange('Connected to PeerJS cloud');
          resolve(id);
        });

        this.peer.on('error', (err) => {
          console.warn('PeerJS network notice:', err.message);
          if (this.onStatusChange) this.onStatusChange(`Network notice: ${err.type}`);
          resolve(this.myPeerId);
        });

        this.peer.on('connection', (conn) => {
          this.handleIncomingConnection(conn);
        });

      } catch (err) {
        console.warn('PeerJS init fallback:', err);
        resolve(this.myPeerId);
      }
    });
  }

  // ── CREATE ROOM (HOST) ────────────────────────────────
  async createRoom(hostName, maxPlayers = 2) {
    this.isHost = true;
    this.myPlayerName = hostName;
    this.maxPlayers = maxPlayers;
    this.myId = 0;
    this.roomCode = this.generateCode();

    this.joinedPlayers = [
      { id: 0, name: this.myPlayerName, peerId: null, isHost: true }
    ];

    const cleanCode = this.normalizeCode(this.roomCode);
    const hostPeerId = `fut-room-host-${cleanCode.toLowerCase()}`;
    
    await this.initPeer(hostPeerId);
    this.joinedPlayers[0].peerId = this.myPeerId;

    this.initLocalChannels(this.roomCode);
    return this.roomCode;
  }

  // ── JOIN ROOM (CLIENT) ────────────────────────────────
  async joinRoom(playerName, roomCodeInput) {
    this.isHost = false;
    this.myPlayerName = playerName;

    const cleanCode = this.normalizeCode(roomCodeInput);
    if (!cleanCode || cleanCode.length < 4) {
      throw new Error('Please enter a valid Room Code (e.g. FUT-8X9K)');
    }

    this.roomCode = `FUT-${cleanCode}`;
    await this.initPeer(`fut-room-join-${Math.random().toString(36).substring(2, 7)}`);
    this.initLocalChannels(this.roomCode);

    const targetPeerId = `fut-room-host-${cleanCode.toLowerCase()}`;

    if (this.peer) {
      try {
        const conn = this.peer.connect(targetPeerId, { reliable: true });
        this.hostConn = conn;

        conn.on('open', () => {
          conn.send({ type: 'JOIN_REQUEST', name: this.myPlayerName, peerId: this.myPeerId });
        });

        conn.on('data', (data) => this.handleMessageFromHost(data));

        conn.on('close', () => {
          if (this.onPlayerDisconnect) this.onPlayerDisconnect('Host disconnected');
        });

        conn.on('error', (err) => {
          console.warn('Connection error to host:', err);
        });

      } catch (e) { /* fallback to local */ }
    }

    // Broadcast local & Firebase join request
    this.sendLocal({
      type: 'JOIN_REQUEST',
      name: this.myPlayerName,
      peerId: this.myPeerId,
      _sender: this.myPeerId,
    });

    return new Promise((resolve, reject) => {
      let checks = 0;
      const maxChecks = 25; // 5 seconds
      const timer = setInterval(() => {
        checks++;
        if (this.joinedPlayers.length > 0) {
          clearInterval(timer);
          resolve(this.roomCode);
        } else if (checks >= maxChecks) {
          clearInterval(timer);
          reject(new Error(`Could not find Room "${this.roomCode}". Ensure Host is online & code is correct.`));
        }
      }, 200);
    });
  }

  handleIncomingConnection(conn) {
    if (!this.isHost) return;

    conn.on('data', (data) => {
      if (data.type === 'JOIN_REQUEST') {
        const existing = this.joinedPlayers.find(p => p.peerId === data.peerId || p.name === data.name);
        if (existing) return;

        if (this.joinedPlayers.length >= this.maxPlayers) {
          conn.send({ type: 'JOIN_REJECTED', reason: 'Room is full!' });
          return;
        }

        const newId = this.joinedPlayers.length;
        const newPlayer = { id: newId, name: data.name, peerId: data.peerId, isHost: false };
        this.joinedPlayers.push(newPlayer);
        this.connections.set(data.peerId, conn);

        conn.send({
          type: 'JOIN_ACCEPTED',
          assignedId: newId,
          roomCode: this.roomCode,
          players: this.joinedPlayers,
        });

        this.broadcast({ type: 'LOBBY_UPDATE', players: this.joinedPlayers });
        this.sendLocal({ type: 'LOBBY_UPDATE', players: this.joinedPlayers, _sender: this.myPeerId });
        if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
      } else {
        this.handleClientAction(data);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.joinedPlayers = this.joinedPlayers.filter(p => p.peerId !== conn.peer);
      this.broadcast({ type: 'LOBBY_UPDATE', players: this.joinedPlayers });
      if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
      if (this.onPlayerDisconnect) this.onPlayerDisconnect(`Player ${conn.peer} left`);
    });

    conn.on('error', (err) => {
      console.warn('Host connection error with peer:', conn.peer, err);
    });
  }

  handleMessageFromHost(data) {
    if (data.type === 'JOIN_ACCEPTED') {
      this.myId = data.assignedId;
      this.joinedPlayers = data.players;
      if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
    } else if (data.type === 'JOIN_REJECTED') {
      if (this.onStatusChange) this.onStatusChange(`Rejected: ${data.reason}`);
    } else if (data.type === 'LOBBY_UPDATE') {
      this.joinedPlayers = data.players;
      if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
    } else if (data.type === 'GAME_START') {
      if (this.onGameStart) this.onGameStart(data);
    } else if (data.type === 'GAME_ACTION') {
      if (this.onActionReceived) this.onActionReceived(data.action);
    }
  }

  handleClientAction(data) {
    if (data.type === 'GAME_ACTION') {
      this.broadcast(data);
      if (this.onActionReceived) this.onActionReceived(data.action);
    }
  }

  broadcast(data) {
    if (!this.isHost) return;
    this.connections.forEach(conn => {
      if (conn && conn.open) conn.send(data);
    });
  }

  sendAction(action) {
    const payload = { type: 'GAME_ACTION', action, _sender: this.myPeerId };
    if (this.isHost) {
      this.broadcast(payload);
      this.sendLocal(payload);
      if (this.onActionReceived) this.onActionReceived(action);
    } else {
      if (this.hostConn && this.hostConn.open) {
        this.hostConn.send(payload);
      }
      this.sendLocal(payload);
    }
  }

  startOnlineGame(gameState) {
    if (!this.isHost) return;
    const payload = {
      type: 'GAME_START',
      state: gameState,
      players: this.joinedPlayers,
      _sender: this.myPeerId,
    };
    this.broadcast(payload);
    this.sendLocal(payload);
    if (this.onGameStart) this.onGameStart(payload);
  }

  disconnect() {
    if (this.firebaseRoomRef) {
      try { this.firebaseRoomRef.off(); } catch (e) {}
      this.firebaseRoomRef = null;
    }
    if (this.roomCode) {
      const clean = this.normalizeCode(this.roomCode);
      try { localStorage.removeItem(`fut_room_${clean}`); } catch(e) {}
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) { /* ignore */ }
      this.peer = null;
    }
    if (this.broadcastChannel) {
      try { this.broadcastChannel.close(); } catch (e) { /* ignore */ }
      this.broadcastChannel = null;
    }
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
      this.storageListener = null;
    }
    this.connections.clear();
    this.hostConn = null;
    this.isHost = false;
    this.roomCode = null;
    this.joinedPlayers = [];
  }
}

export const onlineEngine = new OnlineEngine();
