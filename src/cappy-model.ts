import { Color3 } from '@babylonjs/core/Maths/math.color';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Art } from './art';

const fur = '#956b4f';
const face = '#b08a64';
const muzzle = '#c1a07a';
const paw = '#554238';
const nose = '#332b26';
const straw = '#d8b975';

// Model faces local +Z. Root handles tile position/facing; the independent
// puppet/head/limb pivots handle the reference's chunky bipedal personality.
export class CappyModel {
  readonly root: TransformNode;
  readonly puppet: TransformNode;
  readonly torso: TransformNode;
  readonly head: TransformNode;
  readonly arms: TransformNode[] = [];
  readonly legs: TransformNode[] = [];

  constructor(art: Art) {
    this.root = new TransformNode('CappyRoot', art.scene);
    this.root.scaling.setAll(.96);
    this.puppet = new TransformNode('CappyPose', art.scene);
    this.puppet.parent = this.root;
    this.torso = new TransformNode('Body', art.scene);
    this.torso.parent = this.puppet;

    // Broad lower abdomen and tapered shoulders: a single continuous pear mesh.
    const body = art.profile('pear-shaped fur', [
      { y: .16, x: .29, z: .22 }, { y: .23, x: .46, z: .34 },
      { y: .38, x: .61, z: .43 }, { y: .55, x: .66, z: .46, offsetZ: .025 },
      { y: .73, x: .62, z: .43, offsetZ: .035 }, { y: .90, x: .50, z: .34 },
      { y: 1.04, x: .35, z: .25 }, { y: 1.12, x: .25, z: .19 },
    ], fur, this.torso, 28);
    // Paint the lighter belly onto the continuous body surface, so it cannot
    // intersect the torso or read as a separate floating plate in side view.
    const positions = body.getVerticesData(VertexBuffer.PositionKind)!;
    const furColor = Color3.FromHexString(fur);
    const bellyColor = Color3.FromHexString('#b3916e');
    const colors: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      const y = positions[i + 1];
      const z = positions[i + 2];
      const front = Math.max(0, Math.min(1, (z - .07) / .30));
      const belly = Math.max(0, 1 - Math.abs(y - .60) / .49);
      const color = Color3.Lerp(furColor, bellyColor, front * Math.min(1, belly * 1.8));
      colors.push(color.r, color.g, color.b, 1);
    }
    body.material = art.material('#ffffff');
    body.setVerticesData(VertexBuffer.ColorKind, colors);
    body.useVertexColors = true;

    this.head = new TransformNode('Head', art.scene);
    this.head.parent = this.torso;
    this.head.position.set(0, 1.19, .085);
    const skull = art.profile('broad capybara skull', [
      { y: -.245, x: .27, z: .27 }, { y: -.205, x: .38, z: .335 },
      { y: -.10, x: .45, z: .355 }, { y: .07, x: .45, z: .355 },
      { y: .185, x: .41, z: .33 }, { y: .245, x: .32, z: .28 },
    ], face, this.head, 28, .6);
    skull.position.z = .015;
    // The projecting blunt muzzle, rather than a round snout, defines a capybara.
    const snout = art.profile('continuous broad capybara muzzle', [
      { y: -.25, x: .23, z: .16 }, { y: -.215, x: .32, z: .20 },
      { y: -.10, x: .365, z: .24 }, { y: .005, x: .33, z: .22 },
      { y: .04, x: .255, z: .16 },
    ], muzzle, this.head, 28, .65);
    snout.position.z = .40;
    for (const side of [-1, 1]) {
      art.sphere('small dark eye', new Vector3(side * .34, .09, .332), new Vector3(.073, .086, .047), '#251f1b', this.head, 6);
      art.sphere('eye glint', new Vector3(side * .341 - .011, .111, .351), new Vector3(.012, .016, .009), '#e2cfaa', this.head, 3);
      const ear = art.sphere('rounded ear', new Vector3(side * .35, .27, -.10), new Vector3(.14, .19, .105), fur, this.head, 5);
      ear.rotation.z = side * -.19;
      art.sphere('inner ear', new Vector3(side * .351, .285, -.045), new Vector3(.076, .10, .03), '#765642', this.head, 5);
      art.tube('quiet mouth', [new Vector3(0, -.218, .581), new Vector3(side * .12, -.222, .575), new Vector3(side * .25, -.205, .549)], .008, '#71573f', this.head);
    }
    art.sphere('broad velvet nose', new Vector3(0, .016, .611), new Vector3(.32, .15, .15), nose, this.head, 10);
    for (const side of [-1, 1]) art.sphere('nostril', new Vector3(side * .081, .025, .682), new Vector3(.043, .028, .015), '#201b18', this.head, 4);
    art.tube('muzzle center line', [new Vector3(0, -.052, .659), new Vector3(0, -.14, .624), new Vector3(0, -.218, .581)], .008, '#71573f', this.head);

    for (const side of [-1, 1]) {
      const arm = new TransformNode(side < 0 ? 'ArmLeft' : 'ArmRight', art.scene);
      arm.parent = this.torso;
      arm.position.set(side * .48, .98, .035);
      arm.scaling.y = .78;
      art.profile('short arm', [
        { y: -.44, x: .061, z: .068, offsetZ: .055 },
        { y: -.31, x: .080, z: .080, offsetZ: .026 },
        { y: -.13, x: .080, z: .082 },
        { y: -.02, x: .075, z: .070 }, { y: .045, x: .028, z: .032 },
      ], fur, arm, 12);
      art.sphere('little dark paw', new Vector3(0, -.44, .06), new Vector3(.15, .19, .15), paw, arm, 6);
      for (let toe = 0; toe < 3; toe++) art.sphere('paw digit', new Vector3((toe - 1) * .038, -.51, .098), new Vector3(.046, .09, .063), paw, arm, 4);
      this.arms.push(arm);

      const leg = new TransformNode(side < 0 ? 'LegLeft' : 'LegRight', art.scene);
      leg.parent = this.puppet;
      leg.position.set(side * .27, .235, .0);
      art.cylinder('short sturdy leg', new Vector3(0, -.065, 0), .15, .17, .20, '#765440', leg);
      art.sphere('capybara foot', new Vector3(0, -.15, .07), new Vector3(.23, .14, .28), paw, leg, 6);
      for (let toe = 0; toe < 4; toe++) art.sphere('rounded toe', new Vector3((toe - 1.5) * .045, -.167, .19), new Vector3(.055, .083, .094), paw, leg, 4);
      this.legs.push(leg);
    }
    this.createHat(art);
    this.rest();
  }
  private createHat(art: Art) {
    const hat = new TransformNode('StrawHat', art.scene);
    hat.parent = this.head;
    hat.position.set(0, .265, -.055);
    hat.rotation.set(-.055, .04, -.075);
    // Curved shallow brim and pinched crown, instead of stacked plain cylinders.
    art.profile('curved straw brim', [
      { y: -.025, x: .22, z: .20 }, { y: -.035, x: .50, z: .46 },
      { y: .005, x: .53, z: .49 }, { y: .05, x: .47, z: .435 },
      { y: .04, x: .26, z: .24 },
    ], straw, hat, 24);
    art.profile('hat crown', [
      { y: .005, x: .275, z: .25 }, { y: .08, x: .285, z: .26 },
      { y: .23, x: .24, z: .215 }, { y: .28, x: .205, z: .19 },
      { y: .29, x: .17, z: .16 },
    ], '#e2c383', hat, 20, .9);
    art.profile('woven hat band', [
      { y: .045, x: .284, z: .261 }, { y: .094, x: .283, z: .260 },
    ], '#856242', hat, 20, .9);
    for (let line = 0; line < 3; line++) {
      const radius = .31 + line * .065;
      const points = Array.from({ length: 25 }, (_, i) => new Vector3(Math.cos(i / 24 * Math.PI * 2) * radius, .04 + line * .006, Math.sin(i / 24 * Math.PI * 2) * radius * .92));
      art.tube('brim straw weave', points, .004, '#c4a363', hat);
    }
    art.roundedBox('hat band knot', new Vector3(-.27, .071, .075), new Vector3(.065, .065, .10), '#73573c', hat);
  }
  rest() {
    this.puppet.position.setAll(0);
    this.puppet.rotation.setAll(0);
    this.torso.scaling.setAll(1);
    this.torso.position.setAll(0);
    this.torso.rotation.setAll(0);
    this.head.position.y = 1.19;
    this.head.rotation.setAll(0);
    this.arms.forEach((arm, index) => { arm.rotation.set(.08, 0, index ? .48 : -.48); });
    this.legs.forEach(leg => { leg.rotation.setAll(0); });
  }
  idle(time: number) {
    this.rest();
    const breath = Math.sin(time / 800);
    this.torso.scaling.y = 1 + breath * .009;
    this.head.position.y += breath * .006;
    this.head.rotation.y = Math.sin(time / 2800) * .035;
    this.arms.forEach(arm => { arm.rotation.x += breath * .015; });
  }
  walk(t: number) {
    this.rest();
    const step = Math.sin(t * Math.PI * 4);
    const envelope = Math.sin(t * Math.PI);
    this.puppet.position.y = Math.abs(step) * .035;
    this.puppet.rotation.z = step * .09 * envelope;
    this.puppet.position.x = step * .035 * envelope;
    this.head.rotation.z = -step * .035 * envelope;
    this.legs.forEach((leg, i) => { leg.rotation.x = step * (i ? -1 : 1) * .25; });
    this.arms.forEach((arm, i) => { arm.rotation.x = step * (i ? 1 : -1) * .16; });
  }
  plant(t: number) {
    this.rest();
    const bend = Math.sin(t * Math.PI) ** 1.1;
    this.torso.rotation.x = bend * .40;
    this.torso.scaling.y = 1 - bend * .08;
    this.head.rotation.x = bend * .13;
    this.arms.forEach((arm, i) => {
      arm.rotation.x = -bend * 1.05;
      arm.rotation.z = (i ? 1 : -1) * (.48 - bend * .18);
    });

  }
  confused(t: number) {
    this.rest();
    const tilt = Math.sin(t * Math.PI);
    this.head.rotation.z = tilt * .19;
    this.head.rotation.x = tilt * .1;
    this.arms[0].rotation.x = -tilt * .4;
  }
  celebrate(t: number) {
    this.rest();
    const cheer = Math.sin(t * Math.PI);
    this.puppet.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * .15;
    this.arms.forEach((arm, i) => { arm.rotation.z = (i ? 1 : -1) * (.48 + cheer * 1.2); });
    this.head.rotation.x = -cheer * .1;
  }
}
