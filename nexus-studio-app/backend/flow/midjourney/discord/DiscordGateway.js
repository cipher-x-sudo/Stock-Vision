/**
 * Discord Gateway WebSocket client - connect, heartbeat, receive events, dispatch to UserMessageListener
 */

import WebSocket from 'ws';
import zlib from 'zlib';
import { WebSocketCode } from '../constants.js';

const CLOSE_CODE_RECONNECT = 2001;
const CLOSE_CODE_INVALIDATE = 1009;
const CLOSE_CODE_EXCEPTION = 1011;
const CLOSE_CODE_ALREADY_AUTHENTICATED = 4005;
const CONNECT_RETRY_LIMIT = 5;
const AUTH_CONFLICT_RETRY_LIMIT = 3;
const AUTH_CONFLICT_RETRY_DELAY = 5000;
const FATAL_ERROR_CODES = [4011, 4012, 4013, 4014];

export class DiscordGateway {
  constructor(account, userMessageListener, discordHelper, wssServer, resumeWss, successCallback, failureCallback) {
    this.account = account;
    this.userMessageListener = userMessageListener;
    this.discordHelper = discordHelper;
    this.wssServer = wssServer;
    this.resumeWss = resumeWss;
    this.successCallback = successCallback;
    this.failureCallback = failureCallback;

    this.ws = null;
    this.sessionId = null;
    this.sequence = null;
    this.resumeGatewayUrl = null;
    this.interval = 41250;
    this.heartbeatAck = false;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.running = false;
    this.sessionClosing = false;
    this.decompressor = null;
    this.inflateBuffer = Buffer.alloc(0);
    this.authConflictRetryCount = 0;
    this.readyReceived = false;
    this.identifySent = false;
  }

  getGatewayUrl(reconnect) {
    if (reconnect && this.resumeGatewayUrl) {
      const server = this.resumeWss || this.resumeGatewayUrl;
      return `${server}/?encoding=json&v=9&compress=zlib-stream`;
    }
    return `${this.wssServer}/?encoding=json&v=9&compress=zlib-stream`;
  }

  start(reconnect = false) {
    this.closeSocket();
    this.sessionClosing = false;
    const gatewayUrl = this.getGatewayUrl(reconnect);
    this.inflateBuffer = Buffer.alloc(0);
    this.readyReceived = false;
    this.identifySent = false;

    const decompressorOptions = {
      chunkSize: 1024 * 16,
      flush: zlib.constants.Z_SYNC_FLUSH,
    };
    this.decompressor = zlib.createInflate(decompressorOptions);

    this.decompressor.on('data', (chunk) => {
      if (this.sessionClosing) return;
      this.inflateBuffer = Buffer.concat([this.inflateBuffer, chunk]);
      this.processInflateBuffer();
    });

    this.decompressor.on('error', (err) => {
      if (this.sessionClosing) return;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(CLOSE_CODE_EXCEPTION, 'decompressor error');
      }
    });

    const headers = {
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'User-Agent': this.account.userAgent || '',
    };

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(gatewayUrl, { headers });

      this.ws.on('open', () => {
        resolve();
      });

      this.ws.on('message', (data) => {
        if (Buffer.isBuffer(data)) {
          this.handleWebSocketMessage(data);
        } else if (typeof data === 'string') {
          this.handleMessage(data);
        }
      });

      this.ws.on('error', (err) => {
        const display = this.account.getDisplay?.() ?? this.account.channelId ?? '';
        console.error(`[wss-${display}] WebSocket error:`, err?.message || err);
        if (this.decompressor) {
          try {
            this.decompressor.removeAllListeners();
            this.decompressor.destroy();
          } catch (e) {}
          this.decompressor = null;
        }
        this.failureCallback(CLOSE_CODE_EXCEPTION, err?.message || 'transport error');
        reject(err);
      });

      this.ws.on('close', (code, reason) => {
        const reasonStr = Buffer.isBuffer(reason) ? reason.toString('utf-8') : (reason || '');
        this.onFailure(code, reasonStr);
      });
    });
  }

  handleWebSocketMessage(data) {
    if (this.sessionClosing) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.decompressor) return;
    try {
      this.decompressor.write(data);
    } catch (err) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(CLOSE_CODE_EXCEPTION, 'decompressor write error');
      }
    }
  }

  handleMessage(json) {
    if (this.sessionClosing) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const data = JSON.parse(json);
      const opCode = data.op;
      switch (opCode) {
        case WebSocketCode.HEARTBEAT:
          this.handleHeartbeat();
          break;
        case WebSocketCode.HEARTBEAT_ACK:
          this.heartbeatAck = true;
          this.clearHeartbeatTimeout();
          break;
        case WebSocketCode.HELLO:
          this.handleHello(data);
          if (!this.identifySent && !this.running) {
            this.doResumeOrIdentify();
          }
          break;
        case WebSocketCode.RESUME:
          this.onSuccess();
          break;
        case WebSocketCode.RECONNECT:
          this.onFailure(CLOSE_CODE_RECONNECT, 'receive server reconnect');
          break;
        case WebSocketCode.INVALIDATE_SESSION:
          this.onFailure(CLOSE_CODE_INVALIDATE, 'receive session invalid');
          break;
        case WebSocketCode.DISPATCH:
          this.handleDispatch(data);
          break;
        default:
          break;
      }
    } catch (err) {
      const display = this.account.getDisplay?.() ?? this.account.channelId ?? '';
      console.error(`[wss-${display}] Error parsing message:`, err?.message);
    }
  }

  processInflateBuffer() {
    if (this.sessionClosing) return;
    let start = 0;
    while (start < this.inflateBuffer.length) {
      let jsonEnd = -1;
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      for (let i = start; i < this.inflateBuffer.length; i++) {
        const char = this.inflateBuffer[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === 0x5c) {
          escapeNext = true;
          continue;
        }
        if (char === 0x22) {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (char === 0x7b) braceCount++;
        else if (char === 0x7d) {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
      if (jsonEnd > start) {
        const jsonStr = this.inflateBuffer.slice(start, jsonEnd).toString('utf-8');
        this.handleMessage(jsonStr);
        start = jsonEnd;
        while (start < this.inflateBuffer.length && (this.inflateBuffer[start] === 0x20 || this.inflateBuffer[start] === 0x0a || this.inflateBuffer[start] === 0x0d)) {
          start++;
        }
      } else {
        break;
      }
    }
    if (start > 0) {
      this.inflateBuffer = this.inflateBuffer.slice(start);
    }
  }

  handleHello(data) {
    this.clearHeartbeatInterval();
    this.interval = data.d?.heartbeat_interval ?? 41250;
    this.heartbeatAck = true;
    const jitter = Math.floor(Math.random() * this.interval);
    this.heartbeatInterval = setInterval(() => {
      if (this.heartbeatAck) {
        this.heartbeatAck = false;
        this.sendHeartbeat();
      } else {
        this.onFailure(CLOSE_CODE_RECONNECT, 'heartbeat has not ack interval');
      }
    }, this.interval);
    setTimeout(() => {
      if (this.heartbeatAck) {
        this.heartbeatAck = false;
        this.sendHeartbeat();
      }
    }, jitter);
  }

  handleHeartbeat() {
    this.sendHeartbeat();
    this.heartbeatTimeout = setTimeout(() => {
      this.onFailure(CLOSE_CODE_RECONNECT, 'heartbeat has not ack');
    }, this.interval);
  }

  sendHeartbeat() {
    this.sendMessage(WebSocketCode.HEARTBEAT, this.sequence);
  }

  handleDispatch(data) {
    this.sequence = data.s ?? null;
    const content = data.d;
    if (!content || typeof content !== 'object') return;
    const eventType = data.t;
    if (eventType === 'READY') {
      if (this.readyReceived || this.sessionClosing) return;
      this.sessionId = content.session_id;
      this.resumeGatewayUrl = content.resume_gateway_url;
      this.readyReceived = true;
      this.authConflictRetryCount = 0;
      this.onSuccess();
    } else if (eventType === 'RESUMED') {
      if (this.readyReceived || this.sessionClosing) return;
      this.readyReceived = true;
      this.authConflictRetryCount = 0;
      this.onSuccess();
    } else {
      try {
        this.userMessageListener.onMessage(data);
      } catch (err) {
        const display = this.account.getDisplay?.() ?? this.account.channelId ?? '';
        console.error(`[wss-${display}] Handle message error:`, err?.message);
      }
    }
  }

  doResumeOrIdentify() {
    if (this.identifySent || this.running) return;
    if (!this.sessionId) {
      this.sendIdentify();
    } else {
      this.sendResume();
    }
  }

  sendIdentify() {
    if (this.identifySent) return;
    const authData = this.createAuthData();
    this.sendMessage(WebSocketCode.IDENTIFY, authData);
    this.identifySent = true;
  }

  sendResume() {
    if (this.identifySent) return;
    const data = {
      token: this.account.userToken,
      session_id: this.sessionId,
      seq: this.sequence,
    };
    this.sendMessage(WebSocketCode.RESUME, data);
    this.identifySent = true;
  }

  createAuthData() {
    const userAgent = this.account.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/);
    const browserName = browserMatch ? browserMatch[1] : 'Chrome';
    const browserVersion = browserMatch ? browserMatch[2] : '112';
    return {
      capabilities: 16381,
      client_state: {
        api_code_version: 0,
        guild_versions: {},
        highest_last_message_id: '0',
        private_channels_version: '0',
        read_state_version: 0,
        user_guild_settings_version: -1,
        user_settings_version: -1,
      },
      compress: false,
      presence: { activities: [], afk: false, since: 0, status: 'online' },
      properties: {
        browser: browserName,
        browser_user_agent: userAgent,
        browser_version: browserVersion,
        client_build_number: 222963,
        client_event_source: null,
        device: '',
        os: 'Mac OS X',
        referer: 'https://www.midjourney.com',
        referrer_current: '',
        referring_domain: 'www.midjourney.com',
        referring_domain_current: '',
        release_channel: 'stable',
        system_locale: 'en-US',
      },
      token: this.account.userToken,
    };
  }

  sendMessage(op, d) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ op, d }));
  }

  onSuccess() {
    this.running = true;
    this.successCallback(
      this.sessionId || '',
      this.sequence,
      this.resumeGatewayUrl || ''
    );
  }

  onFailure(code, reason) {
    if (this.sessionClosing) {
      this.sessionClosing = false;
      return;
    }
    this.closeSocket();
    if (!this.running) {
      this.failureCallback(code, reason);
      return;
    }
    this.running = false;
    if (code === CLOSE_CODE_ALREADY_AUTHENTICATED) {
      this.authConflictRetryCount++;
      if (this.authConflictRetryCount >= AUTH_CONFLICT_RETRY_LIMIT) {
        this.account.enable = false;
        return;
      }
      this.sessionId = null;
      this.sequence = null;
      this.resumeGatewayUrl = null;
      setTimeout(() => this.tryNewConnect(), AUTH_CONFLICT_RETRY_DELAY);
      return;
    }
    if (FATAL_ERROR_CODES.includes(code)) {
      this.account.enable = false;
      return;
    }
    if (code >= 4000) {
      this.tryNewConnect();
      return;
    }
    if (code === CLOSE_CODE_RECONNECT) {
      this.tryReconnect();
    } else {
      this.tryNewConnect();
    }
  }

  async tryReconnect() {
    try {
      await this.start(true);
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1000));
      this.tryNewConnect();
    }
  }

  async tryNewConnect() {
    for (let i = 1; i <= CONNECT_RETRY_LIMIT; i++) {
      try {
        await this.start(false);
        return;
      } catch (err) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    this.account.enable = false;
  }

  closeSocket() {
    this.clearHeartbeatInterval();
    this.clearHeartbeatTimeout();
    this.sessionClosing = true;
    this.inflateBuffer = Buffer.alloc(0);
    if (this.decompressor) {
      try {
        this.decompressor.removeAllListeners();
        this.decompressor.destroy();
      } catch (e) {}
      this.decompressor = null;
    }
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.removeAllListeners();
          this.ws.close();
        }
      } catch (e) {}
      this.ws = null;
    }
    this.readyReceived = false;
    this.identifySent = false;
  }

  clearHeartbeatInterval() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  clearHeartbeatTimeout() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  stop() {
    this.closeSocket();
    this.running = false;
  }

  getConnectionStatus() {
    let wsState = 'CLOSED';
    if (this.ws) {
      const s = this.ws.readyState;
      wsState = s === WebSocket.CONNECTING ? 'CONNECTING' : s === WebSocket.OPEN ? 'OPEN' : s === WebSocket.CLOSING ? 'CLOSING' : 'CLOSED';
    }
    return {
      connected: this.running && this.ws?.readyState === WebSocket.OPEN,
      running: this.running,
      sessionId: this.sessionId,
      sequence: this.sequence,
      websocketState: wsState,
      hasSession: this.sessionId != null,
    };
  }
}
