// ═══════════════════════════════════════════════════════
//  onlineEngine.js — WebRTC PeerJS Real-Time Multiplayer
// ═══════════════════════════════════════════════════════

/* global Peer */

class OnlineEngine {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection (Host side)
    this.hostConn = null;          // DataConnection to host (Client side)
    this.isHost = false;
    this.roomCode = null;
    this.myPeerId = null;
    this.myPlayerName = '';
    this.joinedPlayers = [];       // [{ id, name, peerId, isHost, color }]
    this.maxPlayers = 2;
    this.onLobbyUpdate = null;
    this.onGameStart = null;
    this.onActionReceived = null;
    this.onPlayerDisconnect = null;
    this.onStatusChange = null;
  }

  // Generate a friendly 6-character room code (e.g. FUT-7X9K)
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `FUT-${code}`;
  }

  // Initialize PeerJS
  initPeer(customId = null) {
    return new Promise((resolve, reject) => {
      try {
        this.peer = customId ? new Peer(customId) : new Peer();

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          if (this.onStatusChange) this.onStatusChange('connected', id);
          resolve(id);
        });

        this.peer.on('error', (err) => {
          console.error('PeerJS Error:', err);
          if (this.onStatusChange) this.onStatusChange('error', err.message);
          reject(err);
        });

        // Host receives incoming connections
        this.peer.on('connection', (conn) => {
          this.handleIncomingConnection(conn);
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  // ── HOST ROOM ─────────────────────────────────────────
  async createRoom(hostName, maxPlayers = 2) {
    this.isHost = true;
    this.myPlayerName = hostName;
    this.maxPlayers = maxPlayers;
    this.roomCode = this.generateRoomCode();
    const peerId = `fut-draft-${this.roomCode.toLowerCase()}`;

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

  // ── JOIN ROOM ─────────────────────────────────────────
  async joinRoom(playerName, roomCodeInput) {
    this.isHost = false;
    this.myPlayerName = playerName;
    const formattedCode = roomCodeInput.trim().toUpperCase();
    const targetPeerId = `fut-draft-${formattedCode.toLowerCase()}`;

    await this.initPeer();

    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(targetPeerId, { reliable: true });
      this.hostConn = conn;

      conn.on('open', () => {
        // Send join request to host
        conn.send({
          type: 'JOIN_REQUEST',
          name: this.myPlayerName,
          peerId: this.myPeerId,
        });
        resolve(formattedCode);
      });

      conn.on('data', (data) => {
        this.handleMessageFromHost(data);
      });

      conn.on('close', () => {
        if (this.onPlayerDisconnect) this.onPlayerDisconnect('Host disconnected');
      });

      conn.on('error', (err) => {
        reject(err);
      });
    });
  }

  // ── HOST HANDLING INCOMING PEERS ──────────────────────
  handleIncomingConnection(conn) {
    if (!this.isHost) return;

    conn.on('data', (data) => {
      if (data.type === 'JOIN_REQUEST') {
        if (this.joinedPlayers.length >= this.maxPlayers) {
          conn.send({ type: 'JOIN_REJECTED', reason: 'Room is full' });
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

        // Notify client they joined
        conn.send({
          type: 'JOIN_ACCEPTED',
          assignedId: newId,
          roomCode: this.roomCode,
          players: this.joinedPlayers,
        });

        // Broadcast updated lobby to all peers
        this.broadcast({
          type: 'LOBBY_UPDATE',
          players: this.joinedPlayers,
        });

        if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
      } else {
        // Relay client action to all other peers & local host
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

  // ── CLIENT HANDLING MESSAGES FROM HOST ────────────────
  handleMessageFromHost(data) {
    switch (data.type) {
      case 'JOIN_ACCEPTED':
        this.myId = data.assignedId;
        this.joinedPlayers = data.players;
        if (this.onLobbyUpdate) this.onLobbyUpdate(this.joinedPlayers);
        break;

      case 'JOIN_REJECTED':
        if (this.onStatusChange) this.onStatusChange('rejected', data.reason);
        break;

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

  // ── HOST PROCESSES CLIENT ACTION ──────────────────────
  handleClientAction(data) {
    if (data.type === 'GAME_ACTION') {
      // Re-broadcast action to all other connected peers
      this.broadcast(data);
      if (this.onActionReceived) this.onActionReceived(data.action);
    }
  }

  // ── BROADCAST TO ALL CONNECTED PEERS (HOST ONLY) ──────
  broadcast(data) {
    if (!this.isHost) return;
    this.connections.forEach((conn) => {
      if (conn.open) conn.send(data);
    });
  }

  // ── SEND ACTION TO HOST OR BROADCAST ──────────────────
  sendAction(action) {
    const payload = { type: 'GAME_ACTION', action };
    if (this.isHost) {
      this.broadcast(payload);
      if (this.onActionReceived) this.onActionReceived(action);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(payload);
    }
  }

  // ── HOST STARTS ONLINE GAME ───────────────────────────
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
      this.peer.destroy();
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
