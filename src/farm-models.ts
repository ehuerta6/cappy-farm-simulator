import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Art } from './art';
import { GRID_SIZE, type FarmState } from './simulation';

type World = (x: number, y: number, height?: number) => Vector3;

export function createGround(art: Art, state: FarmState, world: World) {
  art.roundedBox('soft earth foundation', new Vector3(0, -.33, 0), new Vector3(6.75, .66, 6.75), '#ad8b66', undefined, .13);
  art.roundedBox('mossy grass edge', new Vector3(0, -.035, 0), new Vector3(6.77, .15, 6.77), '#8a9e63', undefined, .13);
  const grass = ['#b0bf85', '#acbc81', '#b4c38b', '#afbf87'];
  const soil = ['#967054', '#9b7356', '#997255'];
  for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) {
    const plantable = state.tiles[y][x].terrain === 'soil';
    const center = world(x, y, plantable ? .048 : .035 + Math.sin(x * 4 + y) * .004);
    art.roundedBox(`tile ${x},${y}`, center,
      new Vector3(plantable ? .95 : .985, plantable ? .11 : .07, plantable ? .95 : .985),
      plantable ? soil[(x + y) % soil.length] : grass[(x * 3 + y) % grass.length], undefined, .19);
    if (plantable) {
      for (let furrow = 0; furrow < 4; furrow++) {
        const z = (furrow - 1.5) * .19;
        const points = [-.34, -.17, 0, .17, .34].map((offset, i) => center.add(new Vector3(offset, .057, z + Math.sin(i + x) * .008)));
        art.tube('soft soil furrow', points, .014, '#775238');
      }
      // Two tiny soil clods keep the cultivated plots from looking machined.
      art.sphere('soil clod', center.add(new Vector3(-.31, .06, -.32)), new Vector3(.09, .045, .07), '#ae8864');
      art.sphere('soil clod', center.add(new Vector3(.33, .062, .31)), new Vector3(.07, .04, .085), '#876047');
    }
  }
}

function organicRock(art: Art, name: string, at: Vector3, size: Vector3, color: string, seed: number, parent?: TransformNode) {
  const mesh = CreateIcoSphere(name, { radius: 1, subdivisions: 2, flat: true, updatable: true }, art.scene);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < positions.length; i += 3) {
    const variation = 1 + Math.sin(positions[i] * 7 + positions[i + 1] * 4 + positions[i + 2] * 6 + seed) * .10;
    positions[i] *= size.x * .5 * variation;
    positions[i + 1] *= size.y * .5 * variation;
    positions[i + 2] *= size.z * .5 * variation;
  }
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  mesh.convertToFlatShadedMesh();
  mesh.refreshBoundingInfo();
  return art.finish(mesh, color, at, parent);
}

export function createDecorations(art: Art) {
  // Every decoration frames the farm beyond its traversable tile centers.
  for (let i = 0; i <= 6; i++) {
    const h = .67 + Math.sin(i * 3) * .035;
    const post = art.roundedBox('weathered fence post', new Vector3(i - 3, h / 2, -3.16), new Vector3(.13, h, .13), '#c8aa78');
    post.rotation.z = Math.sin(i * 2) * .025;
    art.cylinder('post cap', new Vector3(i - 3, h + .022, -3.16), .065, .145, .09, '#d5b885', undefined, 4).rotation.y = Math.PI / 4;
    if (i < 6) for (const h of [.24, .51]) {
      const rail = art.box('wooden fence rail', new Vector3(i - 2.5, h, -3.15), new Vector3(1.02, .095, .075), '#dec297');
      rail.rotation.z = Math.sin(i) * .022;
    }
  }
  const tree = new TransformNode('orchard tree', art.scene);
  tree.position.set(-2.95, 0, -2.65);
  const trunk = art.cylinder('tapered tree trunk', new Vector3(0, .61, 0), 1.2, .30, .19, '#87694b', tree, 7);
  trunk.rotation.z = -.07;
  const branch = art.cylinder('forked branch', new Vector3(.22, 1.01, .02), .6, .16, .10, '#87694b', tree, 6);
  branch.rotation.z = -.65;
  for (const [at, size, color, seed] of [
    [new Vector3(-.16, 1.60, -.06), new Vector3(1.12, 1.02, 1.02), '#789253', 1],
    [new Vector3(.40, 1.50, .08), new Vector3(.95, .81, .86), '#91a760', 2],
    [new Vector3(.04, 1.91, .14), new Vector3(.82, .68, .80), '#869e59', 4],
    [new Vector3(-.30, 1.39, .35), new Vector3(.67, .59, .70), '#6e884e', 7],
  ] as const) organicRock(art, 'faceted canopy', at, size, color, seed, tree);
  const rock = organicRock(art, 'large field stone', new Vector3(2.98, .17, 2.65), new Vector3(.5, .36, .42), '#a3a394', 3);
  rock.rotation.set(.1, .4, -.15);
  organicRock(art, 'small field stone', new Vector3(2.66, .10, 2.87), new Vector3(.26, .20, .28), '#b8b5a1', 2).rotation.y = .7;
  for (const [x, z] of [[-3, 1.2], [-2.9, 1.5], [-3.05, 2], [2.7, -2.7], [2.95, -2.5]]) {
    art.cylinder('flower stem', new Vector3(x, .15, z), .24, .025, .02, '#7d965d', undefined, 5);
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal * Math.PI * 2 / 5;
      art.sphere('simple flower petal', new Vector3(x + Math.cos(angle) * .047, .285, z + Math.sin(angle) * .047), new Vector3(.076, .037, .076), '#f0d591');
    }
    art.sphere('flower center', new Vector3(x, .302, z), new Vector3(.043, .025, .043), '#ca9e52');
  }
  for (const [x, z] of [[-3.1, 2.6], [3.08, -.7], [2.9, -2.8], [-3.12, -.2]]) {
    for (let blade = 0; blade < 3; blade++) {
      const grass = art.profile('edge grass tuft', [
        { y: 0, x: .025, z: .015 }, { y: .15, x: .028, z: .01 }, { y: .26, x: .003, z: .003, offsetZ: .045 },
      ], blade % 2 ? '#8da363' : '#7f9658', undefined, 6);
      grass.position.set(x + (blade - 1) * .045, .05, z);
      grass.rotation.z = (blade - 1) * .25;
    }
  }
}

export function createCarrot(art: Art, at: Vector3) {
  const root = new TransformNode('planted carrot', art.scene);
  // A small offset inside its own tile keeps the sprout visible beside Cappy.
  root.position.copyFrom(at.add(new Vector3(.16, 0, .24)));
  art.profile('orange carrot shoulder', [
    { y: -.05, x: .04, z: .04 }, { y: .01, x: .13, z: .12 },
    { y: .095, x: .115, z: .10 }, { y: .13, x: .06, z: .05 },
  ], '#d88a42', root, 12);
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7;
    const pivot = new TransformNode('leaf stem', art.scene);
    pivot.parent = root;
    pivot.position.y = .10;
    pivot.rotation.set(Math.cos(angle) * .46, angle, Math.sin(angle) * .46);
    art.profile('chunky carrot frond', [
      { y: 0, x: .018, z: .018 }, { y: .16, x: .065, z: .028 },
      { y: .30, x: .08, z: .025 }, { y: .44 + (i % 3) * .035, x: .014, z: .009 },
    ], i % 2 ? '#638841' : '#7b9b4e', pivot, 8);
  }
  return root;
}
