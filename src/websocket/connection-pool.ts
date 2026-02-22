/**
 * WebSocket 连接池管理器
 * 提供自动重连、心跳检测、连接复用等功能
 */

import { EventEmitter } from 'events';

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  messageQueueSize: number;
  compressionEnabled: boolean;
}

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  reconnectAttempts: number;
  lastConnectTime: number;
  lastDisconnectTime: number;
  lastMessageTime: number;
  messagesReceived: number;
  messagesSent: number;
}

type WebSocketLike = {
  send: (data: string | Buffer, cb?: (err?: Error) => void) => void;
  close: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  readyState: number;
};

/**
 * WebSocket 连接包装器
 */
class WebSocketConnection extends EventEmitter {
  private ws?: WebSocketLike;
  private config: WebSocketConfig;
  private state: ConnectionState;
  private heartbeatTimer?: NodeJS.Timeout;
  private messageQueue: Array<{ data: string | Buffer; cb?: () => void }> = [];
  private reconnectTimer?: NodeJS.Timeout;

  constructor(private url: string, config?: Partial<WebSocketConfig>) {
    super();
    this.config = {
      url,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      heartbeatTimeout: 60000,
      messageQueueSize: 100,
      compressionEnabled: true,
      ...config,
    };

    this.state = {
      connected: false,
      connecting: false,
      reconnectAttempts: 0,
      lastConnectTime: 0,
      lastDisconnectTime: 0,
      lastMessageTime: 0,
      messagesReceived: 0,
      messagesSent: 0,
    };
  }

  /**
   * 连接
   */
  connect(): void {
    if (this.state.connected || this.state.connecting) {
      return;
    }

    this.state.connecting = true;
    this.emit('connecting');

    try {
      // 动态导入 ws
      const WebSocket = require('ws');
      this.ws = new WebSocket(this.url);

      this.ws!.on('open', () => {
        this.state.connected = true;
        this.state.connecting = false;
        this.state.reconnectAttempts = 0;
        this.state.lastConnectTime = Date.now();

        this.emit('connected');
        this.startHeartbeat();
        this.flushMessageQueue();
      });

      this.ws!.on('message', (data: Buffer) => {
        this.state.lastMessageTime = Date.now();
        this.state.messagesReceived++;
        this.emit('message', data);
      });

      this.ws!.on('error', (error: Error) => {
        this.emit('error', error);
      });

      this.ws!.on('close', () => {
        this.handleDisconnect();
      });
    } catch (error) {
      this.state.connecting = false;
      this.emit('error', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.state.reconnectAttempts = this.config.maxReconnectAttempts; // 防止自动重连
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * 发送消息
   */
  send(data: string | Buffer, cb?: () => void): void {
    if (!this.state.connected) {
      // 加入队列
      if (this.messageQueue.length < this.config.messageQueueSize) {
        this.messageQueue.push({ data, cb });
      }
      return;
    }

    try {
      this.ws!.send(data, (err?: Error) => {
        if (!err) {
          this.state.messagesSent++;
          if (cb) cb();
        } else {
          this.emit('error', err);
        }
      });
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * 获取连接状态
   */
  getState(): ConnectionState {
    return { ...this.state };
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(): void {
    const wasConnected = this.state.connected;
    this.state.connected = false;
    this.state.connecting = false;
    this.state.lastDisconnectTime = Date.now();

    this.stopHeartbeat();

    if (wasConnected) {
      this.emit('disconnected');
    }

    this.scheduleReconnect();
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.state.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.emit('reconnect_failed');
      return;
    }

    this.state.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(1.5, this.state.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.emit('reconnecting', this.state.reconnectAttempts);
      this.connect();
    }, delay);
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.state.connected) {
        return;
      }

      const now = Date.now();
      const timeSinceLastMessage = now - this.state.lastMessageTime;

      // 检查心跳超时
      if (timeSinceLastMessage > this.config.heartbeatTimeout) {
        this.emit('heartbeat_timeout');
        if (this.ws) {
          this.ws.close();
        }
        return;
      }

      // 发送心跳
      try {
        this.send(JSON.stringify({ type: 'ping', timestamp: now }));
      } catch (error) {
        // 忽略心跳错误
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * 刷新消息队列
   */
  private flushMessageQueue(): void {
    const queue = this.messageQueue;
    this.messageQueue = [];

    for (const item of queue) {
      this.send(item.data, item.cb);
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.disconnect();
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.removeAllListeners();
  }
}

/**
 * WebSocket 连接池管理器
 */
export class WebSocketConnectionPool extends EventEmitter {
  private connections = new Map<string, WebSocketConnection>();

  /**
   * 获取或创建连接
   */
  getConnection(url: string, config?: Partial<WebSocketConfig>): WebSocketConnection {
    let connection = this.connections.get(url);

    if (!connection) {
      connection = new WebSocketConnection(url, config);

      connection.on('connected', () => {
        this.emit('connection_connected', url);
      });

      connection.on('disconnected', () => {
        this.emit('connection_disconnected', url);
      });

      connection.on('error', (error) => {
        this.emit('connection_error', url, error);
      });

      connection.on('message', (data) => {
        this.emit('connection_message', url, data);
      });

      connection.on('reconnecting', (attempt) => {
        this.emit('connection_reconnecting', url, attempt);
      });

      this.connections.set(url, connection);
    }

    return connection;
  }

  /**
   * 连接所有连接
   */
  connectAll(): void {
    for (const connection of this.connections.values()) {
      connection.connect();
    }
  }

  /**
   * 断开所有连接
   */
  disconnectAll(): void {
    for (const connection of this.connections.values()) {
      connection.disconnect();
    }
  }

  /**
   * 获取连接状态
   */
  getStats(): Array<{
    url: string;
    state: ConnectionState;
  }> {
    return Array.from(this.connections.entries()).map(([url, conn]) => ({
      url,
      state: conn.getState(),
    }));
  }

  /**
   * 移除连接
   */
  removeConnection(url: string): void {
    const connection = this.connections.get(url);
    if (connection) {
      connection.destroy();
      this.connections.delete(url);
    }
  }

  /**
   * 清理所有连接
   */
  destroy(): void {
    for (const connection of this.connections.values()) {
      connection.destroy();
    }
    this.connections.clear();
    this.removeAllListeners();
  }
}

// 创建全局单例
export const wsConnectionPool = new WebSocketConnectionPool();
