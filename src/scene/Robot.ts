import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  ASIMOV_JOINTS,
  JointDefinition,
  CANONICAL_SIM_JOINTS,
  ASIMOV_TOTAL_JOINTS,
} from '../model/AsimovJointHierarchy';

interface JointNodeRef {
  def: JointDefinition;
  node: THREE.Object3D;
  basePosition: THREE.Vector3;
  baseQuaternion: THREE.Quaternion;
  axisVector: THREE.Vector3;
  scratchQuat: THREE.Quaternion;
  currentAngle: number;
}

export class Robot {
  public readonly rootGroup: THREE.Group;
  public readonly modelContainer: THREE.Group;

  private jointNodes: Map<string, JointNodeRef> = new Map();
  private canonicalJointNodes: (JointNodeRef | null)[] = new Array(25).fill(null);
  public isLoaded: boolean = false;
  private headNode: THREE.Object3D | null = null;
  private pelvisNode: THREE.Object3D | null = null;

  // Pre-allocated coordinate transformation quaternions
  private readonly scratchBaseQuat: THREE.Quaternion = new THREE.Quaternion();
  private readonly coordQuat: THREE.Quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2)
  );
  private readonly coordQuatInv: THREE.Quaternion = this.coordQuat.clone().invert();

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'Asimov1_Robot_Root';

    this.modelContainer = new THREE.Group();
    this.modelContainer.name = 'Asimov1_Kinematic_Container';

    // Coordinate Transform: Map MuJoCo (+Z Up, +X Forward, +Y Left)
    // to Three.js (+Y Up, -Z Forward, +X Right / -X Left)
    this.modelContainer.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    this.rootGroup.add(this.modelContainer);

    // Initial standing height so feet rest naturally at ground level
    this.rootGroup.position.set(0, 0.63, 0);

    // Build procedural fallback immediately for 0-delay instant display
    this.buildProceduralModel();
  }

  private buildProceduralModel(): void {
    const alloyMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.2,
      roughness: 0.4,
    });
    const darkAlloyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.15,
      roughness: 0.5,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.25,
      roughness: 0.4,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
    });

    const bodyMap = new Map<string, THREE.Group>();

    // 1. Pelvis Link
    const pelvisLink = new THREE.Group();
    pelvisLink.name = 'pelvis_link';
    this.modelContainer.add(pelvisLink);
    bodyMap.set('pelvis_link', pelvisLink);
    this.pelvisNode = pelvisLink;

    const pelvisBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.14), darkAlloyMat);
    pelvisBody.castShadow = true;
    pelvisBody.receiveShadow = true;
    pelvisLink.add(pelvisBody);

    const pelvisCore = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.02), glowMat);
    pelvisCore.position.set(0.091, 0, 0);
    pelvisLink.add(pelvisCore);

    // 2. Build canonical kinematic tree from ASIMOV_JOINTS
    for (const [jName, jDef] of Object.entries(ASIMOV_JOINTS)) {
      const childGroup = new THREE.Group();
      childGroup.name = jDef.nodeName;
      childGroup.position.set(jDef.defaultPos[0], jDef.defaultPos[1], jDef.defaultPos[2]);
      childGroup.quaternion.set(
        jDef.defaultQuat[0],
        jDef.defaultQuat[1],
        jDef.defaultQuat[2],
        jDef.defaultQuat[3]
      );

      const parentNode = bodyMap.get(jDef.parentBody) || pelvisLink;
      parentNode.add(childGroup);
      bodyMap.set(jDef.nodeName, childGroup);

      if (jDef.nodeName.includes('knee')) {
        const shin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.24), alloyMat);
        shin.position.set(0, 0, -0.12);
        shin.castShadow = true;
        shin.receiveShadow = true;
        const kneeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 16), jointMat);
        kneeCap.rotation.z = Math.PI / 2;
        kneeCap.castShadow = true;
        childGroup.add(kneeCap);
        childGroup.add(shin);
      } else if (jDef.nodeName.includes('hip_pitch')) {
        const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.24), darkAlloyMat);
        thigh.position.set(0, 0, -0.12);
        thigh.castShadow = true;
        thigh.receiveShadow = true;
        childGroup.add(thigh);
      } else if (jDef.nodeName.includes('ankle_roll')) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.04), darkAlloyMat);
        foot.position.set(0.04, 0, -0.02);
        foot.castShadow = true;
        foot.receiveShadow = true;
        childGroup.add(foot);
      } else if (jDef.nodeName.includes('head_pitch')) {
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), darkAlloyMat);
        head.position.set(0.02, 0, 0.06);
        head.castShadow = true;
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.04), glowMat);
        visor.position.set(0.08, 0, 0.06);
        childGroup.add(head);
        childGroup.add(visor);
        this.headNode = childGroup;
      } else if (jDef.nodeName.includes('shoulder_pitch')) {
        const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.18), alloyMat);
        upperArm.position.set(0, 0, -0.09);
        upperArm.castShadow = true;
        childGroup.add(upperArm);
      } else if (jDef.nodeName.includes('elbow')) {
        const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.16), darkAlloyMat);
        forearm.position.set(0, 0, -0.08);
        forearm.castShadow = true;
        childGroup.add(forearm);
      } else if (jDef.nodeName.includes('torso')) {
        const chest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.26), alloyMat);
        chest.position.set(0, 0, 0.13);
        chest.castShadow = true;
        chest.receiveShadow = true;
        childGroup.add(chest);
      }

      const ref: JointNodeRef = {
        def: jDef,
        node: childGroup,
        basePosition: childGroup.position.clone(),
        baseQuaternion: childGroup.quaternion.clone(),
        axisVector: new THREE.Vector3(jDef.axis[0], jDef.axis[1], jDef.axis[2]).normalize(),
        scratchQuat: new THREE.Quaternion(),
        currentAngle: 0.0,
      };
      this.jointNodes.set(jName, ref);
    }

    for (let i = 0; i < CANONICAL_SIM_JOINTS.length; i++) {
      this.canonicalJointNodes[i] = this.jointNodes.get(CANONICAL_SIM_JOINTS[i]) || null;
    }
  }

  public async loadModel(glbUrl: string = '/assets/asimov_1_mobile.glb'): Promise<void> {
    const loader = new GLTFLoader();

    try {
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(glbUrl, (g) => resolve(g), undefined, (err) => reject(err));
      });

      const scene = gltf.scene;

      scene.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.roughness = 0.4;
            child.material.metalness = 0.2;
          }
        }
      });

      const newJointNodes: Map<string, JointNodeRef> = new Map();
      for (const [jName, jDef] of Object.entries(ASIMOV_JOINTS)) {
        const node = scene.getObjectByName(jDef.nodeName);
        if (node) {
          const ref: JointNodeRef = {
            def: jDef,
            node,
            basePosition: node.position.clone(),
            baseQuaternion: node.quaternion.clone(),
            axisVector: new THREE.Vector3(jDef.axis[0], jDef.axis[1], jDef.axis[2]).normalize(),
            scratchQuat: new THREE.Quaternion(),
            currentAngle: 0.0,
          };
          newJointNodes.set(jName, ref);
        }
      }

      if (newJointNodes.size >= 20) {
        while (this.modelContainer.children.length > 0) {
          this.modelContainer.remove(this.modelContainer.children[0]);
        }
        this.jointNodes = newJointNodes;
        for (let i = 0; i < CANONICAL_SIM_JOINTS.length; i++) {
          this.canonicalJointNodes[i] = this.jointNodes.get(CANONICAL_SIM_JOINTS[i]) || null;
        }
        this.pelvisNode = scene.getObjectByName('pelvis_link') || null;
        if (this.pelvisNode) {
          this.pelvisNode.position.set(0, 0, 0);
        }
        this.headNode = scene.getObjectByName('head_pitch_link') || null;
        this.modelContainer.add(scene);
      }

      this.isLoaded = true;
    } catch (err) {
      console.log('[Robot] Using procedural 25-joint model fallback:', err);
      this.isLoaded = true;
    }
  }

  /**
   * Fast batch update for all 25 joints from canonical SIM_JOINTS array.
   * Completely zero allocations in the 60 FPS render loop.
   */
  public applySimJointState(jointPositions: Float32Array | number[]): void {
    const len = Math.min(25, jointPositions.length);
    for (let i = 0; i < len; i++) {
      const jRef = this.canonicalJointNodes[i];
      if (!jRef) continue;

      const [minLim, maxLim] = jRef.def.range;
      const val = jointPositions[i];
      const clamped = Math.max(minLim, Math.min(maxLim, val));
      jRef.currentAngle = clamped;

      jRef.scratchQuat.setFromAxisAngle(jRef.axisVector, clamped);
      jRef.node.quaternion.copy(jRef.baseQuaternion).multiply(jRef.scratchQuat);
    }
  }

  /**
   * Apply authoritative 6-DoF base pose from MuJoCo simulation.
   */
  public applyBasePose(
    positionMeters: [number, number, number],
    orientationQuat?: [number, number, number, number]
  ): void {
    // Coordinate transform:
    // MuJoCo X (Forward) -> Three.js -Z
    // MuJoCo Y (Left)    -> Three.js -X
    // MuJoCo Z (Up)      -> Three.js +Y
    this.rootGroup.position.set(
      -positionMeters[1],
      positionMeters[2],
      -positionMeters[0]
    );

    if (orientationQuat) {
      // Input: MuJoCo base orientation [x, y, z, w]
      this.scratchBaseQuat.set(
        orientationQuat[0],
        orientationQuat[1],
        orientationQuat[2],
        orientationQuat[3]
      );
      this.rootGroup.quaternion
        .copy(this.coordQuat)
        .multiply(this.scratchBaseQuat)
        .multiply(this.coordQuatInv);
    }
  }

  public getHeadWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    if (this.headNode) {
      return this.headNode.getWorldPosition(target);
    }
    return this.rootGroup.getWorldPosition(target).add(new THREE.Vector3(0, 0.45, 0));
  }

  public getPelvisWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    return this.rootGroup.getWorldPosition(target);
  }

  public getForwardVector(target: THREE.Vector3): THREE.Vector3 {
    return target.set(0, 0, -1).applyQuaternion(this.rootGroup.quaternion).normalize();
  }
}
