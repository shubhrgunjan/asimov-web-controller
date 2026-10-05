export interface KeyboardState {
  forward: boolean;   // W
  backward: boolean;  // S
  turnLeft: boolean;  // A
  turnRight: boolean; // D
}

export class KeyboardController {
  private keys: Record<string, boolean> = {
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
  };

  private onCameraChange?: (mode: 1 | 2 | 3) => void;
  private onStop?: () => void;
  private onReset?: () => void;
  private onToggleDebug?: () => void;

  constructor(options: {
    onCameraChange?: (mode: 1 | 2 | 3) => void;
    onStop?: () => void;
    onReset?: () => void;
    onToggleDebug?: () => void;
  } = {}) {
    this.onCameraChange = options.onCameraChange;
    this.onStop = options.onStop;
    this.onReset = options.onReset;
    this.onToggleDebug = options.onToggleDebug;

    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // CRITICAL SAFETY BEHAVIOR:
    // On tab blur, visibility loss, or window minimize, release ALL controls
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.releaseAll();
      }
    });
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Ignore key repeat for discrete actions
    if (e.repeat && ['Digit1', 'Digit2', 'Digit3', 'Space', 'KeyR', 'F1'].includes(e.code)) {
      return;
    }

    if (e.code === 'KeyW' || e.key === 'w' || e.key === 'W') {
      this.keys.KeyW = true;
    } else if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') {
      this.keys.KeyS = true;
    } else if (e.code === 'KeyA' || e.key === 'a' || e.key === 'A') {
      this.keys.KeyA = true;
    } else if (e.code === 'KeyD' || e.key === 'd' || e.key === 'D') {
      this.keys.KeyD = true;
    } else if (e.code === 'Space') {
      e.preventDefault();
      this.releaseAll();
      if (this.onStop) this.onStop();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      this.releaseAll();
    } else if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
      if (this.onReset) this.onReset();
    } else if (e.code === 'Digit1') {
      if (this.onCameraChange) this.onCameraChange(1);
    } else if (e.code === 'Digit2') {
      if (this.onCameraChange) this.onCameraChange(2);
    } else if (e.code === 'Digit3') {
      if (this.onCameraChange) this.onCameraChange(3);
    } else if (e.code === 'F1') {
      e.preventDefault();
      if (this.onToggleDebug) this.onToggleDebug();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'KeyW' || e.key === 'w' || e.key === 'W') {
      this.keys.KeyW = false;
    } else if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') {
      this.keys.KeyS = false;
    } else if (e.code === 'KeyA' || e.key === 'a' || e.key === 'A') {
      this.keys.KeyA = false;
    } else if (e.code === 'KeyD' || e.key === 'd' || e.key === 'D') {
      this.keys.KeyD = false;
    }
  };

  public releaseAll = (): void => {
    this.keys.KeyW = false;
    this.keys.KeyS = false;
    this.keys.KeyA = false;
    this.keys.KeyD = false;
  };

  public getState(): KeyboardState {
    return {
      forward: this.keys.KeyW,
      backward: this.keys.KeyS,
      turnLeft: this.keys.KeyA,
      turnRight: this.keys.KeyD,
    };
  }

  public isAnyMovementActive(): boolean {
    return this.keys.KeyW || this.keys.KeyS || this.keys.KeyA || this.keys.KeyD;
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.releaseAll);
  }
}
