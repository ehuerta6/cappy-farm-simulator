export const GRID_SIZE = 6;
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Action = { kind: 'move'; direction: string } | { kind: 'plant' };
export interface Tile { terrain: 'grass' | 'soil'; planted: boolean }
export interface FarmState {
  cappy: { x: number; y: number; direction: Direction };
  tiles: Tile[][];
}
export class CappyError extends Error {
  constructor(message: string) { super(message); this.name = 'CappyError'; }
}
export function createFarm(): FarmState {
  return {
    cappy: { x: 1, y: 3, direction: 'right' },
    tiles: Array.from({ length: GRID_SIZE }, (_, y) =>
      Array.from({ length: GRID_SIZE }, (_, x) => ({
        terrain: (y === 2 || y === 3) && x >= 1 && x <= 3 ? 'soil' : 'grass',
        planted: false,
      })),
    ),
  };
}
export function carrotCount(state: FarmState): number {
  return state.tiles.flat().filter(tile => tile.planted).length;
}
export function objectiveComplete(state: FarmState): boolean { return carrotCount(state) >= 3; }

// Pure validation/transition: the caller commits the result only after animation.
export function applyAction(state: FarmState, action: Action): FarmState {
  const next = structuredClone(state);
  if (action.kind === 'move') {
    const offsets: Record<Direction, [number, number]> = {
      up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
    };
    if (!Object.hasOwn(offsets, action.direction)) {
      throw new CappyError('Choose a direction: "up", "down", "left", or "right".');
    }
    const direction = action.direction as Direction;
    const [dx, dy] = offsets[direction];
    const x = state.cappy.x + dx;
    const y = state.cappy.y + dy;
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) {
      throw new CappyError("Cappy can't leave the farm. Try another direction.");
    }
    next.cappy = { x, y, direction };
  } else {
    const tile = next.tiles[state.cappy.y][state.cappy.x];
    if (tile.terrain !== 'soil') throw new CappyError("Cappy can't plant here. Find a soil tile.");
    if (tile.planted) throw new CappyError('This tile already has a carrot. Try an empty soil tile.');
    tile.planted = true;
  }
  return next;
}
