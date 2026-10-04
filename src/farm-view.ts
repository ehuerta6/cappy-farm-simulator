import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { type Action, type Direction, type FarmState } from './simulation';
import { Art } from './art';
import { CappyModel } from './cappy-model';
import { createGround, createDecorations, createCarrot } from './farm-models';

// The character's authored front is +Z; grid/world coordinates stay separate.
const facing: Record<Direction, number> = { right: -Math.PI / 2, down: 0, left: Math.PI / 2, up: Math.PI };

export class FarmView {
  private engine: Engine;
  private scene: Scene;
  private cappy: CappyModel;
  private art: Art;
  private marker: Mesh;
  private sprouts = new Map<string, TransformNode>();
  private animating = false;

  constructor(canvas: HTMLCanvasElement, initial: FarmState) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromHexString('#eae6d9ff');
    const camera = new ArcRotateCamera('camera', Math.PI * 2 / 3, Math.PI / 3.05, 15, new Vector3(0, .35, 0), this.scene);
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.minZ = .1;
    const resize = () => {
      this.engine.resize();
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      const half = Math.max(4.65, 5.25 / aspect);
      camera.orthoTop = half;
      camera.orthoBottom = -half;
      camera.orthoLeft = -half * aspect;
      camera.orthoRight = half * aspect;
    };
    new ResizeObserver(resize).observe(canvas);
    const sky = new HemisphericLight('warm sky fill', new Vector3(-.4, 1, .6), this.scene);
    sky.intensity = .9;
    sky.groundColor = Color3.FromHexString('#c6b794').scale(.45);
    const sun = new DirectionalLight('afternoon sun', new Vector3(.5, -1.5, -.55), this.scene);
    sun.position = new Vector3(-5, 10, 5);
    sun.intensity = .45;
    sun.diffuse = Color3.FromHexString('#fff1dc');
    const shadows = new ShadowGenerator(2048, sun);
    shadows.useBlurExponentialShadowMap = true;
    shadows.blurKernel = 24;
    shadows.setDarkness(.22);
    this.art = new Art(this.scene, shadows);
    createGround(this.art, initial, (x, y, height) => this.world(x, y, height));
    createDecorations(this.art);
    this.cappy = new CappyModel(this.art);
    this.marker = CreateTorus('current tile', { diameter: .94, thickness: .025, tessellation: 40 }, this.scene);
    this.marker.material = this.art.material('#f2e2ae');
    this.sync(initial);
    resize();
    this.engine.runRenderLoop(() => {
      if (!this.animating) this.cappy.idle(performance.now());
      this.scene.render();
    });
  }
  private world(x: number, y: number, height = .105) { return new Vector3(2.5 - x, height, y - 2.5); }
  private sprout(x: number, y: number) { return createCarrot(this.art, this.world(x, y, .108)); }
  sync(state: FarmState) {
    this.cappy.root.position.copyFrom(this.world(state.cappy.x, state.cappy.y));
    this.cappy.root.rotation.set(0, facing[state.cappy.direction], 0);
    this.cappy.rest();
    this.marker.position.copyFrom(this.world(state.cappy.x, state.cappy.y, .111));
    for (const [key, node] of this.sprouts) {
      const [x, y] = key.split(',').map(Number);
      if (!state.tiles[y][x].planted) { node.dispose(false, false); this.sprouts.delete(key); }
      else node.scaling.setAll(1);
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
      const start = this.cappy.root.position.clone();
      const end = this.world(next.cappy.x, next.cappy.y);
      const startAngle = this.cappy.root.rotation.y;
      let turn = facing[next.cappy.direction] - startAngle;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      await this.tween(750, signal, t => {
        const smooth = t * t * (3 - 2 * t);
        this.cappy.root.position.copyFrom(Vector3.Lerp(start, end, smooth));
        this.cappy.root.rotation.y = startAngle + turn * Math.min(1, t * 4);
        this.cappy.walk(t);
      });
    } else {
      const key = `${next.cappy.x},${next.cappy.y}`;
      await this.tween(900, signal, t => {
        this.cappy.plant(t);
        if (t > .62) {
          if (!this.sprouts.has(key)) this.sprouts.set(key, this.sprout(next.cappy.x, next.cappy.y));
          this.sprouts.get(key)!.scaling.setAll(Math.min(1, .1 + (t - .62) / .25));
        }
      });
    }
    this.sync(next);
  }
  async celebrate(signal: AbortSignal) {
    await this.tween(650, signal, t => this.cappy.celebrate(t));
    this.cappy.rest();
  }
  async confused(signal: AbortSignal) {
    await this.tween(450, signal, t => this.cappy.confused(t));
    this.cappy.rest();
  }
}
