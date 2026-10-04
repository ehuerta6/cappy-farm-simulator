import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTube } from '@babylonjs/core/Meshes/Builders/tubeBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';

export type Ring = { y: number; x: number; z: number; offsetZ?: number };
const signedPower = (value: number, exponent: number) => Math.sign(value) * Math.abs(value) ** exponent;

// A small shared palette/geometry helper for the procedural art, not simulation.
export class Art {
  private palette = new Map<string, StandardMaterial>();
  constructor(readonly scene: Scene, private shadows: ShadowGenerator) {}
  material(color: string) {
    let material = this.palette.get(color);
    if (!material) {
      material = new StandardMaterial(color, this.scene);
      material.diffuseColor = Color3.FromHexString(color);
      material.specularColor = Color3.Black();
      this.palette.set(color, material);
    }
    return material;
  }
  finish(mesh: Mesh, color: string, at: Vector3, parent?: TransformNode, shadow = true) {
    mesh.material = this.material(color);
    mesh.position.copyFrom(at);
    mesh.parent = parent ?? null;
    mesh.receiveShadows = true;
    if (shadow) this.shadows.addShadowCaster(mesh);
    return mesh;
  }
  box(name: string, at: Vector3, size: Vector3, color: string, parent?: TransformNode) {
    return this.finish(CreateBox(name, { width: size.x, height: size.y, depth: size.z }, this.scene), color, at, parent);
  }
  sphere(name: string, at: Vector3, size: Vector3, color: string, parent?: TransformNode, segments = 5) {
    return this.finish(CreateSphere(name, { diameterX: size.x, diameterY: size.y, diameterZ: size.z, segments }, this.scene), color, at, parent);
  }
  cylinder(name: string, at: Vector3, height: number, bottom: number, top: number, color: string, parent?: TransformNode, sides = 12) {
    return this.finish(CreateCylinder(name, { height, diameterBottom: bottom, diameterTop: top, tessellation: sides }, this.scene), color, at, parent);
  }
  tube(name: string, points: Vector3[], radius: number, color: string, parent?: TransformNode) {
    return this.finish(CreateTube(name, { path: points, radius, tessellation: 5, cap: Mesh.CAP_ALL }, this.scene), color, Vector3.Zero(), parent);
  }
  // Elliptical rings create an authored silhouette: shoulders, hips, head, brim.
  // exponent < 1 gives a softly squared cross-section instead of a round sphere.
  profile(name: string, rings: Ring[], color: string, parent?: TransformNode, sides = 20, exponent = 1) {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    for (const ring of rings) {
      for (let i = 0; i < sides; i++) {
        const angle = i / sides * Math.PI * 2;
        positions.push(ring.x * signedPower(Math.cos(angle), exponent), ring.y,
          ring.z * signedPower(Math.sin(angle), exponent) + (ring.offsetZ ?? 0));
      }
    }
    for (let row = 0; row < rings.length - 1; row++) for (let i = 0; i < sides; i++) {
      const a = row * sides + i;
      const b = row * sides + (i + 1) % sides;
      const c = b + sides;
      const d = a + sides;
      indices.push(a, b, d, b, c, d);
    }
    for (const top of [false, true]) {
      const ring = top ? rings.at(-1)! : rings[0];
      const center = positions.length / 3;
      positions.push(0, ring.y, ring.offsetZ ?? 0);
      const start = top ? (rings.length - 1) * sides : 0;
      for (let i = 0; i < sides; i++) {
        const a = start + i;
        const b = start + (i + 1) % sides;
        indices.push(...(top ? [center, a, b] : [center, b, a]));
      }
    }
    VertexData.ComputeNormals(positions, indices, normals);
    const data = new VertexData();
    data.positions = positions; data.indices = indices; data.normals = normals;
    const mesh = new Mesh(name, this.scene);
    data.applyToMesh(mesh);
    return this.finish(mesh, color, Vector3.Zero(), parent);
  }
  roundedBox(name: string, at: Vector3, size: Vector3, color: string, parent?: TransformNode, roundness = 0.35) {
    const mesh = this.profile(name, [
      { y: -size.y / 2, x: size.x * .38, z: size.z * .38 },
      { y: -size.y * .35, x: size.x * .49, z: size.z * .49 },
      { y: size.y * .35, x: size.x * .49, z: size.z * .49 },
      { y: size.y / 2, x: size.x * .38, z: size.z * .38 },
    ], color, parent, 24, roundness);
    mesh.position.copyFrom(at);
    return mesh;
  }
}
