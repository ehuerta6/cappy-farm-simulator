import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { GRID_SIZE, type Action, type Direction, type FarmState } from './simulation';

const facing: Record<Direction, number> = { right: Math.PI, down: -Math.PI / 2, left: 0, up: Math.PI / 2 };

export class FarmView {
  private engine: Engine;
  private scene: Scene;
  private cappy: TransformNode;
  private body: Mesh;
  private feet: Mesh[] = [];
  private marker: Mesh;
  private sprouts = new Map<string, TransformNode>();
  private animating = false;
  private shadows: ShadowGenerator;
  private materials = new Map<string, StandardMaterial>();

  constructor(canvas: HTMLCanvasElement, initial: FarmState) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromHexString('#eae6d9ff');
    this.scene.ambientColor = Color3.FromHexString('#d5d3bc');
    const camera = new ArcRotateCamera('camera', Math.PI / 3, Math.PI / 3.2, 15, new Vector3(0, 0.2, 0), this.scene);
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.minZ = 0.1;
    const resize = () => {
      this.engine.resize();
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      const half = Math.max(5.0, 5.6 / aspect);
      camera.orthoTop = half;
      camera.orthoBottom = -half;
      camera.orthoLeft = -half * aspect;
      camera.orthoRight = half * aspect;
    };
    new ResizeObserver(resize).observe(canvas);
    new HemisphericLight('sky', new Vector3(0, 1, 0), this.scene).intensity = 0.7;
    const sun = new DirectionalLight('sun', new Vector3(-0.6, -1.3, 0.5), this.scene);
    sun.position = new Vector3(5, 10, -5);
    sun.intensity = 0.8;
    sun.diffuse = Color3.FromHexString('#fff0cf');
    this.shadows = new ShadowGenerator(1024, sun);
    this.shadows.useBlurExponentialShadowMap = true;
    this.shadows.blurKernel = 24;
    this.shadows.setDarkness(0.18);
    this.box('earth', new Vector3(0, -0.38, 0), new Vector3(6.65, 0.7, 6.65), '#bb9470');
    this.box('grass rim', new Vector3(0, -0.055, 0), new Vector3(6.7, 0.14, 6.7), '#9dab77');
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const soil = initial.tiles[y][x].terrain === 'soil';
        const tile = this.box(`tile ${x},${y}`, this.world(x, y, 0.03), new Vector3(0.96, 0.07, 0.96),
          soil ? '#987052' : (x + y) % 2 ? '#afbf88' : '#b6c58f');
        tile.receiveShadows = true;
        if (soil) for (let r = 0; r < 3; r++) {
          this.box('furrow', this.world(x, y, 0.072).add(new Vector3(0, 0, (r - 1) * 0.23)), new Vector3(0.73, 0.025, 0.025), '#7f5c43');
        }
      }
    }
    this.decorate();
    this.cappy = new TransformNode('Cappy', this.scene);
    this.body = this.sphere('body', new Vector3(0, 0.48, 0), new Vector3(0.83, 0.55, 0.48), '#ac7d52', this.cappy);
    this.sphere('head', new Vector3(0.35, 0.64, 0), new Vector3(0.51, 0.47, 0.44), '#bc8c5f', this.cappy);
    this.sphere('muzzle', new Vector3(0.57, 0.52, 0), new Vector3(0.28, 0.23, 0.38), '#c89769', this.cappy);
    for (const z of [-0.16, 0.16]) {
      this.sphere('ear', new Vector3(0.28, 0.87, z), new Vector3(0.13, 0.17, 0.1), '#ac7d52', this.cappy);
      this.sphere('inner ear', new Vector3(0.31, 0.89, z * 1.12), new Vector3(0.065, 0.09, 0.05), '#daae85', this.cappy);
      this.sphere('eye', new Vector3(0.47, 0.69, z * 1.33), new Vector3(0.058, 0.062, 0.04), '#382e25', this.cappy);
      this.sphere('nose', new Vector3(0.7, 0.56, z * 0.6), new Vector3(0.025, 0.035, 0.045), '#69503b', this.cappy);
      for (const x of [-0.24, 0.25]) {
        this.feet.push(this.sphere('foot', new Vector3(x, 0.22, z), new Vector3(0.16, 0.29, 0.15), '#946b48', this.cappy));
      }
    }
    this.marker = CreateTorus('current tile', { diameter: 0.91, thickness: 0.027, tessellation: 40 }, this.scene);
    const markerMat = this.material('#f6e8b8');
    markerMat.emissiveColor = Color3.FromHexString('#645a33');
    this.marker.material = markerMat;
    this.sync(initial);
    resize();
    this.engine.runRenderLoop(() => {
      if (!this.animating) {
        this.body.scaling.y = 1 + Math.sin(performance.now() / 650) * 0.015;
      }
      this.scene.render();
    });
  }
  private material(color: string) {
    let material = this.materials.get(color);
    if (!material) {
      material = new StandardMaterial(color, this.scene);
      material.diffuseColor = Color3.FromHexString(color);
      material.specularColor = Color3.Black();
      this.materials.set(color, material);
    }
    return material;
  }
  private box(name: string, at: Vector3, size: Vector3, color: string, parent?: TransformNode) {
    const mesh = CreateBox(name, { width: size.x, height: size.y, depth: size.z }, this.scene);
    mesh.position = at;
    mesh.material = this.material(color);
    if (parent) mesh.parent = parent;
    mesh.receiveShadows = true;
    this.shadows.addShadowCaster(mesh);
    return mesh;
  }
  private sphere(name: string, at: Vector3, size: Vector3, color: string, parent?: TransformNode) {
    const mesh = CreateSphere(name, { diameterX: size.x, diameterY: size.y, diameterZ: size.z, segments: 5 }, this.scene);
    mesh.position = at;
    mesh.material = this.material(color);
    if (parent) mesh.parent = parent;
    this.shadows.addShadowCaster(mesh);
    return mesh;
  }
  private world(x: number, y: number, height = 0.08) { return new Vector3(2.5 - x, height, y - 2.5); }
  private decorate() {
    // Decorations stay outside the playable grid.
    for (let i = 0; i <= 6; i++) {
      this.box('fence post', new Vector3(i - 3, 0.33, -3.15), new Vector3(0.11, 0.66, 0.11), '#eddfba');
      if (i < 6) for (const h of [0.25, 0.53]) {
        this.box('fence rail', new Vector3(i - 2.5, h, -3.15), new Vector3(1, 0.08, 0.08), '#e4d4ac');
      }
    }
    const tree = new TransformNode('tree', this.scene);
    tree.position = new Vector3(-2.9, 0, -2.55);
    this.box('trunk', new Vector3(0, 0.62, 0), new Vector3(0.21, 1.2, 0.21), '#9d7c58', tree);
    this.sphere('leaves', new Vector3(0, 1.48, 0), new Vector3(1.4, 1.45, 1.2), '#708757', tree);
    this.sphere('leaves', new Vector3(0.45, 1.38, 0.18), new Vector3(0.9, 1, 0.9), '#849962', tree);
    this.sphere('rock', new Vector3(2.95, 0.2, 2.6), new Vector3(0.5, 0.35, 0.4), '#a7a799');
    this.sphere('rock', new Vector3(2.65, 0.12, 2.87), new Vector3(0.28, 0.2, 0.3), '#c4c2b1');
    for (const [x, z] of [[-3, 1.2], [-2.9, 1.5], [-3.05, 2], [2.7, -2.7], [2.95, -2.5]]) {
      this.box('flower stem', new Vector3(x, 0.14, z), new Vector3(0.035, 0.22, 0.035), '#748f56');
      this.sphere('flower', new Vector3(x, 0.27, z), new Vector3(0.15, 0.12, 0.15), '#f3d08a');
    }
  }
  private sprout(x: number, y: number) {
    const root = new TransformNode('carrot', this.scene);
    root.position = this.world(x, y, 0.095);
    this.sphere('carrot top', new Vector3(0, 0.07, 0), new Vector3(0.2, 0.16, 0.2), '#e49b50', root);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const leaf = this.sphere('carrot leaf', new Vector3(Math.cos(angle) * 0.09, 0.24, Math.sin(angle) * 0.09), new Vector3(0.11, 0.4, 0.1), i % 2 ? '#678c48' : '#7d9c50', root);
      leaf.rotation.z = Math.cos(angle) * 0.45;
      leaf.rotation.x = Math.sin(angle) * 0.45;
    }
    return root;
  }
  sync(state: FarmState) {
    this.cappy.position.copyFrom(this.world(state.cappy.x, state.cappy.y));
    this.cappy.rotation.set(0, facing[state.cappy.direction], 0);
    this.body.scaling.y = 1;
    this.feet.forEach(foot => { foot.rotation.z = 0; });
    this.marker.position.copyFrom(this.world(state.cappy.x, state.cappy.y, 0.085));
    for (const [key, node] of this.sprouts) {
      const [x, y] = key.split(',').map(Number);
      if (!state.tiles[y][x].planted) { node.dispose(false, false); this.sprouts.delete(key); }
    }
    state.tiles.forEach((row, y) => row.forEach((tile, x) => {
      const key = `${x},${y}`;
      if (tile.planted && !this.sprouts.has(key)) this.sprouts.set(key, this.sprout(x, y));
    }));
  }
  private tween(duration: number, signal: AbortSignal, update: (progress: number) => void) {
    this.animating = true;
    return new Promise<void>((resolve, reject) => {
      let frame = 0;
      const start = performance.now();
      const abort = () => {
        cancelAnimationFrame(frame);
        this.animating = false;
        reject(new DOMException('Stopped', 'AbortError'));
      };
      if (signal.aborted) { abort(); return; }
      signal.addEventListener('abort', abort, { once: true });
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        update(progress);
        if (progress < 1) frame = requestAnimationFrame(step);
        else {
          signal.removeEventListener('abort', abort);
          this.animating = false;
          resolve();
        }
      };
      frame = requestAnimationFrame(step);
    });
  }
  async act(action: Action, next: FarmState, signal: AbortSignal) {
    if (action.kind === 'move') {
      const start = this.cappy.position.clone();
      const end = this.world(next.cappy.x, next.cappy.y);
      this.cappy.rotation.y = facing[next.cappy.direction];
      await this.tween(650, signal, t => {
        const smooth = t * t * (3 - 2 * t);
        this.cappy.position.copyFrom(Vector3.Lerp(start, end, smooth));
        this.cappy.position.y += Math.sin(t * Math.PI * 4) ** 2 * 0.04;
        this.feet.forEach((foot, i) => { foot.rotation.z = Math.sin(t * Math.PI * 4 + i * Math.PI) * 0.35; });
      });
    } else {
      await this.tween(700, signal, t => {
        this.cappy.rotation.z = -Math.sin(t * Math.PI) * 0.21;
        this.body.scaling.y = 1 - Math.sin(t * Math.PI) * 0.08;
      });
    }
    this.sync(next);
  }
  async celebrate(signal: AbortSignal) {
    const y = this.cappy.position.y;
    await this.tween(500, signal, t => { this.cappy.position.y = y + Math.abs(Math.sin(t * Math.PI * 2)) * 0.22; });
  }
  async confused(signal: AbortSignal) {
    const angle = this.cappy.rotation.y;
    await this.tween(350, signal, t => { this.cappy.rotation.y = angle + Math.sin(t * Math.PI * 4) * 0.15; });
  }
}
