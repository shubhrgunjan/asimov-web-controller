import './style.css';
import * as THREE from 'three';
import { Environment } from './scene/Environment';
import { Robot } from './scene/Robot';
import { CameraManager } from './scene/CameraManager';
import { StateBuffer } from './synchronization/StateBuffer';
import { AsimovConnection } from './connection/AsimovConnection';
import { SessionDiscovery } from './connection/SessionDiscovery';
import { KeyboardController } from './controls/KeyboardController';
import { CommandPublisher } from './controls/CommandPublisher';
import { StatusIndicator } from './ui/StatusIndicator';
import { DeveloperOverlay } from './ui/DeveloperOverlay';
import { RobotMode, RecoveryState } from './protocol/AsimovStateProtocol';

class AsimovWebControllerApp {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;

  private environment: Environment;
  private robot: Robot;
  private cameraManager: CameraManager;
  private stateBuffer: StateBuffer;

  private connection: AsimovConnection;
  private discovery: SessionDiscovery;
  private keyboard: KeyboardController;
  private commandPublisher: CommandPublisher;

  private statusIndicator: StatusIndicator;
  private developerOverlay: DeveloperOverlay;

  private lastFrameTime: number = performance.now();
  private frameCount: number = 0;
  private fps: number = 60;
  private lastFpsCheck: number = performance.now();

  constructor() {
    this.container = document.getElementById('app') || document.body;

    // 1. Scene setup with minimal light styling
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8fafc); // Clean light slate-50

    // 2. High-performance WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 3. 3D Environment (reusing authoritative PAIR Lab)
    this.environment = new Environment(this.scene);
    this.environment.load('/assets/pair_lab.glb').catch((err) => {
      console.warn('[App] Error loading pair_lab.glb:', err);
    });

    // 4. Robot model (reusing 25-joint Asimov kinematic hierarchy)
    this.robot = new Robot();
    this.scene.add(this.robot.rootGroup);
    this.robot.loadModel('/assets/asimov_1_mobile.glb').catch((err) => {
      console.warn('[App] Error loading robot model:', err);
    });

    // 5. Camera Manager (1: First-person, 2: Third-person follow, 3: Overview)
    this.cameraManager = new CameraManager(this.renderer.domElement, this.robot);

    // 6. Temporal State Buffer & Interpolator (absorbs jitter for 60 FPS visual smoothness)
    this.stateBuffer = new StateBuffer();

    // 7. Minimal UI
    this.statusIndicator = new StatusIndicator(this.container);
    this.developerOverlay = new DeveloperOverlay(this.container);

    // 8. Asimov Connection & Discovery
    this.connection = new AsimovConnection(
      (state) => {
        this.stateBuffer.pushState(state);
      },
      (status) => {
        this.statusIndicator.updateStatus(status);
      }
    );

    this.discovery = new SessionDiscovery(
      [
        'http://127.0.0.1:8852/session',
        'http://127.0.0.1:8852/status',
        'http://localhost:8852/session',
      ],
      (session) => {
        console.log('[App] Discovered session:', session.sessionId, session.wsUrl);
        this.connection.setEndpoint(session.wsUrl);
        this.connection.connect();
      },
      () => {
        console.log('[App] Session lost. Re-probing...');
        this.connection.disconnect();
      }
    );

    // 9. Keyboard controls & Command Publisher
    this.keyboard = new KeyboardController({
      onCameraChange: (modeNum) => {
        if (modeNum === 1) this.cameraManager.setMode('FIRST_PERSON');
        else if (modeNum === 2) this.cameraManager.setMode('THIRD_PERSON');
        else if (modeNum === 3) this.cameraManager.setMode('OVERVIEW');
      },
      onStop: () => {
        this.commandPublisher.sendStop();
      },
      onReset: () => {
        this.commandPublisher.sendReset();
      },
      onToggleDebug: () => {
        this.developerOverlay.toggle();
      },
    });

    this.commandPublisher = new CommandPublisher(this.connection, this.keyboard);

    // 10. Window resize
    window.addEventListener('resize', this.onResize);

    // Start discovery and dispatch
    this.discovery.start();
    this.connection.connect();
    this.commandPublisher.start();

    // Begin render loop
    requestAnimationFrame(this.renderLoop);
  }

  private onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.cameraManager.onResize(width, height);
  };

  private renderLoop = (): void => {
    requestAnimationFrame(this.renderLoop);

    const now = performance.now();
    const deltaTime = Math.min(0.1, (now - this.lastFrameTime) / 1000.0);
    this.lastFrameTime = now;

    // Measure FPS
    this.frameCount++;
    if (now - this.lastFpsCheck >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsCheck = now;
    }

    // Authoritative State Interpolation:
    // Update robot visual transform strictly from MuJoCo ground truth
    const pose = this.stateBuffer.getInterpolatedPose(now);
    if (pose) {
      this.robot.applyBasePose(pose.basePosition, pose.baseOrientation);
      this.robot.applySimJointState(pose.jointPositions);
    }

    // Camera follow update
    this.cameraManager.update(deltaTime);

    // Render frame
    this.renderer.render(this.scene, this.cameraManager.camera);

    // Update developer debug overlay if active
    if (this.developerOverlay) {
      const latestState = this.stateBuffer.getLatestState();
      this.developerOverlay.update({
        connectionStatus: this.connection.metrics.status,
        sessionId: 'asimov-local-sim',
        transport: 'WebSocket (Binary VAS1/VAC1)',
        latencyMs: latestState ? (now - this.connection.metrics.lastPacketArrivalWallTime) : 0,
        renderFps: this.fps,
        stateRateHz: this.connection.metrics.packetRateHz,
        commandRateHz: this.commandPublisher.commandRateHz,
        robotMode: latestState ? RobotMode[latestState.robotMode] || 'UNKNOWN' : 'WAITING',
        recoveryState: latestState ? RecoveryState[latestState.recoveryState] || 'NORMAL' : 'NORMAL',
        position: latestState ? latestState.basePosition : [0, 0, 0],
        orientation: latestState ? latestState.baseOrientation : [0, 0, 0, 1],
        activeCamera: this.cameraManager.currentMode,
      });
    }
  };
}

// Instantiate on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new AsimovWebControllerApp();
});
