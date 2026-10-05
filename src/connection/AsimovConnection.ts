import {
  parseStatePacket,
  serializeCommandPacket,
  AsimovRobotState,
  AsimovControlCommand,
  CommandType,
  STATE_PACKET_SIZE,
  PROTOCOL_VERSION,
} from '../protocol/AsimovStateProtocol';

export type ConnectionStatus =
  | 'WAITING_FOR_SESSION'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'CONNECTION_LOST';

export interface TelemetryMetrics {
  status: ConnectionStatus;
  wsUrl: string;
  packetsReceived: number;
  packetsDropped: number;
  packetRateHz: number;
  lastSequenceNumber: number;
  lastPacketTimestamp: number;
  lastPacketArrivalWallTime: number;
  roundTripTimeMs: number;
  reconnectCount: number;
}

export class AsimovConnection {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'WAITING_FOR_SESSION';
  private wsUrl: string = 'ws://127.0.0.1:8854';
  private autoReconnect: boolean = true;
  private reconnectTimer: any = null;
  private isDestroyed: boolean = false;

  private expectedSequence: number = 0;
  private commandSequence: number = 0;
  private packetTimestamps: number[] = [];

  public metrics: TelemetryMetrics = {
    status: 'WAITING_FOR_SESSION',
    wsUrl: 'ws://127.0.0.1:8854',
    packetsReceived: 0,
    packetsDropped: 0,
    packetRateHz: 0,
    lastSequenceNumber: 0,
    lastPacketTimestamp: 0,
    lastPacketArrivalWallTime: 0,
    roundTripTimeMs: 0,
    reconnectCount: 0,
  };

  constructor(
    private onStateReceived?: (state: AsimovRobotState) => void,
    private onStatusChange?: (status: ConnectionStatus) => void
  ) {}

  public setEndpoint(wsUrl: string): void {
    if (this.wsUrl !== wsUrl) {
      this.wsUrl = wsUrl;
      this.metrics.wsUrl = wsUrl;
      if (this.status === 'CONNECTED' || this.status === 'CONNECTING') {
        this.reconnect();
      }
    }
  }

  public connect(): void {
    if (this.isDestroyed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('CONNECTING');

    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.expectedSequence = 0;
        this.setStatus('CONNECTED');

        // Request binary stream subscription
        try {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ action: 'subscribe', params: { format: 'binary' } }));
          }
        } catch (_) {}
      };

      this.ws.onmessage = (event: MessageEvent) => {
        const now = performance.now();

        // 1. Binary State Packet (50 Hz VAS1)
        if (event.data instanceof ArrayBuffer) {
          this.processBinaryPacket(event.data, now);
        } else if (typeof event.data === 'string') {
          // JSON message (e.g. environment updates, acks)
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'environment') {
              console.log('[AsimovConnection] Environment update received:', data.data?.preset);
            }
          } catch (_) {}
        }
      };

      this.ws.onerror = () => {
        this.handleSocketClose();
      };

      this.ws.onclose = () => {
        this.handleSocketClose();
      };
    } catch (_) {
      this.handleSocketClose();
    }
  }

  private handleSocketClose(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws = null;
    }

    if (this.status === 'CONNECTED') {
      this.setStatus('CONNECTION_LOST');
    } else if (this.status === 'CONNECTING') {
      this.setStatus('WAITING_FOR_SESSION');
    }

    if (this.autoReconnect && !this.isDestroyed) {
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.metrics.reconnectCount++;
          this.connect();
        }, 1500);
      }
    }
  }

  public reconnect(): void {
    this.disconnect();
    this.connect();
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    this.setStatus('WAITING_FOR_SESSION');
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.metrics.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  private processBinaryPacket(buffer: ArrayBuffer, now: number): void {
    if (buffer.byteLength !== STATE_PACKET_SIZE) {
      return;
    }

    let state: AsimovRobotState;
    try {
      state = parseStatePacket(buffer);
    } catch (_) {
      return;
    }

    const seq = state.sequenceNumber;
    if (this.expectedSequence > 0) {
      const gap = seq - this.expectedSequence;
      if (gap > 0) {
        this.metrics.packetsDropped += gap;
      }
    }
    this.expectedSequence = seq + 1;
    this.metrics.lastSequenceNumber = seq;
    this.metrics.packetsReceived++;
    this.metrics.lastPacketTimestamp = state.timestamp;
    this.metrics.lastPacketArrivalWallTime = now;

    // Rate calculation over 1s sliding window
    this.packetTimestamps.push(now);
    const windowStart = now - 1000;
    while (this.packetTimestamps.length > 0 && this.packetTimestamps[0] < windowStart) {
      this.packetTimestamps.shift();
    }
    this.metrics.packetRateHz = this.packetTimestamps.length;

    if (this.onStateReceived) {
      this.onStateReceived(state);
    }
  }

  /**
   * Transmit authoritative 32-byte VAC1 command packet over binary WebSocket
   */
  public sendCommand(
    commandType: CommandType,
    linearX: number = 0.0,
    linearY: number = 0.0,
    yawRate: number = 0.0,
    flags: number = 0
  ): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const command: AsimovControlCommand = {
      protocolVersion: PROTOCOL_VERSION,
      commandType,
      flags,
      sequenceNumber: ++this.commandSequence,
      timestamp: performance.now() / 1000.0,
      linearX,
      linearY,
      yawRate,
    };

    try {
      const packet = serializeCommandPacket(command);
      this.ws.send(packet);
      return true;
    } catch (_) {
      return false;
    }
  }
}
