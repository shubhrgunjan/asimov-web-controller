import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface EnvironmentLoadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export class Environment {
  public readonly group: THREE.Group;
  public model: THREE.Group | null = null;
  public isLoaded: boolean = false;

  private hemiLight!: THREE.HemisphereLight;
  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;

  constructor(private scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'PAIR_Lab_Environment';
    this.scene.add(this.group);

    this.setupLighting();
  }

  private setupLighting(): void {
    // Environmental Fill Lighting matching authoritative Blender World
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.2);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(this.ambientLight);

    // Overhead directional sun for clean contact shadows
    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    this.sunLight.position.set(5, 12, 5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 40;
    this.sunLight.shadow.camera.left = -12;
    this.sunLight.shadow.camera.right = 12;
    this.sunLight.shadow.camera.top = 12;
    this.sunLight.shadow.camera.bottom = -12;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
  }

  public async load(
    glbUrl: string = '/assets/pair_lab.glb',
    onProgress?: (progress: EnvironmentLoadProgress) => void
  ): Promise<THREE.Group> {
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        glbUrl,
        (gltf) => {
          this.model = gltf.scene;
          this.model.name = 'PAIR_Lab_Model';

          // 1. Remove floating black cube artifacts (e.g. Cube.001 in air)
          const toRemove: THREE.Object3D[] = [];
          this.model.traverse((child) => {
            if (
              child.name === 'Cube.001' ||
              (child.name.startsWith('Cube') && child.position.y > 1.5)
            ) {
              toRemove.push(child);
            }
          });
          for (const obj of toRemove) {
            obj.visible = false;
            if (obj.parent) obj.parent.remove(obj);
          }

          // 2. Setup shadows and sRGB color space
          this.model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              if (mesh.material) {
                const mats = Array.isArray(mesh.material)
                  ? mesh.material
                  : [mesh.material];
                mats.forEach((m: any) => {
                  if (m.map) {
                    m.map.colorSpace = THREE.SRGBColorSpace;
                    m.map.needsUpdate = true;
                  }
                });
              }
            }
          });

          this.group.add(this.model);
          this.isLoaded = true;
          resolve(this.model);
        },
        (xhr) => {
          if (xhr.lengthComputable && onProgress) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            onProgress({
              loaded: xhr.loaded,
              total: xhr.total,
              percent,
            });
          }
        },
        (err) => {
          console.error('[Environment] Failed to load pair_lab.glb:', err);
          reject(err);
        }
      );
    });
  }
}
