import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Robot } from './Robot';

export type CameraMode = 'FIRST_PERSON' | 'THIRD_PERSON' | 'OVERVIEW';

export class CameraManager {
  public currentMode: CameraMode = 'THIRD_PERSON';

  public readonly camera: THREE.PerspectiveCamera;
  public readonly controls: OrbitControls;

  private scratchPos: THREE.Vector3 = new THREE.Vector3();
  private scratchLookAt: THREE.Vector3 = new THREE.Vector3();
  private scratchForward: THREE.Vector3 = new THREE.Vector3();

  // Smooth camera following
  private currentCameraPos: THREE.Vector3 = new THREE.Vector3(0, 2, 4);

  constructor(
    private domElement: HTMLElement,
    private robot: Robot
  ) {
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );

    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // Keep above floor
    this.controls.target.set(0, 0.8, 0);

    // Initial camera position (Third-Person)
    this.setMode('THIRD_PERSON');
  }

  public setMode(mode: CameraMode): void {
    this.currentMode = mode;

    if (mode === 'OVERVIEW') {
      this.controls.enabled = true;
      this.camera.position.set(-10, 8, 10);
      this.robot.getPelvisWorldPosition(this.scratchPos);
      this.controls.target.copy(this.scratchPos);
      this.controls.update();
    } else {
      this.controls.enabled = false;
    }
  }

  public update(deltaTime: number): void {
    if (this.currentMode === 'OVERVIEW') {
      this.controls.update();
      return;
    }

    if (this.currentMode === 'FIRST_PERSON') {
      // First-person view from robot head
      this.robot.getHeadWorldPosition(this.scratchPos);
      this.robot.getForwardVector(this.scratchForward);

      this.camera.position.copy(this.scratchPos);
      this.scratchLookAt.copy(this.scratchPos).add(this.scratchForward.multiplyScalar(5));
      this.camera.lookAt(this.scratchLookAt);
      return;
    }

    if (this.currentMode === 'THIRD_PERSON') {
      // Third-person chase follow view
      this.robot.getPelvisWorldPosition(this.scratchPos);
      this.robot.getForwardVector(this.scratchForward);

      // Target position: 2.4m behind, 0.9m above
      const desiredPos = this.scratchPos.clone()
        .sub(this.scratchForward.clone().multiplyScalar(2.4))
        .add(new THREE.Vector3(0, 0.9, 0));

      // Target lookat: 0.2m above robot center
      const desiredLookAt = this.scratchPos.clone().add(new THREE.Vector3(0, 0.4, 0));

      // Smooth lag dampening
      const lerpFactor = Math.min(1.0, deltaTime * 8.0);
      this.currentCameraPos.lerp(desiredPos, lerpFactor);

      this.camera.position.copy(this.currentCameraPos);
      this.camera.lookAt(desiredLookAt);
    }
  }

  public onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
