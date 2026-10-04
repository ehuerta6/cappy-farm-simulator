import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Art } from '../src/art';
import { CappyModel } from '../src/cappy-model';

// Test the model/pose data without a GPU, shader assertions, or screenshot diffs.
describe('Cappy character proportions and pose recovery', () => {
  let engine: NullEngine;
  let scene: Scene;
  let cappy: CappyModel;
  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    const light = new DirectionalLight('test light', new Vector3(0, -1, 0), scene);
    cappy = new CappyModel(new Art(scene, new ShadowGenerator(128, light)));
  });
  afterEach(() => engine.dispose());

  it('keeps the belly wider than the head and the feet tucked under the body', () => {
    const body = scene.getMeshByName('pear-shaped fur')!;
    const head = scene.getMeshByName('broad capybara skull')!;
    const feet = scene.meshes.filter(mesh => mesh.name === 'capybara foot');
    for (const mesh of [body, head, ...feet]) mesh.computeWorldMatrix(true);
    const bellyBox = body.getBoundingInfo().boundingBox;
    const headBox = head.getBoundingInfo().boundingBox;
    expect(bellyBox.maximumWorld.x - bellyBox.minimumWorld.x)
      .toBeGreaterThan((headBox.maximumWorld.x - headBox.minimumWorld.x) * 1.2);
    for (const foot of feet) {
      expect(bellyBox.minimumWorld.y).toBeLessThan(foot.getBoundingInfo().boundingBox.maximumWorld.y + .03);
    }
    expect(scene.getMeshByName('small rounded tail')?.parent).toBe(cappy.torso);
  });

  it('leans to plant without moving the paws below their standing ground level', () => {
    const feet = scene.meshes.filter(mesh => mesh.name === 'capybara foot');
    const baseline = feet.map(foot => {
      foot.computeWorldMatrix(true);
      return foot.getBoundingInfo().boundingBox.minimumWorld.y;
    });
    cappy.plant(.5);
    feet.forEach((foot, i) => {
      foot.computeWorldMatrix(true);
      expect(foot.getBoundingInfo().boundingBox.minimumWorld.y).toBeCloseTo(baseline[i], 6);
    });
    expect(cappy.torso.rotation.x).toBeGreaterThan(.4);
  });

  it.each(['walk', 'plant', 'confused', 'celebrate'] as const)('restores the neutral pose after %s, including cancellation', motion => {
    const nodes = [cappy.puppet, cappy.torso, cappy.head, ...cappy.arms, ...cappy.legs];
    const snapshot = () => nodes.map(node => ({
      position: node.position.asArray(), rotation: node.rotation.asArray(), scale: node.scaling.asArray(),
    }));
    const neutral = snapshot();
    cappy[motion](.36);
    expect(snapshot()).not.toEqual(neutral);
    cappy.rest();
    expect(snapshot()).toEqual(neutral);
  });
});
