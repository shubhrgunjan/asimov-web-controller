export interface DiscoveredSession {
  running: boolean;
  sessionId: string;
  transport: 'websocket' | 'webrtc';
  wsUrl: string;
  httpUrl: string;
  robotId: string;
  format: 'binary' | 'json';
  protocol: string;
}

export type DiscoveryStatus = 'SEARCHING' | 'FOUND' | 'UNAVAILABLE';

export class SessionDiscovery {
  private timer: any = null;
  private isSearching: boolean = false;
  private currentSession: DiscoveredSession | null = null;

  constructor(
    private discoveryEndpoints: string[] = [
      'http://127.0.0.1:8852/session',
      'http://127.0.0.1:8852/status',
      'http://localhost:8852/session',
    ],
    private onSessionDiscovered?: (session: DiscoveredSession) => void,
    private onSessionLost?: () => void
  ) {}

  public start(): void {
    if (this.isSearching) return;
    this.isSearching = true;
    this.poll();
  }

  public stop(): void {
    this.isSearching = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.isSearching) return;

    try {
      const session = await this.probe();
      if (session && session.running) {
        if (!this.currentSession) {
          this.currentSession = session;
          if (this.onSessionDiscovered) {
            this.onSessionDiscovered(session);
          }
        }
      } else {
        if (this.currentSession) {
          this.currentSession = null;
          if (this.onSessionLost) {
            this.onSessionLost();
          }
        }
      }
    } catch (_) {
      if (this.currentSession) {
        this.currentSession = null;
        if (this.onSessionLost) {
          this.onSessionLost();
        }
      }
    }

    if (this.isSearching) {
      this.timer = setTimeout(() => this.poll(), 1500);
    }
  }

  private async probe(): Promise<DiscoveredSession | null> {
    for (const endpoint of this.discoveryEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);

        const res = await fetch(endpoint, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();

          // Standard /session response
          if (data.session_id || data.ws_url) {
            return {
              running: Boolean(data.running ?? true),
              sessionId: data.session_id || 'asimov-local-sim',
              transport: data.transport || 'websocket',
              wsUrl: data.ws_url || 'ws://127.0.0.1:8854',
              httpUrl: data.http_url || 'http://127.0.0.1:8852',
              robotId: data.robot_id || 'asimov-1',
              format: data.format || 'binary',
              protocol: data.protocol || 'VAS1',
            };
          }

          // Fallback /status response
          if (data.mode !== undefined || data.base_z !== undefined) {
            return {
              running: true,
              sessionId: 'asimov-local-sim',
              transport: 'websocket',
              wsUrl: 'ws://127.0.0.1:8854',
              httpUrl: 'http://127.0.0.1:8852',
              robotId: 'asimov-1',
              format: 'binary',
              protocol: 'VAS1',
            };
          }
        }
      } catch (_) {
        // Try next endpoint
      }
    }

    return null;
  }
}
