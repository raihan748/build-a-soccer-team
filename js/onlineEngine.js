// ═══════════════════════════════════════════════════════
//  onlineEngine.js — WebRTC PeerJS Real-Time Multiplayer
//  Includes Google STUN ICE Servers & Normalized Room Codes
// ═══════════════════════════════════════════════════════

/* global Peer */

// STUN configuration for WebRTC NAT & Firewall traversal
const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ]
  }
};

class OnlineEngine {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection (Host side)
    this.hostConn = null;          // DataConnection to host (Client side)
    this.isHost = false;
    this.roomCode = null;
    this.myPeerId = null;
    this.myPlayerName = '';
    this.myId = 0;
    this.joinedPlayers = [];       // [{ id, name, peerId, isHost }]
    this.maxPlayers = 2;
    this.onLobbyUpdate = null;
    this.onGameStart = null;
    this.onActionReceived = null;
    this.onPlayerDisconnect = null;
    this.onStatusChange = null;
  }

  // Normalize code: "FUT-8X9K" -> "8X9K"
  normalizeCode(raw) {
    if (!raw) return '';
    let clean = raw.trim().toUpperCase();
    clean = clean.replace(/^FUT-?/, '');
    return clean.replace(/[^A-Z0-9]/g, '');
  }

  // Generate 4-character random code
  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Initialize PeerJS instance
  initPeer(customId = null) {
    return new Promise((resolve, reject) => {
      if (typeof Peer === 'undefined') {
        return reject(new Error('PeerJS library not loaded. Check internet connection.'));
      }

      if (this.peer) {
        try { this.peer.destroy(); } catch (e) { /* ignore */ }
      }

      let timeoutTimer = setTimeout(() => {
        reject(new Error('Signaling server timeout. Please try again.'));
      }, 12000);

      try {
        this.peer = customId ? new Peer(customId, PEER_CONFIG) : new Peer(PEER_CONFIG);

        this.peer.on('open', (id) => {
          clearTimeout(timeoutTimer);
          this.myPeerId = id;
          if (this.onStatusChange) this.onStatusChange('connected', id);
          resolve(id);
        });

        this.peer.on('error', (err) => {
          clearTimeout(timeoutTimer);
          console.error('PeerJS Error:', err);
          let errMsg = err.message || 'Peer connection failed';
          if (err.type === 'unavailable-id') {
            errMsg = 'Room code collision. Generating new room...';
          } else if (err.type === 'peer-unavailable') {
            errMsg = 'Host room not found. Check room code & ensure host is waiting.';
          }
          if (this.onStatusChange) this.onStatusChange('error', errMsg);
          reject(new Error(errMsg));
        });

        // Host receives incoming connections
        this.peer.on('connection', (conn) => {
          this.handleIncomingConnection(conn);
        });

      } catch (err) {
        clearTimeout(timeoutTimer);
        reject(err);
      }
    });
  }

  // ── HOST CREATES ROOM ─────────────────────────────────
  async createRoom(hostName, maxPlayers = 2) {
    this.isHost = true;
    this.myPlayerName = hostName;
    this.maxPlayers = maxPlayers;
    this.myId = 0;

    const rawCode = this.generateCode();
    this.roomCode = `FUT-${rawCode}`;
    const peerId = `fut-draft-room-${rawCode.toLowerCase()}`;

    await this.initPeer(peerId);

    this.joinedPlayers = [
      {
        id: 0,
        name: this.myPlayerName,
        peerId: this.myPeerId,
        isHost: true,
      }
    ];

    return this.roomCode;
  }

  // ── CLIENT JOINS ROOM ─────────────────────────────────
  async joinRoom(playerName, roomCodeInput) {
    this.isHost = false;
    this.myPlayerName = playerName;

    const cleanCode = this.normalizeCode(roomCodeInput);
    if (!cleanCode || cleanCode.length < 4) {
      throw new Error('Please enter a valid 4-character Room Code (e.g. FUT-8X9K or 8X9K)');
    }

    const targetPeerId = `fut-draft-room-${cleanCode.toLowerCase()}`;

    await this.initPeer();

    return new Promise((resolve, reject) => {
      let connTimeout = setTimeout(() => {
        reject(new Error('Connection to Host timed out. Check code or Host status.'));
      }, 10000);

      const conn = this.peer.connect(targetPeerId, { reliable: true });
      this.hostConn = conn;

      conn.on('open', () => {
        clearTimeout(connTimeout);
        conn.send({
          type: 'JOIN_REQUEST',
          name: this.myPlayerName,
          peerId: this.myPeerId,
        });
      });

      conn.on('data', (data) => {
        if (data.type === 'JOIN_ACCEPTED') {
          this.myId = data.assignedId;
          this.joinedPlayers = data.players;
          this.roomCode = data.roomCode;
          if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
          resolve(data.roomCode);
        } else if (data.type === 'JOIN_REJECTED') {
          reject(new Error(data.reason || 'Room is full'));
        } else {
          this.handleMessageFromHost(data);
        }
      });

      conn.on('close', () => {
        if (this.onPlayerDisconnect) this.onPlayerDisconnect('Host closed connection');
      });

      conn.on('error', (err) => {
        clearTimeout(connTimeout);
        reject(err);
      });
    });
  }

  // ── HOST HANDLES INCOMING PEER ────────────────────────
  handleIncomingConnection(conn) {
    if (!this.isHost) return;

    conn.on('data', (data) => {
      if (data.type === 'JOIN_REQUEST') {
        if (this.joinedPlayers.length >= this.maxPlayers) {
          conn.send({ type: 'JOIN_REJECTED', reason: 'Room is full!' });
          conn.close();
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
        this.connections.set(data.peerId, conn);

        // Notify client
        conn.send({
          type: 'JOIN_ACCEPTED',
          assignedId: newId,
          roomCode: this.roomCode,
          players: this.joinedPlayers,
        });

        // Broadcast to all
        this.broadcast({
          type: 'LOBBY_UPDATE',
          players: this.joinedPlayers,
        });

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
    });
  }

  // ── CLIENT HANDLES HOST MESSAGES ──────────────────────
  handleMessageFromHost(data) {
    switch (data.type) {
      case 'LOBBY_UPDATE':
        this.joinedPlayers = data.players;
        if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
        break;

      case 'GAME_START':
        if (this.onGameStart) this.onGameStart(data);
        break;

      case 'GAME_ACTION':
        if (this.onActionReceived) this.onActionReceived(data.action);
        break;
    }
  }

  // ── HOST RELAYS CLIENT ACTION ─────────────────────────
  handleClientAction(data) {
    if (data.type === 'GAME_ACTION') {
      this.broadcast(data);
      if (this.onActionReceived) this.onActionReceived(data.action);
    }
  }

  // ── BROADCAST TO PEERS ────────────────────────────────
  broadcast(data) {
    if (!this.isHost) return;
    this.connections.forEach((conn) => {
      if (conn && conn.open) conn.send(data);
    });
  }

  // ── SEND ACTION ───────────────────────────────────────
  sendAction(action) {
    const payload = { type: 'GAME_ACTION', action };
    if (this.isHost) {
      this.broadcast(payload);
      if (this.onActionReceived) this.onActionReceived(action);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(payload);
    }
  }

  // ── HOST STARTS GAME ──────────────────────────────────
  startOnlineGame(gameState) {
    if (!this.isHost) return;
    const payload = {
      type: 'GAME_START',
      state: gameState,
      players: this.joinedPlayers,
    };
    this.broadcast(payload);
    if (this.onGameStart) this.onGameStart(payload);
  }

  // ── CLEANUP ───────────────────────────────────────────
  disconnect() {
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) { /* ignore */ }
      this.peer = null;
    }
    this.connections.clear();
    this.hostConn = null;
    this.isHost = false;
    this.roomCode = null;
    this.joinedPlayers = [];
  }
}

export const onlineEngine = new OnlineEngine();
