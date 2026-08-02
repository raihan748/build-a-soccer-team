/**
 * PeerJS P2P Master-Host Sync Protocol (HTTPS & Vercel Optimized)
 * Multi-STUN fallback engine with strict SSL configuration
 */

let PeerClass = null;

export class PeerService {
  constructor() {
    this.peer = null;
    this.connections = [];
    this.hostConnection = null;
    this.isHost = false;
    this.myPeerId = '';
    this.roomCode = '';
    this.onStateChangeCallback = null;
    this.onEmoteCallback = null;
    this.onStatusChangeCallback = null;
    this.status = 'DISCONNECTED'; // 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'ERROR'
  }

  async initPeer() {
    if (typeof window === 'undefined') return null;
    if (!PeerClass) {
      const peerModule = await import('peerjs');
      PeerClass = peerModule.default || peerModule.Peer;
    }
    return PeerClass;
  }

  setStatus(newStatus, msg = '') {
    this.status = newStatus;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(newStatus, msg);
    }
  }

  // Create Room as Host
  async createRoom(roomCode, onStateChange, onEmote, onStatusChange) {
    const Peer = await this.initPeer();
    if (!Peer) return false;

    this.isHost = true;
    this.roomCode = roomCode.toUpperCase().trim();
    this.onStateChangeCallback = onStateChange;
    this.onEmoteCallback = onEmote;
    this.onStatusChangeCallback = onStatusChange;

    this.setStatus('CONNECTING', 'Membuat P2P Room Host...');

    // Sanitize Room Code to alphanumeric only to prevent PeerJS ID rejection
    const cleanCode = this.roomCode.replace(/[^A-Z0-9]/g, '');
    const formattedId = `SOCMGR-${cleanCode}-${Date.now().toString().slice(-4)}`;

    return new Promise((resolve) => {
      try {
        this.peer = new Peer(formattedId, {
          host: '0.peerjs.com',
          port: 443,
          secure: true,
          debug: 2,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          this.setStatus('CONNECTED', `Room ${this.roomCode} Siap! Menunggu Client...`);
          resolve({ success: true, hostPeerId: id });
        });

        this.peer.on('connection', (conn) => {
          this.connections.push(conn);
          this.setupConnectionListeners(conn);
          this.setStatus('CONNECTED', `Client Terhubung (${this.connections.length} Player)`);
        });

        this.peer.on('error', (err) => {
          console.warn('Peer Host error:', err);
          this.setStatus('ERROR', `Host Error: ${err.type || err.message}`);
          resolve({ success: false, error: err.message });
        });
      } catch (e) {
        this.setStatus('ERROR', 'Gagal inisialisasi WebRTC Peer');
        resolve({ success: false });
      }
    });
  }

  // Join Room as Client
  async joinRoom(hostPeerId, onStateChange, onEmote, onStatusChange) {
    const Peer = await this.initPeer();
    if (!Peer) return false;

    this.isHost = false;
    this.onStateChangeCallback = onStateChange;
    this.onEmoteCallback = onEmote;
    this.onStatusChangeCallback = onStatusChange;

    this.setStatus('CONNECTING', 'Menghubungkan ke Host Room...');

    return new Promise((resolve) => {
      try {
        this.peer = new Peer({
          host: '0.peerjs.com',
          port: 443,
          secure: true,
          debug: 2,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          const conn = this.peer.connect(hostPeerId, { reliable: true });
          this.hostConnection = conn;

          conn.on('open', () => {
            this.setupConnectionListeners(conn);
            this.setStatus('CONNECTED', 'Terhubung ke Host!');
            resolve({ success: true });
          });

          conn.on('error', (err) => {
            this.setStatus('ERROR', `Koneksi gagal: ${err.message}`);
            resolve({ success: false });
          });

          setTimeout(() => {
            if (!conn.open) {
              this.setStatus('ERROR', 'Koneksi timeout (Host tidak merespon)');
              resolve({ success: false });
            }
          }, 8000);
        });

        this.peer.on('error', (err) => {
          this.setStatus('ERROR', `Peer Error: ${err.message}`);
          resolve({ success: false });
        });
      } catch (e) {
        this.setStatus('ERROR', 'Gagal inisialisasi Peer');
        resolve({ success: false });
      }
    });
  }

  setupConnectionListeners(conn) {
    conn.on('data', (data) => {
      if (!data || typeof data !== 'object') return;

      if (data.type === 'FULL_STATE' && this.onStateChangeCallback) {
        this.onStateChangeCallback(data.payload);
      } else if (data.type === 'CLIENT_ACTION' && this.isHost) {
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback({ actionRequest: data.payload, fromClient: conn.peer });
        }
      } else if (data.type === 'EMOTE' && this.onEmoteCallback) {
        this.onEmoteCallback(data.payload);
      }
    });

    conn.on('close', () => {
      this.connections = this.connections.filter((c) => c !== conn);
      if (this.isHost) {
        this.setStatus('CONNECTED', `Client terputus (${this.connections.length} Player tersisa)`);
      } else {
        this.setStatus('DISCONNECTED', 'Koneksi ke Host terputus');
      }
    });
  }

  broadcastState(state) {
    if (!this.isHost) return;
    const sanitizedState = JSON.parse(JSON.stringify(state));
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'FULL_STATE', payload: sanitizedState });
      }
    });
  }

  sendActionToHost(actionPayload) {
    if (this.isHost) return;
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'CLIENT_ACTION', payload: actionPayload });
    }
  }

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
    this.status = 'DISCONNECTED';
  }
}
