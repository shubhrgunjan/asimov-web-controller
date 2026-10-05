import { CommandType } from '../protocol/AsimovStateProtocol';
import { AsimovConnection } from '../connection/AsimovConnection';
import { KeyboardController } from './KeyboardController';

export class CommandPublisher {
  private timer: any = null;
  private isPublishing: boolean = false;
  private wasMoving: boolean = false;

  // Maximum safe operational limits for official policy
  public maxVxForward: number = 0.60; // m/s
  public maxVxReverse: number = 0.35; // m/s
  public maxYawRate: number = 0.55;   // rad/s

  public commandRateHz: number = 0;
  private commandCount: number = 0;
  private lastRateCheck: number = performance.now();

  constructor(
    private connection: AsimovConnection,
    private keyboard: KeyboardController,
    private dispatchIntervalMs: number = 40 // 25 Hz
  ) {}

  public start(): void {
    if (this.isPublishing) return;
    this.isPublishing = true;
    this.loop();
  }

  public stop(): void {
    this.isPublishing = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private loop = (): void => {
    if (!this.isPublishing) return;

    const now = performance.now();
    this.tick();

    // Rate measurement
    this.commandCount++;
    if (now - this.lastRateCheck >= 1000) {
      this.commandRateHz = this.commandCount;
      this.commandCount = 0;
      this.lastRateCheck = now;
    }

    this.timer = setTimeout(this.loop, this.dispatchIntervalMs);
  };

  private tick(): void {
    const state = this.keyboard.getState();

    let vx = 0.0;
    let wz = 0.0;

    if (state.forward && !state.backward) {
      vx = this.maxVxForward;
    } else if (state.backward && !state.forward) {
      vx = -this.maxVxReverse;
    }

    if (state.turnLeft && !state.turnRight) {
      wz = this.maxYawRate; // CCW (turn left)
    } else if (state.turnRight && !state.turnLeft) {
      wz = -this.maxYawRate; // CW (turn right)
    }

    const isMovingNow = vx !== 0.0 || wz !== 0.0;

    if (isMovingNow) {
      this.connection.sendCommand(CommandType.WALK, vx, 0.0, wz);
      this.wasMoving = true;
    } else if (this.wasMoving) {
      // Sent once upon release: zero velocity halt
      this.connection.sendCommand(CommandType.WALK, 0.0, 0.0, 0.0);
      this.wasMoving = false;
    }
  }

  public sendStop(): void {
    this.keyboard.releaseAll();
    this.wasMoving = false;
    this.connection.sendCommand(CommandType.STAND);
  }

  public sendReset(): void {
    this.keyboard.releaseAll();
    this.wasMoving = false;
    this.connection.sendCommand(CommandType.RESET);
  }
}
