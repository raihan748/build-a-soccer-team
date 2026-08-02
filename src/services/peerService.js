/**
 * PeerJS P2P Master-Host Sync Protocol
 * Zero-Config Realtime Multiplayer Engine for Vercel
 */

let PeerClass = null;

export class PeerService {
  constructor() {
    this.peer = null;
    this.connections = []; // For host: list of client connections
    this.hostConnection = null; // For client: connection to host
    this.isHost = false;
    this.myPeerId = '';
    this.roomCode = '';
    this.onStateChangeCallback = null;
    this.onEmoteCallback = null;
  }

  async initPeer() {
    if (typeof window === 'undefined') return null;
    if (!PeerClass) {
      const peerModule = await import('peerjs');
      PeerClass = peerModule.default || peerModule.Peer;
    }
    return PeerClass;
  }

  // Create Room as Host
  async createRoom(roomCode, onStateChange, onEmote) {
    const Peer = await this.initPeer();
    if (!Peer) return false;

    this.isHost = true;
    this.roomCode = roomCode.toUpperCase().trim();
    this.onStateChangeCallback = onStateChange;
    this.onEmoteCallback = onEmote;

    const formattedId = `SOCMGR-${this.roomCode}`;

    return new Promise((resolve) => {
      try {
        this.peer = new Peer(formattedId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          resolve(true);
        });

        this.peer.on('connection', (conn) => {
          this.connections.push(conn);
          this.setupConnectionListeners(conn);
        });

        this.peer.on('error', (err) => {
          console.warn('Peer host error:', err);
          // If ID exists, fallback to auto ID
          if (err.type === 'unavailable-id') {
            this.peer = new Peer({ debug: 1 });
            this.peer.on('open', (id) => {
              this.myPeerId = id;
              resolve(true);
            });
          } else {
            resolve(false);
          }
        });
      } catch (e) {
        console.error('Peer init exception:', e);
        resolve(false);
      }
    });
  }

  // Join Room as Client
  async joinRoom(roomCode, onStateChange, onEmote) {
    const Peer = await this.initPeer();
    if (!Peer) return false;

    this.isHost = false;
    this.roomCode = roomCode.toUpperCase().trim();
    this.onStateChangeCallback = onStateChange;
    this.onEmoteCallback = onEmote;

    const hostId = `SOCMGR-${this.roomCode}`;

    return new Promise((resolve) => {
      try {
        this.peer = new Peer({
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          const conn = this.peer.connect(hostId, { reliable: true });
          this.hostConnection = conn;

          conn.on('open', () => {
            this.setupConnectionListeners(conn);
            resolve(true);
          });

          conn.on('error', () => {
            resolve(false);
          });

          setTimeout(() => {
            if (!conn.open) resolve(false);
          }, 6000);
        });

        this.peer.on('error', () => {
          resolve(false);
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  setupConnectionListeners(conn) {
    conn.on('data', (data) => {
      if (!data || typeof data !== 'object') return;

      // Security & State Handling
      if (data.type === 'FULL_STATE' && this.onStateChangeCallback) {
        this.onStateChangeCallback(data.payload);
      } else if (data.type === 'CLIENT_ACTION' && this.isHost) {
        // Forward client action to main state handler in App
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback({ actionRequest: data.payload, fromClient: conn.peer });
        }
      } else if (data.type === 'EMOTE' && this.onEmoteCallback) {
        this.onEmoteCallback(data.payload);
      }
    });

    conn.on('close', () => {
      this.connections = this.connections.filter((c) => c !== conn);
    });
  }

  // Host Broadcasts Full State to All Clients
  broadcastState(state) {
    if (!this.isHost) return;
    const sanitizedState = JSON.parse(JSON.stringify(state));
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'FULL_STATE', payload: sanitizedState });
      }
    });
  }

  // Client Sends Action to Host
  sendActionToHost(actionPayload) {
    if (this.isHost) return;
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'CLIENT_ACTION', payload: actionPayload });
    }
  }

  // Broadcast Emote to Everyone
  sendEmote(emoteData) {
    if (this.isHost) {
      this.connections.forEach((conn) => {
        if (conn.open) conn.send({ type: 'EMOTE', payload: emoteData });
      });
      if (this.onEmoteCallback) this.onEmoteCallback(emoteData);
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'EMOTE', payload: emoteData });
    }
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
    }
    this.connections = [];
    this.hostConnection = null;
  }
}
